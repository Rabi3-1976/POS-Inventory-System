// =====================================================
// 007_existing_schema_alignment.js
// Phase 24A-2A
// Align existing databases with the normalized schema
// =====================================================

module.exports =
{
        id: '007_existing_schema_alignment',
        description: 'Add columns required by the normalized schema to existing databases',
        up: async (client) => {

            //--------------------------------------------------
            // Add columns required by the normalized schema to existing databases
            //--------------------------------------------------
            
            await addColumnIfMissing(client, 'products', 'uom', "TEXT DEFAULT 'PCS'");
            await addColumnIfMissing(client, 'products', 'supplier_id', 'INTEGER');

            await addColumnIfMissing(client, 'purchase_orders', 'po_no', 'TEXT');
            await addColumnIfMissing(client, 'purchase_orders', 'branch_id', 'INTEGER');
            await addColumnIfMissing(client, 'purchase_orders', 'received_qty', 'INTEGER DEFAULT 0');
            await addColumnIfMissing(client, 'purchase_orders', 'cancel_reason', 'TEXT');
            await addColumnIfMissing(client, 'purchase_orders', 'cancelled_at', 'TIMESTAMP');
            await addColumnIfMissing(client, 'purchase_orders', 'remarks', 'TEXT');
            await addColumnIfMissing(client, 'purchase_orders', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');

            // Older installations stored one product directly on the PO header.
            // Keep those columns for historical reads, but make them optional so a
            // normalized header can contain any number of purchase_order_items.
            await client.query(`
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = current_schema()
                          AND table_name = 'purchase_orders'
                          AND column_name = 'product_id'
                          AND is_nullable = 'NO'
                    ) THEN
                        ALTER TABLE purchase_orders ALTER COLUMN product_id DROP NOT NULL;
                    END IF;
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = current_schema()
                          AND table_name = 'purchase_orders'
                          AND column_name = 'qty'
                          AND is_nullable = 'NO'
                    ) THEN
                        ALTER TABLE purchase_orders ALTER COLUMN qty DROP NOT NULL;
                    END IF;
                END
                $$;
            `);

            await addColumnIfMissing(client, 'purchase_order_items', 'unit_cost', 'NUMERIC DEFAULT 0');
            await addColumnIfMissing(client, 'purchase_order_items', 'received_qty', 'INTEGER DEFAULT 0');
            await addColumnIfMissing(client, 'purchase_order_items', 'line_total', 'NUMERIC DEFAULT 0');
            await addColumnIfMissing(client, 'purchase_order_items', 'remarks', 'TEXT');
            await addColumnIfMissing(client, 'purchase_order_items', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
        }
    };