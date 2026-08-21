// =====================================================
// 011_complete_foreign_keys.js
// Phase 24A-2C
// Complete Referential Integrity
// =====================================================

module.exports = {

    id: "011_complete_foreign_keys",

    description: "Complete missing foreign keys for Sales, Branch Sales, Invoices and Invoice Items",

    async up(client) {

        console.log("Applying Migration 011 - Complete Foreign Keys...");

        await client.query(`

DO $$

BEGIN

    --------------------------------------------------
    -- SALES
    --------------------------------------------------

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_sales_product'
    ) THEN

        ALTER TABLE sales
        ADD CONSTRAINT fk_sales_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE;

    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_sales_customer'
    ) THEN

        ALTER TABLE sales
        ADD CONSTRAINT fk_sales_customer
        FOREIGN KEY (customer_id)
        REFERENCES customers(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE;

    END IF;

    --------------------------------------------------
    -- BRANCH SALES
    --------------------------------------------------

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_branch_sales_branch'
    ) THEN

        ALTER TABLE branch_sales
        ADD CONSTRAINT fk_branch_sales_branch
        FOREIGN KEY (branch_id)
        REFERENCES branches(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE;

    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_branch_sales_product'
    ) THEN

        ALTER TABLE branch_sales
        ADD CONSTRAINT fk_branch_sales_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE;

    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_branch_sales_customer'
    ) THEN

        ALTER TABLE branch_sales
        ADD CONSTRAINT fk_branch_sales_customer
        FOREIGN KEY (customer_id)
        REFERENCES customers(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE;

    END IF;

    --------------------------------------------------
    -- INVOICES
    --------------------------------------------------

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_invoices_customer'
    ) THEN

        ALTER TABLE invoices
        ADD CONSTRAINT fk_invoices_customer
        FOREIGN KEY (customer_id)
        REFERENCES customers(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE;

    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_invoices_branch'
    ) THEN

        ALTER TABLE invoices
        ADD CONSTRAINT fk_invoices_branch
        FOREIGN KEY (branch_id)
        REFERENCES branches(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE;

    END IF;

    --------------------------------------------------
    -- INVOICE ITEMS
    --------------------------------------------------

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_invoice_items_product'
    ) THEN

        ALTER TABLE invoice_items
        ADD CONSTRAINT fk_invoice_items_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE;

    END IF;

END

$$;

        `);

        console.log("✓ Migration 011 - Complete Foreign Keys completed.");

    }

};