/**
 * Transaction Routes for POS Inventory System
 * Handles all business transaction operations
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../database');

/**
 * GET /api/transactions
 * Retrieve all transactions with filtering
 */
router.get('/', async (req, res) => {
    try {
        const { branch_id, start_date, end_date, type } = req.query;
        
        let query = `
            SELECT 
                t.*,
                u.username as created_by_name,
                b.name as branch_name
            FROM transactions t
            LEFT JOIN users u ON t.created_by = u.id
            LEFT JOIN branches b ON t.branch_id = b.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (branch_id) {
            query += ` AND t.branch_id = $${paramIndex}`;
            params.push(branch_id);
            paramIndex++;
        }

        if (start_date) {
            query += ` AND t.created_at >= $${paramIndex}`;
            params.push(start_date);
            paramIndex++;
        }

        if (end_date) {
            query += ` AND t.created_at <= $${paramIndex}`;
            params.push(end_date);
            paramIndex++;
        }

        if (type) {
            query += ` AND t.type = $${paramIndex}`;
            params.push(type);
            paramIndex++;
        }

        query += ` ORDER BY t.created_at DESC LIMIT 100`;

        const result = await pool.query(query, params);
        res.json({
            success: true,
            data: result.rows,
            count: result.rowCount
        });
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch transactions'
        });
    }
});

/**
 * GET /api/transactions/:id
 * Get transaction by ID
 */
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
        res.status(500).json({
            success: false,
            error: 'Failed to fetch transaction'
        });
    }
});

/**
 * POST /api/transactions/sale
 * Create a new sale transaction
 */
router.post('/sale', async (req, res) => {
    const client = await pool.connect();
    
    try {
        const {
            customer_id,
            branch_id,
            items,
            payment_method,
            discount_percent,
            tax_rate,
            created_by
        } = req.body;

        // Validate required fields
        if (!branch_id || !items || !items.length || !created_by) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: branch_id, items, created_by'
            });
        }

        await client.query('BEGIN');

        // Calculate totals
        let subtotal = 0;
        let total_tax = 0;
        let total_discount = 0;

        // Process each item
        const processedItems = [];
        for (const item of items) {
            // Get product details and check stock
            const productQuery = `
                SELECT p.*, bs.quantity as stock_quantity
                FROM products p
                LEFT JOIN branch_stock bs ON p.id = bs.product_id AND bs.branch_id = $1
                WHERE p.id = $2
            `;
            const productResult = await client.query(productQuery, [branch_id, item.product_id]);
            
            if (productResult.rowCount === 0) {
                throw new Error(`Product ${item.product_id} not found`);
            }

            const product = productResult.rows[0];
            
            // Check stock
            if (product.stock_quantity < item.quantity) {
                throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock_quantity}`);
            }

            // Calculate item totals
            const itemPrice = item.unit_price || product.unit_price;
            const itemTotal = itemPrice * item.quantity;
            const itemTax = itemTotal * (tax_rate || 0.15);
            const itemDiscount = itemTotal * (discount_percent || 0);
            
            processedItems.push({
                ...item,
                unit_price: itemPrice,
                total: itemTotal,
                tax: itemTax,
                discount: itemDiscount
            });

            subtotal += itemTotal;
            total_tax += itemTax;
            total_discount += itemDiscount;
        }

        const total_amount = subtotal + total_tax - total_discount;

        // Create sale record
        const saleQuery = `
            INSERT INTO sales (
                customer_id, branch_id, subtotal, tax_amount, 
                discount_amount, total_amount, payment_method,
                status, created_by, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', $8, NOW())
            RETURNING id
        `;
        const saleResult = await client.query(saleQuery, [
            customer_id || null,
            branch_id,
            subtotal,
            total_tax,
            total_discount,
            total_amount,
            payment_method || 'cash',
            created_by
        ]);
        const saleId = saleResult.rows[0].id;

        // Create invoice
        const invoiceQuery = `
            INSERT INTO invoices (
                sale_id, invoice_number, issue_date, due_date,
                total_amount, status, created_by
            ) VALUES (
                $1, 
                'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD($2::TEXT, 5, '0'),
                NOW(),
                NOW() + INTERVAL '30 days',
                $3,
                'pending',
                $4
            )
            RETURNING id, invoice_number
        `;
        const invoiceResult = await client.query(invoiceQuery, [
            saleId,
            saleId,
            total_amount,
            created_by
        ]);

        // Create sale items
        for (const item of processedItems) {
            const itemQuery = `
                INSERT INTO sale_items (
                    sale_id, product_id, quantity, unit_price,
                    total, tax_amount, discount_amount
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            `;
            await client.query(itemQuery, [
                saleId,
                item.product_id,
                item.quantity,
                item.unit_price,
                item.total,
                item.tax || 0,
                item.discount || 0
            ]);

            // Update stock
            const stockQuery = `
                UPDATE branch_stock 
                SET quantity = quantity - $1, updated_at = NOW()
                WHERE branch_id = $2 AND product_id = $3
            `;
            await client.query(stockQuery, [item.quantity, branch_id, item.product_id]);
        }

        // Create transaction record
        const transactionQuery = `
            INSERT INTO transactions (
                type, reference_id, branch_id, amount,
                description, created_by, created_at
            ) VALUES (
                'sale', $1, $2, $3, 
                'Sale completed with invoice ' || $4,
                $5, NOW()
            )
        `;
        await client.query(transactionQuery, [
            saleId,
            branch_id,
            total_amount,
            invoiceResult.rows[0].invoice_number,
            created_by
        ]);

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            data: {
                sale_id: saleId,
                invoice_id: invoiceResult.rows[0].id,
                invoice_number: invoiceResult.rows[0].invoice_number,
                total_amount: total_amount,
                items: processedItems
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating sale:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create sale'
        });
    } finally {
        client.release();
    }
});

