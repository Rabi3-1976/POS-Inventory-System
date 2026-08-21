// =====================================================
// 012_foreign_key_indexes.js
// Phase 24A-2D
// Foreign Key Performance Indexes
// =====================================================

module.exports = {

    id: "012_foreign_key_indexes",

    description: "Create indexes for all foreign key columns",

    async up(client) {

        console.log("Applying Migration 012 - Foreign Key Indexes...");

        await client.query(`

DO $$

BEGIN

    --------------------------------------------------
    -- PRODUCTS
    --------------------------------------------------

    CREATE INDEX IF NOT EXISTS idx_products_supplier
    ON products(supplier_id);

    --------------------------------------------------
    -- BRANCH STOCK
    --------------------------------------------------

    CREATE INDEX IF NOT EXISTS idx_branch_stock_branch
    ON branch_stock(branch_id);

    CREATE INDEX IF NOT EXISTS idx_branch_stock_product
    ON branch_stock(product_id);

    --------------------------------------------------
    -- SALES
    --------------------------------------------------

    CREATE INDEX IF NOT EXISTS idx_sales_product
    ON sales(product_id);

    CREATE INDEX IF NOT EXISTS idx_sales_customer
    ON sales(customer_id);

    --------------------------------------------------
    -- BRANCH SALES
    --------------------------------------------------

    CREATE INDEX IF NOT EXISTS idx_branch_sales_branch
    ON branch_sales(branch_id);

    CREATE INDEX IF NOT EXISTS idx_branch_sales_product
    ON branch_sales(product_id);

    CREATE INDEX IF NOT EXISTS idx_branch_sales_customer
    ON branch_sales(customer_id);

    --------------------------------------------------
    -- INVOICES
    --------------------------------------------------

    CREATE INDEX IF NOT EXISTS idx_invoices_customer
    ON invoices(customer_id);

    CREATE INDEX IF NOT EXISTS idx_invoices_branch
    ON invoices(branch_id);

    --------------------------------------------------
    -- INVOICE ITEMS
    --------------------------------------------------

    CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice
    ON invoice_items(invoice_id);

    CREATE INDEX IF NOT EXISTS idx_invoice_items_product
    ON invoice_items(product_id);

    --------------------------------------------------
    -- PURCHASE ORDERS
    --------------------------------------------------

    CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier
    ON purchase_orders(supplier_id);

    CREATE INDEX IF NOT EXISTS idx_purchase_orders_branch
    ON purchase_orders(branch_id);

    --------------------------------------------------
    -- PURCHASE ORDER ITEMS
    --------------------------------------------------

    CREATE INDEX IF NOT EXISTS idx_po_items_po
    ON purchase_order_items(purchase_order_id);

    CREATE INDEX IF NOT EXISTS idx_po_items_product
    ON purchase_order_items(product_id);

END

$$;

        `);

        console.log("✓ Migration 012 - Foreign Key Indexes completed.");

    }

};