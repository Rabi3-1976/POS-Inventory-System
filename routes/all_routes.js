// routes/all_routes.js
const express = require('express');
const router = express.Router();
const pool = require('../database');

// =====================================================
// 1. POS CASHIER
// =====================================================

// Get products for POS
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
            WHERE p.is_active = true
            ORDER BY p.name
        `;
        
        const result = await pool.query(query, [branch_id]);
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
        const {
            items,
            branch_id,
            customer_id,
            payment_method,
            discount_percent = 0,
            tax_rate = 0.15,
            created_by
        } = req.body;

        if (!items || !items.length || !branch_id || !created_by) {
            return res.status(400).json({
                error: 'Missing required fields: items, branch_id, created_by'
            });
        }

        await client.query('BEGIN');

        let subtotal = 0;
        let total_tax = 0;
        let total_discount = 0;
        const saleItems = [];

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
                'SELECT name, unit_price, cost_price FROM products WHERE id = $1',
                [item.product_id]
            );

            const unit_price = item.unit_price || product.rows[0].unit_price;
            const cost_price = product.rows[0].cost_price || 0;
            const itemTotal = unit_price * item.quantity;
            const itemTax = itemTotal * tax_rate;
            const itemDiscount = itemTotal * (discount_percent / 100);

            subtotal += itemTotal;
            total_tax += itemTax;
            total_discount += itemDiscount;

            saleItems.push({
                ...item,
                unit_price,
                cost_price,
                total: itemTotal,
                tax: itemTax,
                discount: itemDiscount
            });

            // Update stock
            await client.query(
                'UPDATE branch_stock SET quantity = quantity - $1 WHERE branch_id = $2 AND product_id = $3',
                [item.quantity, branch_id, item.product_id]
            );
        }

        const total_amount = subtotal + total_tax - total_discount;

        // Create sale
        const saleResult = await client.query(`
            INSERT INTO sales (
                branch_id, customer_id, subtotal, tax_amount,
                discount_amount, total_amount, payment_method,
                profit, created_by, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
            RETURNING id
        `, [
            branch_id,
            customer_id || null,
            subtotal,
            total_tax,
            total_discount,
            total_amount,
            payment_method || 'cash',
            subtotal - (saleItems.reduce((acc, item) => acc + (item.cost_price * item.quantity), 0)),
            created_by
        ]);

        const saleId = saleResult.rows[0].id;

        // Create sale items
        for (const item of saleItems) {
            await client.query(`
                INSERT INTO sale_items (
                    sale_id, product_id, quantity, unit_price,
                    total, tax_amount, discount_amount
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
                saleId,
                item.product_id,
                item.quantity,
                item.unit_price,
                item.total,
                item.tax,
                item.discount
            ]);
        }

        // Create invoice
        const invoiceResult = await client.query(`
            INSERT INTO invoices (
                sale_id, invoice_number, total_amount,
                status, created_by
            ) VALUES (
                $1,
                'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD($2::TEXT, 5, '0'),
                $3,
                'paid',
                $4
            )
            RETURNING id, invoice_number
        `, [saleId, saleId, total_amount, created_by]);

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            data: {
                sale_id: saleId,
                invoice_number: invoiceResult.rows[0].invoice_number,
                total_amount: total_amount,
                items: saleItems
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
// 2. CUSTOMERS
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

// Get customer by ID
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
        
        // Check if customer has sales
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
                s.invoice_number,
                p.name as product_name
            FROM customer_returns r
            LEFT JOIN customers c ON r.customer_id = c.id
            LEFT JOIN sales s ON r.sale_id = s.id
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
        const {
            customer_id,
            sale_id,
            product_id,
            quantity,
            reason,
            return_amount,
            processed_by
        } = req.body;

        if (!customer_id || !product_id || !quantity) {
            return res.status(400).json({
                error: 'Missing required fields: customer_id, product_id, quantity'
            });
        }

        await client.query('BEGIN');

        // Create return record
        const result = await client.query(`
            INSERT INTO customer_returns (
                customer_id, sale_id, product_id, quantity,
                reason, return_amount, status, processed_by, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, 'processed', $7, NOW())
            RETURNING *
        `, [customer_id, sale_id, product_id, quantity, reason, return_amount, processed_by]);

        // If associated with a sale, update sale items
        if (sale_id) {
            await client.query(`
                UPDATE sale_items 
                SET returned_quantity = COALESCE(returned_quantity, 0) + $1
                WHERE sale_id = $2 AND product_id = $3
            `, [quantity, sale_id, product_id]);
        }

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
                COALESCE(SUM(profit), 0) as total_profit,
                COALESCE(SUM(tax_amount), 0) as total_tax,
                COALESCE(SUM(discount_amount), 0) as total_discounts
            FROM sales
            WHERE DATE(created_at) = $1
        `;
        const params = [closingDate];
        let paramIndex = 2;

        if (branch_id) {
            query += ` AND branch_id = $${paramIndex}`;
            params.push(branch_id);
            paramIndex++;
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

// Close daily
router.post('/daily-closing', async (req, res) => {
    const client = await pool.connect();
    try {
        const { branch_id, closing_date, closing_by } = req.body;

        await client.query('BEGIN');

        // Get sales summary
        const salesSummary = await client.query(`
            SELECT 
                COUNT(*) as total_transactions,
                COALESCE(SUM(total_amount), 0) as total_sales,
                COALESCE(SUM(profit), 0) as total_profit,
                COALESCE(SUM(tax_amount), 0) as total_tax
            FROM sales
            WHERE DATE(created_at) = $1 AND branch_id = $2
        `, [closing_date, branch_id]);

        // Create closing record
        const result = await client.query(`
            INSERT INTO daily_closing (
                branch_id, closing_date, total_transactions,
                total_sales, total_profit, total_tax,
                closed_by, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            RETURNING *
        `, [
            branch_id,
            closing_date,
            salesSummary.rows[0].total_transactions || 0,
            salesSummary.rows[0].total_sales || 0,
            salesSummary.rows[0].total_profit || 0,
            salesSummary.rows[0].total_tax || 0,
            closing_by
        ]);

        await client.query('COMMIT');

        res.status(201).json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error closing daily:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
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
                b.name as branch_name,
                u.username as created_by_name
            FROM expenses e
            LEFT JOIN branches b ON e.branch_id = b.id
            LEFT JOIN users u ON e.created_by = u.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (start_date) {
            query += ` AND e.date >= $${paramIndex}`;
            params.push(start_date);
            paramIndex++;
        }

        if (end_date) {
            query += ` AND e.date <= $${paramIndex}`;
            params.push(end_date);
            paramIndex++;
        }

        if (branch_id) {
            query += ` AND e.branch_id = $${paramIndex}`;
            params.push(branch_id);
            paramIndex++;
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
    const client = await pool.connect();
    try {
        const {
            description,
            amount,
            category,
            date,
            branch_id,
            payment_method,
            reference,
            created_by
        } = req.body;

        if (!description || !amount || !category) {
            return res.status(400).json({
                error: 'Missing required fields: description, amount, category'
            });
        }

        await client.query('BEGIN');

        const result = await client.query(`
            INSERT INTO expenses (
                description, amount, category, date,
                branch_id, payment_method, reference,
                created_by, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            RETURNING *
        `, [description, amount, category, date || new Date(), branch_id, payment_method, reference, created_by]);

        // Create transaction record
        await client.query(`
            INSERT INTO transactions (
                type, reference_id, branch_id, amount,
                description, created_by, created_at
            ) VALUES (
                'expense', $1, $2, $3,
                'Expense: ' || $4,
                $5, NOW()
            )
        `, [result.rows[0].id, branch_id, amount, description, created_by]);

        await client.query('COMMIT');

        res.status(201).json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error adding expense:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Update expense
router.put('/expenses/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { description, amount, category, date, payment_method, reference } = req.body;
        
        const result = await pool.query(`
            UPDATE expenses 
            SET 
                description = COALESCE($1, description),
                amount = COALESCE($2, amount),
                category = COALESCE($3, category),
                date = COALESCE($4, date),
                payment_method = COALESCE($5, payment_method),
                reference = COALESCE($6, reference),
                updated_at = NOW()
            WHERE id = $7
            RETURNING *
        `, [description, amount, category, date, payment_method, reference, id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Expense not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating expense:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete expense
router.delete('/expenses/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'DELETE FROM expenses WHERE id = $1 RETURNING id',
            [id]
        );
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Expense not found' });
        }
        
        res.json({ message: 'Expense deleted successfully' });
    } catch (error) {
        console.error('Error deleting expense:', error);
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// 6. INVOICE REPORT
// =====================================================

// Get invoices with filter
router.get('/invoices', async (req, res) => {
    try {
        const { start_date, end_date, customer_id, status } = req.query;
        
        let query = `
            SELECT 
                i.*,
                c.name as customer_name,
                b.name as branch_name,
                u.username as created_by_name
            FROM invoices i
            LEFT JOIN customers c ON i.customer_id = c.id
            LEFT JOIN branches b ON i.branch_id = b.id
            LEFT JOIN users u ON i.created_by = u.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (start_date) {
            query += ` AND i.issue_date >= $${paramIndex}`;
            params.push(start_date);
            paramIndex++;
        }

        if (end_date) {
            query += ` AND i.issue_date <= $${paramIndex}`;
            params.push(end_date);
            paramIndex++;
        }

        if (customer_id) {
            query += ` AND i.customer_id = $${paramIndex}`;
            params.push(customer_id);
            paramIndex++;
        }

        if (status) {
            query += ` AND i.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        query += ` ORDER BY i.issue_date DESC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching invoices:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get single invoice
router.get('/invoices/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT 
                i.*,
                c.name as customer_name,
                c.phone as customer_phone,
                c.email as customer_email,
                b.name as branch_name,
                u.username as created_by_name,
                array_agg(
                    json_build_object(
                        'product_id', si.product_id,
                        'product_name', p.name,
                        'quantity', si.quantity,
                        'unit_price', si.unit_price,
                        'total', si.total
                    )
                ) as items
            FROM invoices i
            LEFT JOIN customers c ON i.customer_id = c.id
            LEFT JOIN branches b ON i.branch_id = b.id
            LEFT JOIN users u ON i.created_by = u.id
            LEFT JOIN sale_items si ON i.sale_id = si.sale_id
            LEFT JOIN products p ON si.product_id = p.id
            WHERE i.id = $1
            GROUP BY i.id, c.name, c.phone, c.email, b.name, u.username
        `, [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching invoice:', error);
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// 7. BRANCH STOCK TRANSFERS
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
                p.name as product_name,
                u.username as transferred_by_name
            FROM stock_transfers st
            LEFT JOIN branches fb ON st.from_branch_id = fb.id
            LEFT JOIN branches tb ON st.to_branch_id = tb.id
            LEFT JOIN products p ON st.product_id = p.id
            LEFT JOIN users u ON st.transferred_by = u.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (from_branch) {
            query += ` AND st.from_branch_id = $${paramIndex}`;
            params.push(from_branch);
            paramIndex++;
        }

        if (to_branch) {
            query += ` AND st.to_branch_id = $${paramIndex}`;
            params.push(to_branch);
            paramIndex++;
        }

        if (start_date) {
            query += ` AND st.transfer_date >= $${paramIndex}`;
            params.push(start_date);
            paramIndex++;
        }

        if (end_date) {
            query += ` AND st.transfer_date <= $${paramIndex}`;
            params.push(end_date);
            paramIndex++;
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
        const {
            from_branch_id,
            to_branch_id,
            product_id,
            quantity,
            notes,
            transferred_by
        } = req.body;

        if (!from_branch_id || !to_branch_id || !product_id || !quantity) {
            return res.status(400).json({
                error: 'Missing required fields'
            });
        }

        await client.query('BEGIN');

        // Check stock availability
        const stockCheck = await client.query(
            'SELECT quantity FROM branch_stock WHERE branch_id = $1 AND product_id = $2',
            [from_branch_id, product_id]
        );

        if (stockCheck.rowCount === 0 || stockCheck.rows[0].quantity < quantity) {
            throw new Error('Insufficient stock for transfer');
        }

        // Create transfer record
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

// Complete/confirm transfer
router.put('/transfers/:id/complete', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { confirmed_by } = req.body;

        await client.query('BEGIN');

        // Get transfer details
        const transfer = await client.query(
            'SELECT * FROM stock_transfers WHERE id = $1 AND status = $2',
            [id, 'pending']
        );

        if (transfer.rowCount === 0) {
            throw new Error('Transfer not found or already completed');
        }

        const t = transfer.rows[0];

        // Deduct from source branch
        await client.query(`
            UPDATE branch_stock 
            SET quantity = quantity - $1
            WHERE branch_id = $2 AND product_id = $3
        `, [t.quantity, t.from_branch_id, t.product_id]);

        // Add to destination branch
        const destStock = await client.query(
            'SELECT * FROM branch_stock WHERE branch_id = $1 AND product_id = $2',
            [t.to_branch_id, t.product_id]
        );

        if (destStock.rowCount === 0) {
            await client.query(`
                INSERT INTO branch_stock (branch_id, product_id, quantity)
                VALUES ($1, $2, $3)
            `, [t.to_branch_id, t.product_id, t.quantity]);
        } else {
            await client.query(`
                UPDATE branch_stock 
                SET quantity = quantity + $1
                WHERE branch_id = $2 AND product_id = $3
            `, [t.quantity, t.to_branch_id, t.product_id]);
        }

        // Update transfer status
        const result = await client.query(`
            UPDATE stock_transfers 
            SET status = 'completed', confirmed_by = $1, confirmed_at = NOW()
            WHERE id = $2
            RETURNING *
        `, [confirmed_by, id]);

        await client.query('COMMIT');

        res.json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error completing transfer:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// =====================================================
// 8. CURRENCY SETTINGS
// =====================================================

// Get currency settings
router.get('/currency-settings', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM system_settings 
            WHERE key LIKE 'currency_%'
            OR key LIKE 'currency%'
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
        
        // Update multiple settings in one transaction
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
// 9. REPORTS
// =====================================================

// Branch sales report
router.get('/reports/branch-sales', async (req, res) => {
    try {
        const { start_date, end_date, branch_id, format } = req.query;
        
        let query = `
            SELECT 
                b.name as branch_name,
                DATE(s.date) as sale_date,
                COUNT(DISTINCT s.id) as transaction_count,
                COALESCE(SUM(s.total_amount), 0) as total_sales,
                COALESCE(SUM(s.profit), 0) as total_profit,
                COALESCE(AVG(s.total_amount), 0) as avg_transaction
            FROM sales s
            LEFT JOIN branches b ON s.branch_id = b.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (start_date) {
            query += ` AND s.date >= $${paramIndex}`;
            params.push(start_date);
            paramIndex++;
        }

        if (end_date) {
            query += ` AND s.date <= $${paramIndex}`;
            params.push(end_date);
            paramIndex++;
        }

        if (branch_id) {
            query += ` AND s.branch_id = $${paramIndex}`;
            params.push(branch_id);
            paramIndex++;
        }

        query += ` GROUP BY b.name, DATE(s.date) ORDER BY sale_date DESC, b.name`;

        const result = await pool.query(query, params);
        res.json({
            data: result.rows,
            report_type: 'branch_sales',
            format: format || 'json'
        });
    } catch (error) {
        console.error('Error generating branch sales report:', error);
        res.status(500).json({ error: error.message });
    }
});

// Transfer report
router.get('/reports/transfers', async (req, res) => {
    try {
        const { start_date, end_date, format } = req.query;
        
        let query = `
            SELECT 
                st.*,
                fb.name as from_branch,
                tb.name as to_branch,
                p.name as product_name,
                u.username as transferred_by_name
            FROM stock_transfers st
            LEFT JOIN branches fb ON st.from_branch_id = fb.id
            LEFT JOIN branches tb ON st.to_branch_id = tb.id
            LEFT JOIN products p ON st.product_id = p.id
            LEFT JOIN users u ON st.transferred_by = u.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (start_date) {
            query += ` AND st.transfer_date >= $${paramIndex}`;
            params.push(start_date);
            paramIndex++;
        }

        if (end_date) {
            query += ` AND st.transfer_date <= $${paramIndex}`;
            params.push(end_date);
            paramIndex++;
        }

        query += ` ORDER BY st.transfer_date DESC`;

        const result = await pool.query(query, params);
        res.json({
            data: result.rows,
            report_type: 'transfers',
            format: format || 'json'
        });
    } catch (error) {
        console.error('Error generating transfer report:', error);
        res.status(500).json({ error: error.message });
    }
});

// Purchase Order report
router.get('/reports/purchase-orders', async (req, res) => {
    try {
        const { start_date, end_date, supplier_id, status, format } = req.query;
        
        let query = `
            SELECT 
                po.*,
                s.name as supplier_name,
                b.name as branch_name,
                u.username as created_by_name,
                (SELECT COUNT(*) FROM purchase_order_items WHERE purchase_order_id = po.id) as total_items,
                (SELECT COALESCE(SUM(quantity), 0) FROM purchase_order_items WHERE purchase_order_id = po.id) as total_quantity
            FROM purchase_orders po
            LEFT JOIN suppliers s ON po.supplier_id = s.id
            LEFT JOIN branches b ON po.branch_id = b.id
            LEFT JOIN users u ON po.created_by = u.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (start_date) {
            query += ` AND po.order_date >= $${paramIndex}`;
            params.push(start_date);
            paramIndex++;
        }

        if (end_date) {
            query += ` AND po.order_date <= $${paramIndex}`;
            params.push(end_date);
            paramIndex++;
        }

        if (supplier_id) {
            query += ` AND po.supplier_id = $${paramIndex}`;
            params.push(supplier_id);
            paramIndex++;
        }

        if (status) {
            query += ` AND po.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        query += ` ORDER BY po.order_date DESC`;

        const result = await pool.query(query, params);
        res.json({
            data: result.rows,
            report_type: 'purchase_orders',
            format: format || 'json'
        });
    } catch (error) {
        console.error('Error generating PO report:', error);
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// 10. STOCK CONTROL
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
                p.unit_price,
                p.cost_price,
                b.name as branch_name,
                (bs.quantity * p.unit_price) as stock_value
            FROM branch_stock bs
            LEFT JOIN products p ON bs.product_id = p.id
            LEFT JOIN branches b ON bs.branch_id = b.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (branch_id) {
            query += ` AND bs.branch_id = $${paramIndex}`;
            params.push(branch_id);
            paramIndex++;
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
        if (quantity !== undefined) {
            updates.push(`quantity = $1`);
        }
        if (min_stock !== undefined) {
            updates.push(`min_stock = $2`);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                error: 'No fields to update'
            });
        }

        const query = `
            UPDATE branch_stock 
            SET ${updates.join(', ')}, updated_at = NOW()
            WHERE branch_id = $${updates.length + 1} AND product_id = $${updates.length + 2}
            RETURNING *
        `;

        const values = [];
        if (quantity !== undefined) values.push(quantity);
        if (min_stock !== undefined) values.push(min_stock);
        values.push(branch_id);
        values.push(product_id);

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

module.exports = router;