// routes/products.js
const express = require('express');
const router = express.Router();
const pool = require('../database');

// Get all products
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                p.*,
                c.name as category_name,
                COALESCE(SUM(bs.quantity), 0) as total_stock
            FROM products p
            LEFT JOIN product_categories c ON p.category_id = c.id
            LEFT JOIN branch_stock bs ON p.id = bs.product_id
            GROUP BY p.id, c.name
            ORDER BY p.name
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: error.message });
    }
});

// Search product by barcode
router.get('/search/:barcode', async (req, res) => {
    try {
        const { barcode } = req.params;
        
        const result = await pool.query(`
            SELECT 
                p.*,
                c.name as category_name,
                COALESCE(SUM(bs.quantity), 0) as total_stock
            FROM products p
            LEFT JOIN product_categories c ON p.category_id = c.id
            LEFT JOIN branch_stock bs ON p.id = bs.product_id
            WHERE p.barcode = $1
            GROUP BY p.id, c.name
        `, [barcode]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error searching product:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add new product
router.post('/', async (req, res) => {
    const client = await pool.connect();
    try {
        const {
            name,
            barcode,
            category_id,
            unit_price,
            cost_price,
            uom,
            description
        } = req.body;

        // Validate required fields
        if (!name || !barcode || !unit_price) {
            return res.status(400).json({
                error: 'Missing required fields: name, barcode, unit_price'
            });
        }

        await client.query('BEGIN');

        // Check if barcode already exists
        const checkBarcode = await client.query(
            'SELECT id FROM products WHERE barcode = $1',
            [barcode]
        );

        if (checkBarcode.rowCount > 0) {
            return res.status(400).json({ error: 'Barcode already exists' });
        }

        const result = await client.query(`
            INSERT INTO products (
                name, barcode, category_id, unit_price, 
                cost_price, uom, description, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            RETURNING *
        `, [name, barcode, category_id, unit_price, cost_price, uom, description]);

        await client.query('COMMIT');
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error adding product:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Update product
router.put('/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { name, unit_price, cost_price, uom, category_id, description } = req.body;

        await client.query('BEGIN');

        const result = await client.query(`
            UPDATE products 
            SET 
                name = COALESCE($1, name),
                unit_price = COALESCE($2, unit_price),
                cost_price = COALESCE($3, cost_price),
                uom = COALESCE($4, uom),
                category_id = COALESCE($5, category_id),
                description = COALESCE($6, description),
                updated_at = NOW()
            WHERE id = $7
            RETURNING *
        `, [name, unit_price, cost_price, uom, category_id, description, id]);

        await client.query('COMMIT');

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating product:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Delete product
router.delete('/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;

        await client.query('BEGIN');

        // Check if product has sales or stock
        const checkStock = await client.query(
            'SELECT COUNT(*) as count FROM branch_stock WHERE product_id = $1',
            [id]
        );

        if (parseInt(checkStock.rows[0].count) > 0) {
            return res.status(400).json({
                error: 'Cannot delete product with existing stock. Remove stock first.'
            });
        }

        const checkSales = await client.query(
            'SELECT COUNT(*) as count FROM sales WHERE product_id = $1',
            [id]
        );

        if (parseInt(checkSales.rows[0].count) > 0) {
            return res.status(400).json({
                error: 'Cannot delete product with sales history. Archive instead.'
            });
        }

        const result = await client.query(
            'DELETE FROM products WHERE id = $1 RETURNING id',
            [id]
        );

        await client.query('COMMIT');

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json({ message: 'Product deleted successfully', id });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting product:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Receive products (import/stock receiving)
router.post('/receive', async (req, res) => {
    const client = await pool.connect();
    try {
        const {
            product_id,
            branch_id,
            quantity,
            unit_cost,
            supplier_id,
            received_by,
            notes
        } = req.body;

        if (!product_id || !branch_id || !quantity) {
            return res.status(400).json({
                error: 'Missing required fields: product_id, branch_id, quantity'
            });
        }

        await client.query('BEGIN');

        // Check if product exists
        const productCheck = await client.query(
            'SELECT * FROM products WHERE id = $1',
            [product_id]
        );

        if (productCheck.rowCount === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Update or insert branch stock
        const stockCheck = await client.query(
            'SELECT * FROM branch_stock WHERE branch_id = $1 AND product_id = $2',
            [branch_id, product_id]
        );

        if (stockCheck.rowCount === 0) {
            // Insert new stock record
            await client.query(`
                INSERT INTO branch_stock (branch_id, product_id, quantity)
                VALUES ($1, $2, $3)
            `, [branch_id, product_id, quantity]);
        } else {
            // Update existing stock
            await client.query(`
                UPDATE branch_stock 
                SET quantity = quantity + $1, updated_at = NOW()
                WHERE branch_id = $2 AND product_id = $3
            `, [quantity, branch_id, product_id]);
        }

        // Record the receiving transaction
        await client.query(`
            INSERT INTO stock_adjustments (
                product_id, branch_id, quantity, type,
                reference, notes, created_by, created_at
            ) VALUES ($1, $2, $3, 'receive', $4, $5, $6, NOW())
        `, [product_id, branch_id, quantity, supplier_id || 'manual', notes, received_by]);

        // Update product cost if provided
        if (unit_cost) {
            await client.query(`
                UPDATE products 
                SET cost_price = $1, updated_at = NOW()
                WHERE id = $2
            `, [unit_cost, product_id]);
        }

        await client.query('COMMIT');

        res.status(201).json({
            message: 'Products received successfully',
            product_id,
            branch_id,
            quantity
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error receiving products:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Import products (bulk)
router.post('/import', async (req, res) => {
    const client = await pool.connect();
    try {
        const { products } = req.body;

        if (!products || !products.length) {
            return res.status(400).json({
                error: 'No products to import'
            });
        }

        await client.query('BEGIN');

        let imported = 0;
        let errors = [];

        for (const product of products) {
            try {
                const {
                    name,
                    barcode,
                    category_id,
                    unit_price,
                    cost_price,
                    uom,
                    description
                } = product;

                // Check if product exists by barcode
                const check = await client.query(
                    'SELECT id FROM products WHERE barcode = $1',
                    [barcode]
                );

                if (check.rowCount === 0) {
                    await client.query(`
                        INSERT INTO products (
                            name, barcode, category_id, unit_price,
                            cost_price, uom, description, created_at
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                    `, [name, barcode, category_id, unit_price, cost_price, uom, description]);
                    imported++;
                } else {
                    // Update existing product
                    await client.query(`
                        UPDATE products 
                        SET 
                            name = COALESCE($1, name),
                            unit_price = COALESCE($2, unit_price),
                            cost_price = COALESCE($3, cost_price),
                            uom = COALESCE($4, uom),
                            updated_at = NOW()
                        WHERE barcode = $5
                    `, [name, unit_price, cost_price, uom, barcode]);
                    imported++;
                }
            } catch (err) {
                errors.push({
                    product: product.name || 'Unknown',
                    error: err.message
                });
            }
        }

        await client.query('COMMIT');

        res.json({
            message: `Imported ${imported} products successfully`,
            imported,
            errors
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error importing products:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

module.exports = router;