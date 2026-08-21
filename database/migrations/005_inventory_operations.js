// =====================================================
// 005_inventory_operations.js
// Phase 24A-2A
// Initial Database Schema
// =====================================================

module.exports =
{
        id: '005_inventory_operations',
        description: 'Create returns, stock adjustments, and stock transfers',
        up: async (client) => {
            
            //--------------------------------------------------
            // Create Returns, Stock Adjustments, and Stock Transfers Tables
            //--------------------------------------------------

            await client.query(`
                CREATE TABLE IF NOT EXISTS customer_returns (
                    id SERIAL PRIMARY KEY,
                    invoice_id INTEGER,
                    product_id INTEGER,
                    quantity INTEGER DEFAULT 1,
                    amount NUMERIC DEFAULT 0,
                    reason TEXT,
                    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS supplier_returns (
                    id SERIAL PRIMARY KEY,
                    supplier_id INTEGER,
                    product_id INTEGER,
                    quantity INTEGER DEFAULT 1,
                    amount NUMERIC DEFAULT 0,
                    reason TEXT,
                    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS stock_adjustments (
                    id SERIAL PRIMARY KEY,
                    branch_id INTEGER,
                    product_id INTEGER,
                    quantity INTEGER NOT NULL,
                    reason TEXT,
                    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS stock_transfers (
                    id SERIAL PRIMARY KEY,
                    from_branch_id INTEGER NOT NULL,
                    to_branch_id INTEGER NOT NULL,
                    product_id INTEGER NOT NULL,
                    quantity INTEGER NOT NULL,
                    status TEXT DEFAULT 'Completed',
                    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
        }
    };