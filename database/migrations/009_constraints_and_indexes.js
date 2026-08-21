 // =====================================================
 // 009_constraints_and_indexes.js
 // Phase 24A-2B
 // Create data checks and performance indexes
 // =====================================================

module.exports =
{
        id: '009_constraints_and_indexes',
        description: 'Create data checks and performance indexes',
        up: async (client) => {
            //--------------------------------------------------
            // Create data checks and performance indexes
            //--------------------------------------------------

            await client.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_products_cost') THEN
                        ALTER TABLE products ADD CONSTRAINT chk_products_cost CHECK (cost >= 0);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_products_price') THEN
                        ALTER TABLE products ADD CONSTRAINT chk_products_price CHECK (price >= 0);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_branch_stock_stock') THEN
                        ALTER TABLE branch_stock ADD CONSTRAINT chk_branch_stock_stock CHECK (stock >= 0);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_branch_stock_min_stock') THEN
                        ALTER TABLE branch_stock ADD CONSTRAINT chk_branch_stock_min_stock CHECK (min_stock >= 0);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_po_items_qty') THEN
                        ALTER TABLE purchase_order_items ADD CONSTRAINT chk_po_items_qty CHECK (qty > 0);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_po_items_received_qty') THEN
                        ALTER TABLE purchase_order_items ADD CONSTRAINT chk_po_items_received_qty CHECK (received_qty >= 0 AND received_qty <= qty);
                    END IF;
                END
                $$;

                CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
                CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
                CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
                CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
                CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
                CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
                CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
                CREATE INDEX IF NOT EXISTS idx_branch_sales_branch ON branch_sales(branch_id);
                CREATE INDEX IF NOT EXISTS idx_branch_sales_date ON branch_sales(date);
                CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
                CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
                CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(purchase_order_id);
                CREATE INDEX IF NOT EXISTS idx_po_items_product ON purchase_order_items(product_id);
                CREATE INDEX IF NOT EXISTS idx_po_items_received ON purchase_order_items(received_qty);
                CREATE INDEX IF NOT EXISTS idx_branch_stock_branch ON branch_stock(branch_id);
                CREATE INDEX IF NOT EXISTS idx_branch_stock_product ON branch_stock(product_id);
                CREATE INDEX IF NOT EXISTS idx_branch_stock_min_stock ON branch_stock(min_stock);
                CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
                CREATE INDEX IF NOT EXISTS idx_customer_returns_date ON customer_returns(date);
                CREATE INDEX IF NOT EXISTS idx_supplier_returns_date ON supplier_returns(date);
                CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
            `);
        }
    };