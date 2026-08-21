// =====================================================
// validator.js
// Database Validation Module
// =====================================================

async function validateDatabase(pool) {

    console.log("");
    console.log("==============================================");
    console.log("Validating database...");
    console.log("==============================================");

    const checks = [

        {
            name: "Duplicate Product Barcode",
            sql: `
                SELECT barcode
                FROM products
                GROUP BY barcode
                HAVING COUNT(*) > 1
            `
        },

        {
            name: "Duplicate Product Name",
            sql: `
                SELECT name
                FROM products
                GROUP BY name
                HAVING COUNT(*) > 1
            `
        },

        {
            name: "Negative Product Cost",
            sql: `
                SELECT id
                FROM products
                WHERE cost < 0
            `
        },

        {
            name: "Negative Product Price",
            sql: `
                SELECT id
                FROM products
                WHERE price < 0
            `
        },

        {
            name: "Negative Branch Stock",
            sql: `
                SELECT *
                FROM branch_stock
                WHERE stock < 0
            `
        },

        {
            name: "Negative Min Stock",
            sql: `
                SELECT *
                FROM branch_stock
                WHERE min_stock < 0
            `
        }

    ];

    let hasErrors = false;

    for (const check of checks) {

        const result = await pool.query(check.sql);

        if (result.rowCount > 0) {

            hasErrors = true;

            console.warn(`⚠ ${check.name}: ${result.rowCount} record(s)`);

        } else {

            console.log(`✓ ${check.name}`);

        }

    }

    console.log("");

    if (hasErrors) {

        console.log("Database validation completed with warnings.");

    } else {

        console.log("✓ Database validation completed successfully.");

    }

    console.log("==============================================");
    console.log("");

}

module.exports = {
    validateDatabase
};