/**
 * POST /api/transactions/purchase-order
 * Create purchase order
 */
router.post('/purchase-order', async (req, res) => {
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
                success: false,
                error: 'Missing required fields'
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

        // Create purchase order
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

        // Create PO items
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

        // Create transaction record
        const transactionQuery = `
            INSERT INTO transactions (
                type, reference_id, branch_id, amount,
                description, created_by, created_at
            ) VALUES (
                'purchase_order', $1, $2, $3,
                'Purchase order created: ' || $4,
                $5, NOW()
            )
        `;
        await client.query(transactionQuery, [
            poId,
            branch_id,
            subtotal,
            poResult.rows[0].po_number,
            created_by
        ]);

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
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create purchase order'
        });
    } finally {
        client.release();
    }
});

/**
 * PUT /api/transactions/purchase-order/:id/receive
 * Receive purchase order (partial or full)
 */
router.put('/purchase-order/:id/receive', async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { id } = req.params;
        const { items, received_by } = req.body;

        if (!items || !items.length || !received_by) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: items, received_by'
            });
        }

        await client.query('BEGIN');

        // Verify purchase order exists and is pending
        const poCheckQuery = `
            SELECT * FROM purchase_orders 
            WHERE id = $1 AND status IN ('pending', 'partial')
        `;
        const poCheck = await client.query(poCheckQuery, [id]);
        
        if (poCheck.rowCount === 0) {
            throw new Error('Purchase order not found or already completed');
        }

        let totalReceived = 0;
        let allReceived = true;

        for (const item of items) {
            // Check if item exists in PO
            const poItemQuery = `
                SELECT * FROM purchase_order_items 
                WHERE purchase_order_id = $1 AND product_id = $2
            `;
            const poItemResult = await client.query(poItemQuery, [id, item.product_id]);
            
            if (poItemResult.rowCount === 0) {
                throw new Error(`Product ${item.product_id} not in purchase order`);
            }

            const poItem = poItemResult.rows[0];
            const receivedQuantity = item.quantity_received || item.quantity;
            const remainingQuantity = poItem.quantity - poItem.quantity_received;

            if (receivedQuantity > remainingQuantity) {
                throw new Error(`Cannot receive more than ordered. Remaining: ${remainingQuantity}`);
            }

            if (receivedQuantity < poItem.quantity) {
                allReceived = false;
            }

            // Update PO item received quantity
            const updateQuery = `
                UPDATE purchase_order_items 
                SET quantity_received = quantity_received + $1,
                    updated_at = NOW()
                WHERE purchase_order_id = $2 AND product_id = $3
                RETURNING *
            `;
            await client.query(updateQuery, [receivedQuantity, id, item.product_id]);

            // Update branch stock
            const stockCheckQuery = `
                SELECT * FROM branch_stock 
                WHERE branch_id = $1 AND product_id = $2
            `;
            const stockCheck = await client.query(stockCheckQuery, [
                poCheck.rows[0].branch_id,
                item.product_id
            ]);

            if (stockCheck.rowCount === 0) {
                // Insert new stock record
                const insertStockQuery = `
                    INSERT INTO branch_stock (branch_id, product_id, quantity)
                    VALUES ($1, $2, $3)
                `;
                await client.query(insertStockQuery, [
                    poCheck.rows[0].branch_id,
                    item.product_id,
                    receivedQuantity
                ]);
            } else {
                // Update existing stock
                const updateStockQuery = `
                    UPDATE branch_stock 
                    SET quantity = quantity + $1, updated_at = NOW()
                    WHERE branch_id = $2 AND product_id = $3
                `;
                await client.query(updateStockQuery, [
                    receivedQuantity,
                    poCheck.rows[0].branch_id,
                    item.product_id
                ]);
            }

            totalReceived += receivedQuantity;
        }

        // Update PO status
        const status = allReceived ? 'completed' : 'partial';
        const updatePOQuery = `
            UPDATE purchase_orders 
            SET status = $1, received_at = NOW(), updated_at = NOW()
            WHERE id = $2
        `;
        await client.query(updatePOQuery, [status, id]);

        // Create receipt transaction
        const transactionQuery = `
            INSERT INTO transactions (
                type, reference_id, branch_id, amount,
                description, created_by, created_at
            ) VALUES (
                'receiving', $1, $2, $3,
                'Received items from purchase order',
                $4, NOW()
            )
        `;
        await client.query(transactionQuery, [
            id,
            poCheck.rows[0].branch_id,
            totalReceived,
            received_by
        ]);

        await client.query('COMMIT');

        res.json({
            success: true,
            data: {
                purchase_order_id: id,
                status: status,
                items_received: items.length,
                total_received: totalReceived
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error receiving purchase order:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to receive purchase order'
        });
    } finally {
        client.release();
    }
});

