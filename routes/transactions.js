// routes/transactions.js
const express = require('express');
const router = express.Router();
const pool = require('../database');

// =====================================================
// 1. SALE TRANSACTIONS (Your Existing Code)
// =====================================================

// Process a sale
router.post('/sales', async (req, res) => {
    const client = await pool.connect();
    try {
        const {
            product_id,
            qty,
            price,
            cost,
            customer_id = null,
            date = new Date().toISOString().split('T')[0]
        } = req.body;

        if (!product_id || !qty || !price || !cost) {
            return res.status(400).json({
                error: 'Missing required fields: product_id, qty, price, cost'
            });
        }

        await client.query('BEGIN');
        await client.query(
            `CALL process_sale($1, $2, $3, $4, $5, $6)`,
            [product_id, qty, price, cost, customer_id, date]
        );
        await client.query('COMMIT');
        
        res.status(201).json({
            message: 'Sale processed successfully',
            data: { product_id, qty, price, cost, customer_id, date }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error processing sale:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Process a branch sale
router.post('/branch-sales', async (req, res) => {
    const client = await pool.connect();
    try {
        const {
            branch_id,
            product_id,
            qty,
            price,
            cost,
            customer_id = null,
            date = new Date().toISOString().split('T')[0]
        } = req.body;

        if (!branch_id || !product_id || !qty || !price || !cost) {
            return res.status(400).json({
                error: 'Missing required fields: branch_id, product_id, qty, price, cost'
            });
        }

        await client.query('BEGIN');
        await client.query(
            `CALL process_branch_sale($1, $2, $3, $4, $5, $6, $7)`,
            [branch_id, product_id, qty, price, cost, customer_id, date]
        );
        await client.query('COMMIT');
        
        res.status(201).json({
            message: 'Branch sale processed successfully',
            data: { branch_id, product_id, qty, price, cost, customer_id, date }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error processing branch sale:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// =====================================================
// 2. PURCHASE ORDER TRANSACTIONS (NEW)
// =====================================================

// Create a purchase order
router.post('/purchase-orders', async (req, res) => {
    const client = await pool.connect();
    try {
        const {
            supplier_id,
            branch_id,
            items,
            expected_delivery,
            created_by
        } = req.body;

        if (!supplier_id || !branch_id || !items || !items.length || !created_by) {
            return res.status(400).json({
                error: 'Missing required fields: supplier_id, branch_id, items, created_by'
            });
        }

        await client.query('BEGIN');

        let subtotal = 0;
        const processedItems = [];

        for (const item of items) {
            const productQuery = `SELECT * FROM products WHERE id = $1`;
            const productResult = await client.query(productQuery, [item.product_id]);
            
            if (productResult.rowCount === 0) {
                throw new Error(`Product ${item.product_id} not found`);
            }

            const product = productResult.rows[0];
            const itemTotal = item.quantity * item.unit_price;
            
            processedItems.push({
                ...item,
                total: itemTotal
            });

            subtotal += itemTotal;
        }

        const poQuery = `
            INSERT INTO purchase_orders (
                supplier_id, branch_id, order_date, expected_delivery,
                subtotal, total_amount, status, created_by
            ) VALUES ($1, $2, NOW(), $3, $4, $4, 'pending', $5)
            RETURNING id, po_number
        `;
        const poResult = await client.query(poQuery, [
            supplier_id,
            branch_id,
            expected_delivery,
            subtotal,
            created_by
        ]);
        const poId = poResult.rows[0].id;

        for (const item of processedItems) {
            const itemQuery = `
                INSERT INTO purchase_order_items (
                    purchase_order_id, product_id, quantity,
                    unit_price, total
                ) VALUES ($1, $2, $3, $4, $5)
            `;
            await client.query(itemQuery, [
                poId,
                item.product_id,
                item.quantity,
                item.unit_price,
                item.total
            ]);
        }

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            data: {
                purchase_order_id: poId,
                po_number: poResult.rows[0].po_number,
                total_amount: subtotal
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating purchase order:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// routes/transactions.js - FIXED VERSION

/**
 * RECEIVE PURCHASE ORDER (FIXED)
 * PUT /api/transactions/purchase-orders/:id/receive
 */
router.put('/purchase-orders/:id/receive', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { items, received_by } = req.body;

        console.log(`📦 Receiving PO #${id}`, { items, received_by });

        if (!items || !items.length || !received_by) {
            return res.status(400).json({
                error: 'Missing required fields: items, received_by'
            });
        }

        await client.query('BEGIN');

        // 1. Check if purchase order exists and is not completed
        const poCheckQuery = `
            SELECT id, branch_id, status, po_number 
            FROM purchase_orders 
            WHERE id = $1
        `;
        const poCheck = await client.query(poCheckQuery, [id]);
        
        if (poCheck.rowCount === 0) {
            throw new Error('Purchase order not found');
        }

        const po = poCheck.rows[0];

        if (po.status === 'completed') {
            throw new Error('Purchase order already completed');
        }

        // 2. Get all items for this PO
        const poItemsQuery = `
            SELECT 
                id,
                product_id,
                quantity,
                COALESCE(quantity_received, 0) as quantity_received
            FROM purchase_order_items 
            WHERE purchase_order_id = $1
        `;
        const poItemsResult = await client.query(poItemsQuery, [id]);
        
        console.log('📋 PO Items:', poItemsResult.rows);

        if (poItemsResult.rowCount === 0) {
            throw new Error('No items found for this purchase order');
        }

        // 3. Create a map of PO items for easy lookup
        const poItemsMap = {};
        poItemsResult.rows.forEach(item => {
            poItemsMap[item.product_id] = item;
        });

        // 4. Process each received item
        let totalReceived = 0;
        let allReceived = true;
        const receivedItems = [];

        for (const receivedItem of items) {
            const { product_id, quantity_received } = receivedItem;
            
            // Check if product exists in PO
            if (!poItemsMap[product_id]) {
                throw new Error(`Product ${product_id} not found in purchase order`);
            }

            const poItem = poItemsMap[product_id];
            const remaining = poItem.quantity - poItem.quantity_received;
            
            console.log(`📊 Product ${product_id}: Ordered=${poItem.quantity}, Received=${poItem.quantity_received}, Remaining=${remaining}, Receiving=${quantity_received}`);

            // Validate quantity
            if (quantity_received > remaining) {
                throw new Error(
                    `Cannot receive ${quantity_received} units of product ${product_id}. ` +
                    `Only ${remaining} units remaining to receive`
                );
            }

            if (quantity_received <= 0) {
                throw new Error(`Quantity received must be greater than 0 for product ${product_id}`);
            }

            // Update PO item received quantity
            const updateQuery = `
                UPDATE purchase_order_items 
                SET quantity_received = quantity_received + $1,
                    updated_at = NOW()
                WHERE purchase_order_id = $2 AND product_id = $3
                RETURNING *
            `;
            const updateResult = await client.query(updateQuery, [
                quantity_received,
                id,
                product_id
            ]);

            console.log('✅ Updated PO item:', updateResult.rows[0]);

            // Update branch stock
            const branchId = po.branch_id;
            
            // Check if stock record exists
            const stockCheck = await client.query(`
                SELECT * FROM branch_stock 
                WHERE branch_id = $1 AND product_id = $2
            `, [branchId, product_id]);

            if (stockCheck.rowCount === 0) {
                // Insert new stock record
                await client.query(`
                    INSERT INTO branch_stock (branch_id, product_id, quantity)
                    VALUES ($1, $2, $3)
                `, [branchId, product_id, quantity_received]);
                console.log(`✅ Created new stock record for product ${product_id}`);
            } else {
                // Update existing stock
                await client.query(`
                    UPDATE branch_stock 
                    SET quantity = quantity + $1, updated_at = NOW()
                    WHERE branch_id = $2 AND product_id = $3
                `, [quantity_received, branchId, product_id]);
                console.log(`✅ Updated stock for product ${product_id}: +${quantity_received}`);
            }

            totalReceived += quantity_received;
            receivedItems.push({
                product_id,
                quantity_received,
                new_total_received: poItem.quantity_received + quantity_received
            });

            // Check if all items are fully received
            const updatedPoItem = updateResult.rows[0];
            if (updatedPoItem.quantity_received < updatedPoItem.quantity) {
                allReceived = false;
            }
        }

        // 5. Update PO status
        const newStatus = allReceived ? 'completed' : 'partial';
        await client.query(`
            UPDATE purchase_orders 
            SET status = $1, 
                received_at = NOW(), 
                updated_at = NOW()
            WHERE id = $2
        `, [newStatus, id]);

        console.log(`📦 PO #${id} status updated to: ${newStatus}`);

        // 6. Create transaction record
        await client.query(`
            INSERT INTO transactions (
                type, 
                reference_id, 
                branch_id, 
                amount,
                description, 
                created_by, 
                created_at
            ) VALUES (
                'purchase_receiving', 
                $1, 
                $2, 
                $3,
                'Received items from PO #' || $4,
                $5, 
                NOW()
            )
        `, [id, po.branch_id, totalReceived, po.po_number, received_by]);

        await client.query('COMMIT');

        console.log('✅ Receiving completed successfully!');

        res.json({
            success: true,
            data: {
                purchase_order_id: id,
                po_number: po.po_number,
                status: newStatus,
                items_received: receivedItems.length,
                total_received: totalReceived,
                all_received: allReceived
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error receiving purchase order:', error);
        res.status(500).json({ 
            success: false,
            error: error.message || 'Failed to receive purchase order'
        });
    } finally {
        client.release();
    }
});

// =====================================================
// 3. VIEWS - GET ENDPOINTS (Your Existing Code)
// =====================================================

// Get sales summary
router.get('/sales-summary', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM v_sales_summary 
            ORDER BY date DESC
            LIMIT 100
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching sales summary:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get branch sales summary
router.get('/branch-sales-summary', async (req, res) => {
    try {
        const { branch_id } = req.query;
        let query = `SELECT * FROM v_branch_sales_summary ORDER BY date DESC`;
        const params = [];
        
        if (branch_id) {
            query = `SELECT * FROM v_branch_sales_summary WHERE branch_id = $1 ORDER BY date DESC`;
            params.push(branch_id);
        }
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching branch sales summary:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get product sales performance
router.get('/product-performance', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM v_product_sales_performance 
            ORDER BY total_sold DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching product performance:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get purchase order status
router.get('/purchase-orders', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM v_purchase_order_status 
            ORDER BY po_id DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching purchase orders:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get customer purchase history
router.get('/customer-history', async (req, res) => {
    try {
        const { customer_id } = req.query;
        let query = `SELECT * FROM v_customer_purchase_history`;
        const params = [];
        
        if (customer_id) {
            query = `SELECT * FROM v_customer_purchase_history WHERE customer_id = $1`;
            params.push(customer_id);
        }
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching customer history:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get daily sales report
router.get('/daily-report', async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        let query = `SELECT * FROM v_daily_sales_report`;
        const params = [];
        let conditions = [];
        
        if (start_date) {
            conditions.push(`sale_date >= $${params.length + 1}`);
            params.push(start_date);
        }
        
        if (end_date) {
            conditions.push(`sale_date <= $${params.length + 1}`);
            params.push(end_date);
        }
        
        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching daily report:', error);
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// 4. INVENTORY ENDPOINTS (Your Existing Code)
// =====================================================

// Get branch stock
router.get('/branch-stock', async (req, res) => {
    try {
        const { branch_id, product_id } = req.query;
        let query = `
            SELECT 
                bs.branch_id,
                b.name AS branch_name,
                bs.product_id,
                p.name AS product_name,
                p.barcode,
                bs.stock,
                bs.min_stock
            FROM branch_stock bs
            LEFT JOIN branches b ON bs.branch_id = b.id
            LEFT JOIN products p ON bs.product_id = p.id
        `;
        const params = [];
        const conditions = [];
        
        if (branch_id) {
            conditions.push(`bs.branch_id = $${params.length + 1}`);
            params.push(branch_id);
        }
        
        if (product_id) {
            conditions.push(`bs.product_id = $${params.length + 1}`);
            params.push(product_id);
        }
        
        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }
        
        query += ` ORDER BY b.name, p.name`;
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching branch stock:', error);
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// 5. DASHBOARD ENDPOINTS (Your Existing Code)
// =====================================================

// Get dashboard statistics
router.get('/dashboard/stats', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM products) AS total_products,
                (SELECT COUNT(*) FROM customers) AS total_customers,
                (SELECT COUNT(*) FROM suppliers) AS total_suppliers,
                (SELECT COUNT(*) FROM branches) AS total_branches,
                (SELECT COALESCE(SUM(profit), 0) FROM sales) AS total_profit,
                (SELECT COUNT(*) FROM sales) AS total_sales,
                (SELECT COUNT(*) FROM purchase_orders WHERE status = 'Pending') AS pending_orders
        `);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// 6. SINGLE TRANSACTION LOOKUP (NEW)
// =====================================================

// Get transaction by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const query = `
            SELECT 
                t.*,
                u.username as created_by_name,
                b.name as branch_name
            FROM transactions t
            LEFT JOIN users u ON t.created_by = u.id
            LEFT JOIN branches b ON t.branch_id = b.id
            WHERE t.id = $1
        `;
        
        const result = await pool.query(query, [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Transaction not found'
            });
        }
        
        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error fetching transaction:', error);
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// 7. TRANSACTION VOID (NEW)
// =====================================================

// Void/delete a transaction
router.delete('/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;

        await client.query('BEGIN');

        const checkQuery = `SELECT * FROM transactions WHERE id = $1`;
        const checkResult = await client.query(checkQuery, [id]);
        
        if (checkResult.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Transaction not found'
            });
        }

        await client.query(`
            UPDATE transactions 
            SET status = 'voided', updated_at = NOW()
            WHERE id = $1
        `, [id]);

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Transaction voided successfully'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error voiding transaction:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// =====================================================
// FIXED: RECEIVE PURCHASE ORDER
// =====================================================

// Receive purchase order (partial or full)
router.put('/purchase-orders/:id/receive', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { items, received_by } = req.body;

        console.log(`📦 Receiving PO #${id}`, { items, received_by });

        if (!items || !items.length || !received_by) {
            return res.status(400).json({
                error: 'Missing required fields: items, received_by'
            });
        }

        await client.query('BEGIN');

        // Check if purchase order exists
        const poCheckQuery = `
            SELECT id, branch_id, status, po_number 
            FROM purchase_orders 
            WHERE id = $1
        `;
        const poCheck = await client.query(poCheckQuery, [id]);
        
        if (poCheck.rowCount === 0) {
            throw new Error('Purchase order not found');
        }

        const po = poCheck.rows[0];

        if (po.status === 'completed') {
            throw new Error('Purchase order already completed');
        }

        // Get all items for this PO
        const poItemsQuery = `
            SELECT 
                id,
                product_id,
                quantity,
                COALESCE(quantity_received, 0) as quantity_received
            FROM purchase_order_items 
            WHERE purchase_order_id = $1
        `;
        const poItemsResult = await client.query(poItemsQuery, [id]);
        
        console.log('📋 PO Items:', poItemsResult.rows);

        if (poItemsResult.rowCount === 0) {
            throw new Error('No pending items found for this PO');
        }

        // Process each received item
        let totalReceived = 0;
        let allReceived = true;
        const receivedItems = [];

        for (const receivedItem of items) {
            const { product_id, quantity_received } = receivedItem;
            
            // Find matching PO item
            const poItem = poItemsResult.rows.find(item => item.product_id === product_id);
            
            if (!poItem) {
                throw new Error(`Product ${product_id} not found in purchase order`);
            }

            const remaining = poItem.quantity - poItem.quantity_received;
            
            console.log(`📊 Product ${product_id}: Ordered=${poItem.quantity}, Received=${poItem.quantity_received}, Remaining=${remaining}, Receiving=${quantity_received}`);

            if (quantity_received > remaining) {
                throw new Error(
                    `Cannot receive ${quantity_received} units. ` +
                    `Only ${remaining} units remaining`
                );
            }

            if (quantity_received <= 0) {
                throw new Error(`Quantity must be greater than 0`);
            }

            // Update PO item
            const updateQuery = `
                UPDATE purchase_order_items 
                SET quantity_received = COALESCE(quantity_received, 0) + $1,
                    updated_at = NOW()
                WHERE purchase_order_id = $2 AND product_id = $3
                RETURNING *
            `;
            const updateResult = await client.query(updateQuery, [
                quantity_received,
                id,
                product_id
            ]);

            console.log('✅ Updated PO item:', updateResult.rows[0]);

            // Update branch stock
            const branchId = po.branch_id;
            
            const stockCheck = await client.query(`
                SELECT * FROM branch_stock 
                WHERE branch_id = $1 AND product_id = $2
            `, [branchId, product_id]);

            if (stockCheck.rowCount === 0) {
                await client.query(`
                    INSERT INTO branch_stock (branch_id, product_id, quantity)
                    VALUES ($1, $2, $3)
                `, [branchId, product_id, quantity_received]);
            } else {
                await client.query(`
                    UPDATE branch_stock 
                    SET quantity = quantity + $1, updated_at = NOW()
                    WHERE branch_id = $2 AND product_id = $3
                `, [quantity_received, branchId, product_id]);
            }

            totalReceived += quantity_received;
            receivedItems.push({
                product_id,
                quantity_received
            });

            // Check if all items are fully received
            const updatedItem = updateResult.rows[0];
            if (updatedItem.quantity_received < updatedItem.quantity) {
                allReceived = false;
            }
        }

        // Update PO status
        const newStatus = allReceived ? 'completed' : 'partial';
        await client.query(`
            UPDATE purchase_orders 
            SET status = $1, 
                received_at = NOW(), 
                updated_at = NOW()
            WHERE id = $2
        `, [newStatus, id]);

        // Create transaction record
        await client.query(`
            INSERT INTO transactions (
                type, 
                reference_id, 
                branch_id, 
                amount,
                description, 
                created_by, 
                created_at
            ) VALUES (
                'purchase_receiving', 
                $1, 
                $2, 
                $3,
                'Received items from PO #' || $4,
                $5, 
                NOW()
            )
        `, [id, po.branch_id, totalReceived, po.po_number, received_by]);

        await client.query('COMMIT');

        console.log('✅ Receiving completed successfully!');

        res.json({
            success: true,
            data: {
                purchase_order_id: id,
                po_number: po.po_number,
                status: newStatus,
                items_received: receivedItems.length,
                total_received: totalReceived,
                all_received: allReceived
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error receiving purchase order:', error);
        res.status(500).json({ 
            success: false,
            error: error.message || 'Failed to receive purchase order'
        });
    } finally {
        client.release();
    }
});

module.exports = router;