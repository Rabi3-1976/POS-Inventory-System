/ routes/transactions.js
const express = require('express');
const router = express.Router();
const pool = require('../database'); // ← FIXED: Correct path to database.js

// =====================================================
// 1. SALE TRANSACTIONS
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

        // Validate required fields
        if (!product_id || !qty || !price || !cost) {
            return res.status(400).json({
                error: 'Missing required fields: product_id, qty, price, cost'
            });
        }

        await client.query('BEGIN');
        
        // Call the stored procedure
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

        // Validate required fields
        if (!branch_id || !product_id || !qty || !price || !cost) {
            return res.status(400).json({
                error: 'Missing required fields: branch_id, product_id, qty, price, cost'
            });
        }

        await client.query('BEGIN');
        
        // Call the stored procedure
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
// 2. VIEWS - GET ENDPOINTS
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
// 3. INVENTORY ENDPOINTS
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
// 4. DASHBOARD ENDPOINTS
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

module.exports = router;
