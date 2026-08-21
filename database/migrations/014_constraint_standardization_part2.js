// =====================================================
// 014_constraint_standardization_part2.js
// Phase 10A-2C-2
// NOT NULL, DEFAULT, and UNIQUE Constraints Standardization
// =====================================================

module.exports = {

    id: "014_constraint_standardization_part2",

    description: "Standardize NOT NULL, DEFAULT, and UNIQUE constraints across transactional tables",

    async up(client) {

        console.log("Applying Migration 014 - NOT NULL, DEFAULT, and UNIQUE Constraints...");

        await client.query(`

DO $$

BEGIN

    --------------------------------------------------
    -- 1. NOT NULL STANDARDIZATION
    --------------------------------------------------

    -- SALES TABLE
    -- Ensure critical fields are NOT NULL
    ALTER TABLE sales 
        ALTER COLUMN product_id SET NOT NULL,
        ALTER COLUMN qty SET NOT NULL,
        ALTER COLUMN price SET NOT NULL,
        ALTER COLUMN cost SET NOT NULL,
        ALTER COLUMN profit SET NOT NULL,
        ALTER COLUMN date SET NOT NULL;

    -- BRANCH SALES TABLE
    ALTER TABLE branch_sales 
        ALTER COLUMN branch_id SET NOT NULL,
        ALTER COLUMN product_id SET NOT NULL,
        ALTER COLUMN qty SET NOT NULL,
        ALTER COLUMN price SET NOT NULL,
        ALTER COLUMN cost SET NOT NULL,
        ALTER COLUMN profit SET NOT NULL,
        ALTER COLUMN date SET NOT NULL;

    -- INVOICE ITEMS TABLE
    ALTER TABLE invoice_items 
        ALTER COLUMN invoice_id SET NOT NULL,
        ALTER COLUMN product_id SET NOT NULL,
        ALTER COLUMN qty SET NOT NULL,
        ALTER COLUMN unit_price SET NOT NULL,
        ALTER COLUMN line_total SET NOT NULL;

    -- PURCHASE ORDER ITEMS TABLE
    ALTER TABLE purchase_order_items 
        ALTER COLUMN purchase_order_id SET NOT NULL,
        ALTER COLUMN product_id SET NOT NULL,
        ALTER COLUMN qty SET NOT NULL,
        ALTER COLUMN unit_cost SET NOT NULL,
        ALTER COLUMN line_total SET NOT NULL;

    -- NOTE: customer_id in sales and branch_sales remains nullable (optional customer)
    -- product_name and barcode in invoice_items remain nullable (legacy/display fields)
    -- remarks in purchase_order_items remains nullable (optional notes)

    --------------------------------------------------
    -- 2. DEFAULT VALUES STANDARDIZATION
    --------------------------------------------------

    -- SALES TABLE
    ALTER TABLE sales 
        ALTER COLUMN qty SET DEFAULT 1,
        ALTER COLUMN price SET DEFAULT 0.00,
        ALTER COLUMN cost SET DEFAULT 0.00,
        ALTER COLUMN profit SET DEFAULT 0.00,
        ALTER COLUMN date SET DEFAULT CURRENT_DATE;

    -- BRANCH SALES TABLE
    ALTER TABLE branch_sales 
        ALTER COLUMN qty SET DEFAULT 1,
        ALTER COLUMN price SET DEFAULT 0.00,
        ALTER COLUMN cost SET DEFAULT 0.00,
        ALTER COLUMN profit SET DEFAULT 0.00,
        ALTER COLUMN date SET DEFAULT CURRENT_DATE;

    -- INVOICE ITEMS TABLE
    ALTER TABLE invoice_items 
        ALTER COLUMN qty SET DEFAULT 1,
        ALTER COLUMN unit_price SET DEFAULT 0.00,
        ALTER COLUMN line_total SET DEFAULT 0.00;

    -- PURCHASE ORDER ITEMS TABLE
    ALTER TABLE purchase_order_items 
        ALTER COLUMN qty SET DEFAULT 1,
        ALTER COLUMN unit_cost SET DEFAULT 0.00,
        ALTER COLUMN received_qty SET DEFAULT 0,
        ALTER COLUMN line_total SET DEFAULT 0.00,
        ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

    --------------------------------------------------
    -- 3. UNIQUE CONSTRAINTS
    --------------------------------------------------

    -- Check if we need to add UNIQUE constraints for business keys

    -- PRODUCTS table - if barcode column exists, ensure it's unique
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'products'
          AND column_name = 'barcode'
    ) THEN

        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'uk_products_barcode'
        ) THEN

            ALTER TABLE products
            ADD CONSTRAINT uk_products_barcode
            UNIQUE (barcode);

        END IF;

    END IF;

    -- PRODUCTS table - product name should be unique
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'products'
          AND column_name = 'name'
    ) THEN

        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'uk_products_name'
        ) THEN

            ALTER TABLE products
            ADD CONSTRAINT uk_products_name
            UNIQUE (name);

        END IF;

    END IF;

    -- USERS table - username should be unique
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'users'
    ) THEN

        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'users'
              AND column_name = 'username'
        ) THEN

            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'uk_users_username'
            ) THEN

                ALTER TABLE users
                ADD CONSTRAINT uk_users_username
                UNIQUE (username);

            END IF;

        END IF;

    END IF;

    -- INVOICES table - invoice number should be unique
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'invoices'
    ) THEN

        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'invoices'
              AND column_name = 'invoice_number'
        ) THEN

            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'uk_invoices_invoice_number'
            ) THEN

                ALTER TABLE invoices
                ADD CONSTRAINT uk_invoices_invoice_number
                UNIQUE (invoice_number);

            END IF;

        END IF;

    END IF;

    -- BRANCHES table - branch name should be unique
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'branches'
    ) THEN

        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'branches'
              AND column_name = 'name'
        ) THEN

            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'uk_branches_name'
            ) THEN

                ALTER TABLE branches
                ADD CONSTRAINT uk_branches_name
                UNIQUE (name);

            END IF;

        END IF;

    END IF;

    -- SUPPLIERS table - email should be unique
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'suppliers'
    ) THEN

        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'suppliers'
              AND column_name = 'email'
        ) THEN

            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'uk_suppliers_email'
            ) THEN

                ALTER TABLE suppliers
                ADD CONSTRAINT uk_suppliers_email
                UNIQUE (email);

            END IF;

        END IF;

    END IF;

    -- CUSTOMERS table - email should be unique
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'customers'
    ) THEN

        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'customers'
              AND column_name = 'email'
        ) THEN

            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'uk_customers_email'
            ) THEN

                ALTER TABLE customers
                ADD CONSTRAINT uk_customers_email
                UNIQUE (email);

            END IF;

        END IF;

    END IF;

END

$$;

        `);

        console.log("✓ Migration 014 - NOT NULL, DEFAULT, and UNIQUE Constraints completed.");

    }

};