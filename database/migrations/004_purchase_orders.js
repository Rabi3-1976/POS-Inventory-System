// =====================================================
// 004_purchase_orders.js
// Phase 24A-2A
// Initial Database Schema
// =====================================================

module.exports =
{
        id: '004_purchase_orders',
        description: 'Create normalized purchase-order headers and line items',
        up: async (client) => {
            
            //--------------------------------------------------
            // Create Purchase Orders and Purchase Order Items Tables
            //--------------------------------------------------
            
            await client.query(`
                CREATE TABLE IF NOT EXISTS purchase_orders (
                    id SERIAL PRIMARY KEY,
                    po_no TEXT UNIQUE,
                    supplier_id INTEGER,
                    branch_id INTEGER,
                    status TEXT DEFAULT 'Open',
                    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    received_qty INTEGER DEFAULT 0,
                    cancel_reason TEXT,
                    cancelled_at TIMESTAMP,
                    remarks TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS purchase_order_items (
                    id SERIAL PRIMARY KEY,
                    purchase_order_id INTEGER NOT NULL,
                    product_id INTEGER NOT NULL,
                    qty INTEGER NOT NULL DEFAULT 1,
                    unit_cost NUMERIC DEFAULT 0,
                    received_qty INTEGER DEFAULT 0,
                    line_total NUMERIC DEFAULT 0,
                    remarks TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
        }
    };