/**
 * DELETE /api/transactions/:id
 * Delete/rollback a transaction
 */
router.delete('/:id', async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { id } = req.params;

        await client.query('BEGIN');

        // Check if transaction exists
        const checkQuery = `SELECT * FROM transactions WHERE id = $1`;
        const checkResult = await client.query(checkQuery, [id]);
        
        if (checkResult.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Transaction not found'
            });
        }

        const transaction = checkResult.rows[0];

        // Mark as voided instead of deleting
        const voidQuery = `
            UPDATE transactions 
            SET status = 'voided', updated_at = NOW()
            WHERE id = $1
        `;
        await client.query(voidQuery, [id]);

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Transaction voided successfully'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error voiding transaction:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to void transaction'
        });
    } finally {
        client.release();
    }
});

/**
 * GET /api/transactions/reports/daily
 * Get daily transaction report
 */
router.get('/reports/daily', async (req, res) => {
    try {
        const { date, branch_id } = req.query;
        const reportDate = date || new Date().toISOString().split('T')[0];

        let query = `
            SELECT 
                DATE(t.created_at) as date,
                t.type,
                COUNT(*) as transaction_count,
                SUM(t.amount) as total_amount
            FROM transactions t
            WHERE DATE(t.created_at) = $1
        `;
        const params = [reportDate];
        let paramIndex = 2;

        if (branch_id) {
            query += ` AND t.branch_id = $${paramIndex}`;
            params.push(branch_id);
            paramIndex++;
        }

        query += ` GROUP BY DATE(t.created_at), t.type ORDER BY t.type`;

        const result = await pool.query(query, params);

        res.json({
            success: true,
            data: {
                date: reportDate,
                report: result.rows
            }
        });

    } catch (error) {
        console.error('Error generating daily report:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate report'
        });
    }
});

module.exports = router;