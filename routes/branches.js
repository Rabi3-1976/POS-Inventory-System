// routes/branches.js
const express = require('express');
const router = express.Router();
const pool = require('../database');

// Get all branches with dashboard data
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                b.*,
                COUNT(DISTINCT bs.product_id) as total_products,
                COALESCE(SUM(bs.quantity), 0) as total_stock,
                COALESCE(SUM(s.total_amount), 0) as total_sales
            FROM branches b
            LEFT JOIN branch_stock bs ON b.id = bs.branch_id
            LEFT JOIN branch_sales s ON b.id = s.branch_id
            GROUP BY b.id
            ORDER BY b.name
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching branches:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get single branch dashboard
router.get('/:id/dashboard', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(`
            SELECT 
                b.*,
                COUNT(DISTINCT bs.product_id) as total_products,
                COALESCE(SUM(bs.quantity), 0) as total_stock,
                COALESCE(SUM(s.total_amount), 0) as total_sales,
                COUNT(DISTINCT s.id) as total_transactions,
                COALESCE(SUM(s.profit), 0) as total_profit
            FROM branches b
            LEFT JOIN branch_stock bs ON b.id = bs.branch_id
            LEFT JOIN branch_sales s ON b.id = s.branch_id
            WHERE b.id = $1
            GROUP BY b.id
        `, [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Branch not found' });
        }
        
        // Get top selling products for this branch
        const topProducts = await pool.query(`
            SELECT 
                p.id,
                p.name,
                p.barcode,
                COALESCE(SUM(s.qty), 0) as total_sold,
                COALESCE(SUM(s.profit), 0) as total_profit
            FROM products p
            LEFT JOIN branch_sales s ON p.id = s.product_id AND s.branch_id = $1
            GROUP BY p.id
            ORDER BY total_sold DESC
            LIMIT 10
        `, [id]);
        
        // Get recent transactions
        const recentTransactions = await pool.query(`
            SELECT 
                s.*,
                p.name as product_name,
                b.name as branch_name
            FROM branch_sales s
            LEFT JOIN products p ON s.product_id = p.id
            LEFT JOIN branches b ON s.branch_id = b.id
            WHERE s.branch_id = $1
            ORDER BY s.date DESC
            LIMIT 20
        `, [id]);
        
        res.json({
            dashboard: result.rows[0],
            top_products: topProducts.rows,
            recent_transactions: recentTransactions.rows
        });
    } catch (error) {
        console.error('Error fetching branch dashboard:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get branch stock levels
router.get('/:id/stock', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(`
            SELECT 
                p.id,
                p.name,
                p.barcode,
                bs.quantity as stock,
                bs.min_stock,
                p.unit_price,
                p.cost_price
            FROM branch_stock bs
            JOIN products p ON bs.product_id = p.id
            WHERE bs.branch_id = $1
            ORDER BY p.name
        `, [id]);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching branch stock:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;