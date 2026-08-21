 // =====================================================
 // 008_foreign_keys.js
 // Phase 24A-2B
 // Create foreign keys, including corrected purchase-order item relationships
 // =====================================================

 module.exports =
 {
        id: '008_foreign_keys',
        description: 'Create foreign keys, including corrected purchase-order item relationships',
        up: async (client) => {

            //--------------------------------------------------
            // Create foreign keys, including corrected purchase-order item relationships
            //--------------------------------------------------
            
            await client.query(`
                DO $$
                BEGIN
                    -- Remove an old incorrectly named/misdirected product FK, if one exists.
                    IF EXISTS (
                        SELECT 1
                        FROM pg_constraint c
                        WHERE c.conname = 'fk_po_items_product'
                          AND c.conrelid = 'purchase_order_items'::regclass
                          AND c.confrelid <> 'products'::regclass
                    ) THEN
                        ALTER TABLE purchase_order_items DROP CONSTRAINT fk_po_items_product;
                    END IF;

                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'fk_products_supplier'
                          AND conrelid = 'products'::regclass
                    ) THEN
                        ALTER TABLE products ADD CONSTRAINT fk_products_supplier
                        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_po_supplier' AND conrelid = 'purchase_orders'::regclass) THEN
                        ALTER TABLE purchase_orders ADD CONSTRAINT fk_po_supplier
                        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_po_branch' AND conrelid = 'purchase_orders'::regclass) THEN
                        ALTER TABLE purchase_orders ADD CONSTRAINT fk_po_branch
                        FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;
                    END IF;

                    -- These are deliberately different constraints. Do not merge or rename them.
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_po_items_po' AND conrelid = 'purchase_order_items'::regclass) THEN
                        ALTER TABLE purchase_order_items ADD CONSTRAINT fk_po_items_po
                        FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_po_items_product' AND conrelid = 'purchase_order_items'::regclass) THEN
                        ALTER TABLE purchase_order_items ADD CONSTRAINT fk_po_items_product
                        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_branch_stock_branch' AND conrelid = 'branch_stock'::regclass) THEN
                        ALTER TABLE branch_stock ADD CONSTRAINT fk_branch_stock_branch
                        FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_branch_stock_product' AND conrelid = 'branch_stock'::regclass) THEN
                        ALTER TABLE branch_stock ADD CONSTRAINT fk_branch_stock_product
                        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_invoice_items_invoice' AND conrelid = 'invoice_items'::regclass) THEN
                        ALTER TABLE invoice_items ADD CONSTRAINT fk_invoice_items_invoice
                        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;
                    END IF;
                END
                $$;
            `);
        }
    };