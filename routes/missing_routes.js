// routes/missing_routes.js
const express = require('express');
const router = express.Router();
const pool = require('../database');

// =====================================================
// 1. POS CASHIER ROUTES
// =====================================================

// Get POS products with stock
router.get('/pos/products', async (req, res) => {
    try {
        const { branch_id } = req.query;
        
        let query = `
            SELECT 
                p.*,
                COALESCE(bs.quantity, 0) as stock_quantity,
                c.name as category_name
            FROM products p
            LEFT JOIN branch_stock bs ON p.id = bs.product_id AND bs.branch_id = $1
            LEFT JOIN product_categories c ON p.category_id = c.id
            WHERE p.stock > 0 OR p.stock IS NULL
            ORDER BY p.name
        `;
        
        const result = await pool.query(query, [branch_id || 1]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching POS products:', error);
        res.status(500).json({ error: error.message });
    }
});

// Process POS sale
router.post('/pos/sale', async (req, res) => {
    const client = await pool.connect();
    try {
        const { items, branch_id, customer_id, payment_method, created_by } = req.body;

        if (!items || !items.length || !branch_id || !created_by) {
            return res.status(400).json({
                error: 'Missing required fields: items, branch_id, created_by'
            });
        }

        await client.query('BEGIN');

        let totalAmount = 0;
        let totalProfit = 0;

        for (const item of items) {
            // Check stock
            const stockCheck = await client.query(
                'SELECT quantity FROM branch_stock WHERE branch_id = $1 AND product_id = $2',
                [branch_id, item.product_id]
            );

            if (stockCheck.rowCount === 0 || stockCheck.rows[0].quantity < item.quantity) {
                throw new Error(`Insufficient stock for product ${item.product_id}`);
            }

            // Get product details
            const product = await client.query(
                'SELECT name, price, cost FROM products WHERE id = $1',
                [item.product_id]
            );

            const unitPrice = item.price || product.rows[0].price;
            const costPrice = product.rows[0].cost || 0;
            const itemTotal = unitPrice * item.quantity;
            const itemProfit = (unitPrice - costPrice) * item.quantity;

            totalAmount += itemTotal;
            totalProfit += itemProfit;

            // Update stock
            await client.query(
                'UPDATE branch_stock SET quantity = quantity - $1 WHERE branch_id = $2 AND product_id = $3',
                [item.quantity, branch_id, item.product_id]
            );
        }

        // Create sale
        const saleResult = await client.query(`
            INSERT INTO sales (
                branch_id, customer_id, total_amount, profit,
                created_by, created_at
            ) VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING id
        `, [branch_id, customer_id || null, totalAmount, totalProfit, created_by]);

        const saleId = saleResult.rows[0].id;

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            data: {
                sale_id: saleId,
                total_amount: totalAmount,
                profit: totalProfit
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error processing POS sale:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// =====================================================
// 2. CUSTOMERS ROUTES
// =====================================================

// Get all customers
router.get('/customers', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                c.*,
                COUNT(s.id) as total_purchases,
                COALESCE(SUM(s.total_amount), 0) as total_spent
            FROM customers c
            LEFT JOIN sales s ON c.id = s.customer_id
            GROUP BY c.id
            ORDER BY c.name
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get single customer
router.get('/customers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT 
                c.*,
                COUNT(s.id) as total_purchases,
                COALESCE(SUM(s.total_amount), 0) as total_spent
            FROM customers c
            LEFT JOIN sales s ON c.id = s.customer_id
            WHERE c.id = $1
            GROUP BY c.id
        `, [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching customer:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add customer
router.post('/customers', async (req, res) => {
    try {
        const { name, phone, email, address, notes } = req.body;
        
        const result = await pool.query(`
            INSERT INTO customers (name, phone, email, address, notes, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING *
        `, [name, phone, email, address, notes]);
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error adding customer:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update customer
router.put('/customers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone, email, address, notes } = req.body;
        
        const result = await pool.query(`
            UPDATE customers 
            SET 
                name = COALESCE($1, name),
                phone = COALESCE($2, phone),
                email = COALESCE($3, email),
                address = COALESCE($4, address),
                notes = COALESCE($5, notes),
                updated_at = NOW()
            WHERE id = $6
            RETURNING *
        `, [name, phone, email, address, notes, id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating customer:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete customer
router.delete('/customers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const check = await pool.query(
            'SELECT COUNT(*) FROM sales WHERE customer_id = $1',
            [id]
        );
        
        if (parseInt(check.rows[0].count) > 0) {
            return res.status(400).json({
                error: 'Cannot delete customer with sales history'
            });
        }
        
        const result = await pool.query(
            'DELETE FROM customers WHERE id = $1 RETURNING id',
            [id]
        );
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        
        res.json({ message: 'Customer deleted successfully' });
    } catch (error) {
        console.error('Error deleting customer:', error);
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// 3. CUSTOMER RETURNS
// =====================================================

// Get returns
router.get('/returns', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                r.*,
                c.name as customer_name,
                p.name as product_name
            FROM customer_returns r
            LEFT JOIN customers c ON r.customer_id = c.id
            LEFT JOIN products p ON r.product_id = p.id
            ORDER BY r.created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching returns:', error);
        res.status(500).json({ error: error.message });
    }
});

// Process return
router.post('/returns', async (req, res) => {
    const client = await pool.connect();
    try {
        const { customer_id, sale_id, product_id, quantity, reason, return_amount, processed_by } = req.body;

        if (!customer_id || !product_id || !quantity) {
            return res.status(400).json({
                error: 'Missing required fields: customer_id, product_id, quantity'
            });
        }

        await client.query('BEGIN');

        const result = await client.query(`
            INSERT INTO customer_returns (
                customer_id, sale_id, product_id, quantity,
                reason, return_amount, status, processed_by, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, 'processed', $7, NOW())
            RETURNING *
        `, [customer_id, sale_id, product_id, quantity, reason, return_amount, processed_by]);

        await client.query('COMMIT');

        res.status(201).json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error processing return:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// =====================================================
// 4. DAILY CLOSING
// =====================================================

// Get daily closing data
router.get('/daily-closing', async (req, res) => {
    try {
        const { date, branch_id } = req.query;
        const closingDate = date || new Date().toISOString().split('T')[0];

        let query = `
            SELECT 
                DATE(created_at) as date,
                branch_id,
                COUNT(*) as total_transactions,
                COALESCE(SUM(total_amount), 0) as total_sales,
                COALESCE(SUM(profit), 0) as total_profit
            FROM sales
            WHERE DATE(created_at) = $1
        `;
        const params = [closingDate];

        if (branch_id) {
            query += ` AND branch_id = $2`;
            params.push(branch_id);
        }

        query += ` GROUP BY DATE(created_at), branch_id ORDER BY branch_id`;

        const result = await pool.query(query, params);
        
        res.json({
            date: closingDate,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching daily closing:', error);
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// 5. EXPENSES
// =====================================================

// Get expenses
router.get('/expenses', async (req, res) => {
    try {
        const { start_date, end_date, branch_id } = req.query;
        
        let query = `
            SELECT 
                e.*,
                b.name as branch_name
            FROM expenses e
            LEFT JOIN branches b ON e.branch_id = b.id
            WHERE 1=1
        `;
        const params = [];

        if (start_date) {
            query += ` AND e.date >= $${params.length + 1}`;
            params.push(start_date);
        }

        if (end_date) {
            query += ` AND e.date <= $${params.length + 1}`;
            params.push(end_date);
        }

        if (branch_id) {
            query += ` AND e.branch_id = $${params.length + 1}`;
            params.push(branch_id);
        }

        query += ` ORDER BY e.date DESC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching expenses:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add expense
router.post('/expenses', async (req, res) => {
    try {
        const { description, amount, category, date, branch_id, payment_method, reference, created_by } = req.body;

        if (!description || !amount || !category) {
            return res.status(400).json({
                error: 'Missing required fields: description, amount, category'
            });
        }

        const result = await pool.query(`
            INSERT INTO expenses (
                description, amount, category, date,
                branch_id, payment_method, reference,
                created_by, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            RETURNING *
        `, [description, amount, category, date || new Date(), branch_id, payment_method, reference, created_by]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error adding expense:', error);
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// 6. INVOICES
// =====================================================

// Get invoices
router.get('/invoices', async (req, res) => {
    try {
        const { start_date, end_date, customer_id, status } = req.query;
        
        let query = `
            SELECT 
                i.*,
                c.name as customer_name,
                b.name as branch_name
            FROM invoices i
            LEFT JOIN customers c ON i.customer_id = c.id
            LEFT JOIN branches b ON i.branch_id = b.id
            WHERE 1=1
        `;
        const params = [];

        if (start_date) {
            query += ` AND i.issue_date >= $${params.length + 1}`;
            params.push(start_date);
        }

        if (end_date) {
            query += ` AND i.issue_date <= $${params.length + 1}`;
            params.push(end_date);
        }

        if (customer_id) {
            query += ` AND i.customer_id = $${params.length + 1}`;
            params.push(customer_id);
        }

        if (status) {
            query += ` AND i.status = $${params.length + 1}`;
            params.push(status);
        }

        query += ` ORDER BY i.issue_date DESC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching invoices:', error);
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// 7. STOCK TRANSFERS
// =====================================================

// Get transfer history
router.get('/transfers', async (req, res) => {
    try {
        const { from_branch, to_branch, start_date, end_date } = req.query;
        
        let query = `
            SELECT 
                st.*,
                fb.name as from_branch_name,
                tb.name as to_branch_name,
                p.name as product_name
            FROM stock_transfers st
            LEFT JOIN branches fb ON st.from_branch_id = fb.id
            LEFT JOIN branches tb ON st.to_branch_id = tb.id
            LEFT JOIN products p ON st.product_id = p.id
            WHERE 1=1
        `;
        const params = [];

        if (from_branch) {
            query += ` AND st.from_branch_id = $${params.length + 1}`;
            params.push(from_branch);
        }

        if (to_branch) {
            query += ` AND st.to_branch_id = $${params.length + 1}`;
            params.push(to_branch);
        }

        if (start_date) {
            query += ` AND st.transfer_date >= $${params.length + 1}`;
            params.push(start_date);
        }

        if (end_date) {
            query += ` AND st.transfer_date <= $${params.length + 1}`;
            params.push(end_date);
        }

        query += ` ORDER BY st.transfer_date DESC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching transfers:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create stock transfer
router.post('/transfers', async (req, res) => {
    const client = await pool.connect();
    try {
        const { from_branch_id, to_branch_id, product_id, quantity, notes, transferred_by } = req.body;

        if (!from_branch_id || !to_branch_id || !product_id || !quantity) {
            return res.status(400).json({
                error: 'Missing required fields'
            });
        }

        await client.query('BEGIN');

        const stockCheck = await client.query(
            'SELECT quantity FROM branch_stock WHERE branch_id = $1 AND product_id = $2',
            [from_branch_id, product_id]
        );

        if (stockCheck.rowCount === 0 || stockCheck.rows[0].quantity < quantity) {
            throw new Error('Insufficient stock for transfer');
        }

        const result = await client.query(`
            INSERT INTO stock_transfers (
                from_branch_id, to_branch_id, product_id,
                quantity, notes, status, transferred_by,
                transfer_date
            ) VALUES ($1, $2, $3, $4, $5, 'pending', $6, NOW())
            RETURNING *
        `, [from_branch_id, to_branch_id, product_id, quantity, notes, transferred_by]);

        await client.query('COMMIT');

        res.status(201).json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating transfer:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// =====================================================
// 8. REPORTS
// =====================================================

// Branch sales report
router.get('/reports/branch-sales', async (req, res) => {
    try {
        const { start_date, end_date, branch_id } = req.query;
        
        let query = `
            SELECT 
                b.name as branch_name,
                DATE(s.date) as sale_date,
                COUNT(DISTINCT s.id) as transaction_count,
                COALESCE(SUM(s.total_amount), 0) as total_sales,
                COALESCE(SUM(s.profit), 0) as total_profit
            FROM sales s
            LEFT JOIN branches b ON s.branch_id = b.id
            WHERE 1=1
        `;
        const params = [];

        if (start_date) {
            query += ` AND s.date >= $${params.length + 1}`;
            params.push(start_date);
        }

        if (end_date) {
            query += ` AND s.date <= $${params.length + 1}`;
            params.push(end_date);
        }

        if (branch_id) {
            query += ` AND s.branch_id = $${params.length + 1}`;
            params.push(branch_id);
        }

        query += ` GROUP BY b.name, DATE(s.date) ORDER BY sale_date DESC, b.name`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error generating branch sales report:', error);
        res.status(500).json({ error: error.message });
    }
});

// Purchase Order report
router.get('/reports/purchase-orders', async (req, res) => {
    try {
        const { start_date, end_date, supplier_id, status } = req.query;
        
        let query = `
            SELECT 
                po.*,
                s.name as supplier_name,
                b.name as branch_name
            FROM purchase_orders po
            LEFT JOIN suppliers s ON po.supplier_id = s.id
            LEFT JOIN branches b ON po.branch_id = b.id
            WHERE 1=1
        `;
        const params = [];

        if (start_date) {
            query += ` AND po.order_date >= $${params.length + 1}`;
            params.push(start_date);
        }

        if (end_date) {
            query += ` AND po.order_date <= $${params.length + 1}`;
            params.push(end_date);
        }

        if (supplier_id) {
            query += ` AND po.supplier_id = $${params.length + 1}`;
            params.push(supplier_id);
        }

        if (status) {
            query += ` AND po.status = $${params.length + 1}`;
            params.push(status);
        }

        query += ` ORDER BY po.order_date DESC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error generating PO report:', error);
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// 9. STOCK CONTROL
// =====================================================

// Get stock control data
router.get('/stock-control', async (req, res) => {
    try {
        const { branch_id, low_stock_only } = req.query;
        
        let query = `
            SELECT 
                bs.*,
                p.name as product_name,
                p.barcode,
                p.price,
                p.cost,
                b.name as branch_name,
                (bs.quantity * p.price) as stock_value
            FROM branch_stock bs
            LEFT JOIN products p ON bs.product_id = p.id
            LEFT JOIN branches b ON bs.branch_id = b.id
            WHERE 1=1
        `;
        const params = [];

        if (branch_id) {
            query += ` AND bs.branch_id = $${params.length + 1}`;
            params.push(branch_id);
        }

        if (low_stock_only === 'true') {
            query += ` AND bs.quantity <= bs.min_stock`;
        }

        query += ` ORDER BY b.name, p.name`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching stock control data:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update stock levels
router.put('/stock-control', async (req, res) => {
    try {
        const { branch_id, product_id, quantity, min_stock } = req.body;

        if (!branch_id || !product_id) {
            return res.status(400).json({
                error: 'Missing required fields: branch_id, product_id'
            });
        }

        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (quantity !== undefined) {
            updates.push(`quantity = $${paramIndex}`);
            values.push(quantity);
            paramIndex++;
        }

        if (min_stock !== undefined) {
            updates.push(`min_stock = $${paramIndex}`);
            values.push(min_stock);
            paramIndex++;
        }

        if (updates.length === 0) {
            return res.status(400).json({
                error: 'No fields to update'
            });
        }

        values.push(branch_id);
        values.push(product_id);

        const query = `
            UPDATE branch_stock 
            SET ${updates.join(', ')}, updated_at = NOW()
            WHERE branch_id = $${paramIndex} AND product_id = $${paramIndex + 1}
            RETURNING *
        `;

        const result = await pool.query(query, values);
        
        if (result.rowCount === 0) {
            return res.status(404).json({
                error: 'Stock record not found'
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating stock:', error);
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// 10. RECEIVE PRODUCTS
// =====================================================

// Receive products (stock receiving)
router.post('/products/receive', async (req, res) => {
    const client = await pool.connect();
    try {
        const { product_id, branch_id, quantity, unit_cost, supplier_id, received_by, notes } = req.body;

        if (!product_id || !branch_id || !quantity || quantity <= 0) {
            return res.status(400).json({
                error: 'Missing required fields: product_id, branch_id, quantity'
            });
        }

        await client.query('BEGIN');

        const productCheck = await client.query(
            'SELECT * FROM products WHERE id = $1',
            [product_id]
        );

        if (productCheck.rowCount === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Update stock
        const stockCheck = await client.query(
            'SELECT * FROM branch_stock WHERE branch_id = $1 AND product_id = $2',
            [branch_id, product_id]
        );

        if (stockCheck.rowCount === 0) {
            await client.query(`
                INSERT INTO branch_stock (branch_id, product_id, quantity)
                VALUES ($1, $2, $3)
            `, [branch_id, product_id, quantity]);
        } else {
            await client.query(`
                UPDATE branch_stock 
                SET quantity = quantity + $1, updated_at = NOW()
                WHERE branch_id = $2 AND product_id = $3
            `, [quantity, branch_id, product_id]);
        }

        // Record receiving transaction
        await client.query(`
            INSERT INTO receiving (
                product_id, branch_id, qty, cost,
                supplier_id, notes, created_by, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [product_id, branch_id, quantity, unit_cost, supplier_id, notes, received_by]);

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            message: 'Products received successfully',
            data: { product_id, branch_id, quantity }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error receiving products:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// =====================================================
// 11. CURRENCY SETTINGS
// =====================================================

// Get currency settings
router.get('/currency-settings', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM system_settings 
            WHERE key LIKE 'currency_%'
            OR key = 'default_currency'
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching currency settings:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update currency settings
router.put('/currency-settings', async (req, res) => {
    try {
        const { currency_code, currency_symbol, decimal_places, exchange_rate } = req.body;
        
        const updates = [];
        if (currency_code) {
            updates.push(pool.query(`
                INSERT INTO system_settings (key, value, updated_at)
                VALUES ('currency_code', $1, NOW())
                ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
            `, [currency_code]));
        }
        if (currency_symbol) {
            updates.push(pool.query(`
                INSERT INTO system_settings (key, value, updated_at)
                VALUES ('currency_symbol', $1, NOW())
                ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
            `, [currency_symbol]));
        }
        if (decimal_places) {
            updates.push(pool.query(`
                INSERT INTO system_settings (key, value, updated_at)
                VALUES ('decimal_places', $1, NOW())
                ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
            `, [decimal_places]));
        }
        if (exchange_rate) {
            updates.push(pool.query(`
                INSERT INTO system_settings (key, value, updated_at)
                VALUES ('exchange_rate', $1, NOW())
                ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
            `, [exchange_rate]));
        }

        await Promise.all(updates);
        
        res.json({ message: 'Currency settings updated successfully' });
    } catch (error) {
        console.error('Error updating currency settings:', error);
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// 12. BRANCH STOCK SAVE
// =====================================================

// Save/Update branch stock
router.put('/branch-stock', async (req, res) => {
    try {
        const { branch_id, product_id, quantity, min_stock } = req.body;

        if (!branch_id || !product_id) {
            return res.status(400).json({
                error: 'Missing required fields: branch_id, product_id'
            });
        }

        // Check if record exists
        const check = await pool.query(
            'SELECT * FROM branch_stock WHERE branch_id = $1 AND product_id = $2',
            [branch_id, product_id]
        );

        if (check.rowCount === 0) {
            // Insert new record
            const result = await pool.query(`
                INSERT INTO branch_stock (branch_id, product_id, quantity, min_stock)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `, [branch_id, product_id, quantity || 0, min_stock || 0]);
            
            res.status(201).json(result.rows[0]);
        } else {
            // Update existing record
            const updates = [];
            const values = [];
            let paramIndex = 1;

            if (quantity !== undefined) {
                updates.push(`quantity = $${paramIndex}`);
                values.push(quantity);
                paramIndex++;
            }

            if (min_stock !== undefined) {
                updates.push(`min_stock = $${paramIndex}`);
                values.push(min_stock);
                paramIndex++;
            }

            if (updates.length === 0) {
                return res.status(400).json({
                    error: 'No fields to update'
                });
            }

            values.push(branch_id);
            values.push(product_id);

            const query = `
                UPDATE branch_stock 
                SET ${updates.join(', ')}, updated_at = NOW()
                WHERE branch_id = $${paramIndex} AND product_id = $${paramIndex + 1}
                RETURNING *
            `;

            const result = await pool.query(query, values);
            res.json(result.rows[0]);
        }
    } catch (error) {
        console.error('Error saving branch stock:', error);
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// 13. TRANSFER HISTORY
// =====================================================

// Get transfer history (detailed)
router.get('/transfer-history', async (req, res) => {
    try {
        const { branch_id, start_date, end_date } = req.query;
        
        let query = `
            SELECT 
                st.*,
                fb.name as from_branch_name,
                tb.name as to_branch_name,
                p.name as product_name,
                p.barcode,
                u.username as transferred_by_name,
                u2.username as confirmed_by_name
            FROM stock_transfers st
            LEFT JOIN branches fb ON st.from_branch_id = fb.id
            LEFT JOIN branches tb ON st.to_branch_id = tb.id
            LEFT JOIN products p ON st.product_id = p.id
            LEFT JOIN users u ON st.transferred_by = u.id
            LEFT JOIN users u2 ON st.confirmed_by = u2.id
            WHERE 1=1
        `;
        const params = [];

        if (branch_id) {
            query += ` AND (st.from_branch_id = $${params.length + 1} OR st.to_branch_id = $${params.length + 1})`;
            params.push(branch_id);
        }

        if (start_date) {
            query += ` AND st.transfer_date >= $${params.length + 1}`;
            params.push(start_date);
        }

        if (end_date) {
            query += ` AND st.transfer_date <= $${params.length + 1}`;
            params.push(end_date);
        }

        query += ` ORDER BY st.transfer_date DESC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching transfer history:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;