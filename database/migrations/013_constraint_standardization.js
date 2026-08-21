// =====================================================
// 013_constraint_standardization.js
// Phase 10A-2C-1
// Constraint Standardization - CHECK Constraints
// (Updated to match actual production schema)
// =====================================================

module.exports = {

    id: "013_constraint_standardization",

    description: "Standardize CHECK constraints across transactional tables (actual schema version)",

    async up(client) {

        console.log("Applying Migration 013 - Constraint Standardization...");

        await client.query(`

DO $$

BEGIN

    --------------------------------------------------
    -- SALES TABLE (actual schema: qty, price, cost, profit)
    --------------------------------------------------

    -- Check qty > 0
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'sales'
          AND column_name = 'qty'
    ) THEN

        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'chk_sales_qty'
        ) THEN

            ALTER TABLE sales
            ADD CONSTRAINT chk_sales_qty
            CHECK (qty > 0);

        END IF;

    END IF;

    -- Check price >= 0
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'sales'
          AND column_name = 'price'
    ) THEN

        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'chk_sales_price'
        ) THEN

            ALTER TABLE sales
            ADD CONSTRAINT chk_sales_price
            CHECK (price >= 0);

        END IF;

    END IF;

    -- Check cost >= 0
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'sales'
          AND column_name = 'cost'
    ) THEN

        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'chk_sales_cost'
        ) THEN

            ALTER TABLE sales
            ADD CONSTRAINT chk_sales_cost
            CHECK (cost >= 0);

        END IF;

    END IF;

    -- Check profit >= 0
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'sales'
          AND column_name = 'profit'
    ) THEN

        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'chk_sales_profit'
        ) THEN

            ALTER TABLE sales
            ADD CONSTRAINT chk_sales_profit
            CHECK (profit >= 0);

        END IF;

    END IF;

    --------------------------------------------------
    -- BRANCH SALES TABLE (actual schema: qty, price, cost, profit)
    --------------------------------------------------

    -- Check qty > 0
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'branch_sales'
          AND column_name = 'qty'
    ) THEN

        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'chk_branch_sales_qty'
        ) THEN

            ALTER TABLE branch_sales
            ADD CONSTRAINT chk_branch_sales_qty
            CHECK (qty > 0);

        END IF;

    END IF;

    -- Check price >= 0
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'branch_sales'
          AND column_name = 'price'
    ) THEN

        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'chk_branch_sales_price'
        ) THEN

            ALTER TABLE branch_sales
            ADD CONSTRAINT chk_branch_sales_price
            CHECK (price >= 0);

        END IF;

    END IF;

    -- Check cost >= 0
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'branch_sales'
          AND column_name = 'cost'
    ) THEN

        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'chk_branch_sales_cost'
        ) THEN

            ALTER TABLE branch_sales
            ADD CONSTRAINT chk_branch_sales_cost
            CHECK (cost >= 0);

        END IF;

    END IF;

    -- Check profit >= 0
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'branch_sales'
          AND column_name = 'profit'
    ) THEN

        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'chk_branch_sales_profit'
        ) THEN

            ALTER TABLE branch_sales
            ADD CONSTRAINT chk_branch_sales_profit
            CHECK (profit >= 0);

        END IF;

    END IF;

    --------------------------------------------------
    -- INVOICE ITEMS TABLE (actual schema: qty, unit_price, line_total)
    --------------------------------------------------

    -- Check qty > 0
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'invoice_items'
          AND column_name = 'qty'
    ) THEN

        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'chk_invoice_items_qty'
        ) THEN

            ALTER TABLE invoice_items
            ADD CONSTRAINT chk_invoice_items_qty
            CHECK (qty > 0);

        END IF;

    END IF;

    -- Check unit_price >= 0
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'invoice_items'
          AND column_name = 'unit_price'
    ) THEN

        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'chk_invoice_items_unit_price'
        ) THEN

            ALTER TABLE invoice_items
            ADD CONSTRAINT chk_invoice_items_unit_price
            CHECK (unit_price >= 0);

        END IF;

    END IF;

    -- Check line_total >= 0
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'invoice_items'
          AND column_name = 'line_total'
    ) THEN

        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'chk_invoice_items_line_total'
        ) THEN

            ALTER TABLE invoice_items
            ADD CONSTRAINT chk_invoice_items_line_total
            CHECK (line_total >= 0);

        END IF;

    END IF;

    --------------------------------------------------
    -- PURCHASE ORDERS TABLE
    --------------------------------------------------

    -- Check received_qty >= 0
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'purchase_orders'
          AND column_name = 'received_qty'
    ) THEN

        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'chk_purchase_orders_received_qty'
        ) THEN

            ALTER TABLE purchase_orders
            ADD CONSTRAINT chk_purchase_orders_received_qty
            CHECK (received_qty >= 0);

        END IF;

    END IF;

    --------------------------------------------------
    -- PURCHASE ORDER ITEMS TABLE
    --------------------------------------------------

    -- Check qty > 0
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'purchase_order_items'
          AND column_name = 'qty'
    ) THEN

        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'chk_po_items_qty'
        ) THEN

            ALTER TABLE purchase_order_items
            ADD CONSTRAINT chk_po_items_qty
            CHECK (qty > 0);

        END IF;

    END IF;

    -- Check received_qty >= 0
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'purchase_order_items'
          AND column_name = 'received_qty'
    ) THEN

        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'chk_po_items_received_qty'
        ) THEN

            ALTER TABLE purchase_order_items
            ADD CONSTRAINT chk_po_items_received_qty
            CHECK (received_qty >= 0);

        END IF;

    END IF;

    -- Check unit_cost >= 0
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'purchase_order_items'
          AND column_name = 'unit_cost'
    ) THEN

        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'chk_po_items_unit_cost'
        ) THEN

            ALTER TABLE purchase_order_items
            ADD CONSTRAINT chk_po_items_unit_cost
            CHECK (unit_cost >= 0);

        END IF;

    END IF;

    -- Check line_total >= 0
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'purchase_order_items'
          AND column_name = 'line_total'
    ) THEN

        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'chk_po_items_line_total'
        ) THEN

            ALTER TABLE purchase_order_items
            ADD CONSTRAINT chk_po_items_line_total
            CHECK (line_total >= 0);

        END IF;

    END IF;

    --------------------------------------------------
    -- EXPENSES TABLE (if it exists)
    --------------------------------------------------

    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'expenses'
    ) THEN

        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'expenses'
              AND column_name = 'amount'
        ) THEN

            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'chk_expenses_amount'
            ) THEN

                ALTER TABLE expenses
                ADD CONSTRAINT chk_expenses_amount
                CHECK (amount >= 0);

            END IF;

        END IF;

    END IF;

END

$$;

        `);

        console.log("✓ Migration 013 - Constraint Standardization completed.");

    }

};