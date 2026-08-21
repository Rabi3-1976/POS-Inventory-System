// =====================================================
// 003_sales_and_invoices.js
// Phase 24A-2A
// Initial Database Schema
// ===================================================== 

module.exports =
{
        id: '003_sales_and_invoices',
        description: 'Create sales, branch-sales, invoices, and invoice items',
        up: async (client) => {
            
            //--------------------------------------------------
            // Create Sales, Branch Sales, Invoices, and Invoice Items Tables
            //-------------------------------------------------- 

            await client.query(`
                CREATE TABLE IF NOT EXISTS sales (
                    id SERIAL PRIMARY KEY,
                    product_id INTEGER,
                    customer_id INTEGER,
                    quantity INTEGER DEFAULT 1,
                    price NUMERIC DEFAULT 0,
                    total NUMERIC DEFAULT 0,
                    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS branch_sales (
                    id SERIAL PRIMARY KEY,
                    branch_id INTEGER NOT NULL,
                    product_id INTEGER,
                    customer_id INTEGER,
                    quantity INTEGER DEFAULT 1,
                    price NUMERIC DEFAULT 0,
                    total NUMERIC DEFAULT 0,
                    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS invoices (
                    id SERIAL PRIMARY KEY,
                    invoice_no TEXT UNIQUE,
                    customer_id INTEGER,
                    branch_id INTEGER,
                    total NUMERIC DEFAULT 0,
                    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS invoice_items (
                    id SERIAL PRIMARY KEY,
                    invoice_id INTEGER NOT NULL,
                    product_id INTEGER,
                    quantity INTEGER DEFAULT 1,
                    price NUMERIC DEFAULT 0,
                    total NUMERIC DEFAULT 0
                );
            `);
        }
    };