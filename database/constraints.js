// =====================================================
// constraints.js
// Database CHECK Constraints
// =====================================================

async function constraintExists(pool, constraintName) {

    const result = await pool.query(
        `
        SELECT 1
        FROM pg_constraint
        WHERE conname = $1
        LIMIT 1
        `,
        [constraintName]
    );

    return result.rowCount > 0;
}

async function addConstraint(pool, constraintName, sql) {

    if (await constraintExists(pool, constraintName)) {

        console.log(`✓ Constraint exists: ${constraintName}`);
        return;

    }

    console.log(`Creating constraint: ${constraintName}`);

    await pool.query(sql);

}

async function createConstraints(pool) {

    console.log("Creating CHECK constraints...");

    //----------------------------------------------------
    // Products
    //----------------------------------------------------

    await addConstraint(
        pool,
        "chk_products_cost",
        `
        ALTER TABLE products
        ADD CONSTRAINT chk_products_cost
        CHECK (cost >= 0);
        `
    );

    await addConstraint(
        pool,
        "chk_products_price",
        `
        ALTER TABLE products
        ADD CONSTRAINT chk_products_price
        CHECK (price >= 0);
        `
    );

    //----------------------------------------------------
    // Branch Stock
    //----------------------------------------------------

    await addConstraint(
        pool,
        "chk_branch_stock_stock",
        `
        ALTER TABLE branch_stock
        ADD CONSTRAINT chk_branch_stock_stock
        CHECK (stock >= 0);
        `
    );

    await addConstraint(
        pool,
        "chk_branch_stock_min_stock",
        `
        ALTER TABLE branch_stock
        ADD CONSTRAINT chk_branch_stock_min_stock
        CHECK (min_stock >= 0);
        `
    );

    //----------------------------------------------------
    // Purchase Order Items
    //----------------------------------------------------

    await addConstraint(
        pool,
        "chk_po_items_qty",
        `
        ALTER TABLE purchase_order_items
        ADD CONSTRAINT chk_po_items_qty
        CHECK (qty > 0);
        `
    );

    //----------------------------------------------------
    // Invoice Items
    //----------------------------------------------------

    await addConstraint(
        pool,
        "chk_invoice_items_qty",
        `
        ALTER TABLE invoice_items
        ADD CONSTRAINT chk_invoice_items_qty
        CHECK (qty > 0);
        `
    );

    //----------------------------------------------------
    // Expenses
    //----------------------------------------------------

    await addConstraint(
        pool,
        "chk_expenses_amount",
        `
        ALTER TABLE expenses
        ADD CONSTRAINT chk_expenses_amount
        CHECK (amount >= 0);
        `
    );

    console.log("✓ CHECK constraints completed.");

}

module.exports = {
    createConstraints
};