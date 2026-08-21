// =====================================================
// 006_settings_and_finance.js
// Phase 24A-2A
// Initial Database Schema
// =====================================================

module.exports =
{
        id: '006_settings_and_finance',
        description: 'Create settings, expenses, and profit transfers',
        up: async (client) => {

            //--------------------------------------------------
            // Create Settings, Expenses, and Profit Transfers Tables
            //--------------------------------------------------
            
            await client.query(`
                CREATE TABLE IF NOT EXISTS settings (
                    id SERIAL PRIMARY KEY,
                    key TEXT UNIQUE NOT NULL,
                    value TEXT,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS expenses (
                    id SERIAL PRIMARY KEY,
                    description TEXT,
                    amount NUMERIC NOT NULL DEFAULT 0,
                    branch_id INTEGER,
                    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS profit_transfers (
                    id SERIAL PRIMARY KEY,
                    branch_id INTEGER,
                    amount NUMERIC NOT NULL DEFAULT 0,
                    remarks TEXT,
                    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
        }
    };