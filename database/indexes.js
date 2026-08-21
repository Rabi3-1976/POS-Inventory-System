// =====================================================
// indexes.js
// Database Performance Indexes
// =====================================================

async function createIndexes(pool) {

    console.log("Creating database indexes...");

    const indexes = [

        // =====================================================
        // Products
        // =====================================================

        `CREATE INDEX IF NOT EXISTS idx_products_barcode
         ON products(barcode);`,

        `CREATE INDEX IF NOT EXISTS idx_products_name
         ON products(name);`,

        `CREATE INDEX IF NOT EXISTS idx_products_supplier
         ON products(supplier_id);`,

        // =====================================================
        // Customers
        // =====================================================

        `CREATE INDEX IF NOT EXISTS idx_customers_name
         ON customers(name);`,

        // =====================================================
        // Suppliers
        // =====================================================

        `CREATE INDEX IF NOT EXISTS idx_suppliers_name
         ON suppliers(name);`,

        // =====================================================
        // Sales
        // =====================================================

        `CREATE INDEX IF NOT EXISTS idx_sales_date
         ON sales(date);`,

        `CREATE INDEX IF NOT EXISTS idx_sales_customer
         ON sales(customer_id);`,

        // =====================================================
        // Branch Sales
        // =====================================================

        `CREATE INDEX IF NOT EXISTS idx_branch_sales_branch
         ON branch_sales(branch_id);`,

        `CREATE INDEX IF NOT EXISTS idx_branch_sales_date
         ON branch_sales(date);`,

        // =====================================================
        // Purchase Orders
        // =====================================================

        `CREATE INDEX IF NOT EXISTS idx_po_supplier
         ON purchase_orders(supplier_id);`,

        `CREATE INDEX IF NOT EXISTS idx_po_status
         ON purchase_orders(status);`,

         // =====================================================
        // Purchase Order Items
        // =====================================================

        `CREATE INDEX IF NOT EXISTS idx_po_items_po
        ON purchase_order_items(purchase_order_id);`,

        `CREATE INDEX IF NOT EXISTS idx_po_items_product
        ON purchase_order_items(product_id);`,

        `CREATE INDEX IF NOT EXISTS idx_po_items_received
         ON purchase_order_items(received_qty);`,

        // =====================================================
        // Branch Stock
        // =====================================================

        `CREATE INDEX IF NOT EXISTS idx_branch_stock_branch
         ON branch_stock(branch_id);`,

        `CREATE INDEX IF NOT EXISTS idx_branch_stock_product
         ON branch_stock(product_id);`,

        `CREATE INDEX IF NOT EXISTS idx_branch_stock_min_stock
         ON branch_stock(min_stock);`,

        // =====================================================
        // Invoice Items
        // =====================================================

        `CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice
         ON invoice_items(invoice_id);`,

        // =====================================================
        // Returns
        // =====================================================

        `CREATE INDEX IF NOT EXISTS idx_customer_returns_date
         ON customer_returns(date);`,

        `CREATE INDEX IF NOT EXISTS idx_supplier_returns_date
         ON supplier_returns(date);`,

        // =====================================================
        // Expenses
        // =====================================================

        `CREATE INDEX IF NOT EXISTS idx_expenses_date
         ON expenses(date);`

    ];

    for (const sql of indexes) {
        await pool.query(sql);
    }

    console.log("✓ Database indexes completed.");

}

module.exports = {
    createIndexes
};