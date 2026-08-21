// =====================================================
// 010_product_categories.js
// Phase 24A-2A Part 9A
// Product Categories Master Data
// =====================================================

module.exports = {
    id: "010_product_categories",

    description: "Create Product Categories master table",

    up: async (client) => {

        //--------------------------------------------------
        // Create Product Categories
        //--------------------------------------------------

        await client.query(`
            CREATE TABLE IF NOT EXISTS product_categories (
                id SERIAL PRIMARY KEY,

                category_name VARCHAR(100) NOT NULL UNIQUE,

                description TEXT,

                status BOOLEAN DEFAULT TRUE,

                display_order INTEGER DEFAULT 0,

                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        //--------------------------------------------------
        // Default Categories
        //--------------------------------------------------

        const categories = [

            "General",
            "Food",
            "Beverages",
            "Cleaning",
            "Personal Care",
            "Electronics",
            "Office Supplies",
            "Stationery",
            "Frozen",
            "Dairy",
            "Bakery",
            "Snacks",
            "Household"

        ];

        for (let i = 0; i < categories.length; i++) {

            await client.query(`
                INSERT INTO product_categories
                (
                    category_name,
                    display_order
                )
                VALUES
                (
                    $1,
                    $2
                )
                ON CONFLICT (category_name)
                DO NOTHING;
            `, [categories[i], i + 1]);

        }

        console.log("✓ Product Categories created.");

    }

};