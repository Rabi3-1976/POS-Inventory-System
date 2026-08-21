// =====================================================
// 002_branches_and_stock.js
// Phase 24A-2A
// Initial Database Schema
// =====================================================

module.exports =
{
        id: '002_branches_and_stock',
        description: 'Create branches and branch inventory',
        up: async (client) => {

            //--------------------------------------------------
            // Create Branches and Branch Stock Tables
            //--------------------------------------------------

            await client.query(`
                CREATE TABLE IF NOT EXISTS branches (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    address TEXT,
                    phone TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS branch_stock (
                    id SERIAL PRIMARY KEY,
                    branch_id INTEGER NOT NULL,
                    product_id INTEGER NOT NULL,
                    stock INTEGER DEFAULT 0,
                    min_stock INTEGER DEFAULT 0,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(branch_id, product_id)
                );
            `);
        }
    };