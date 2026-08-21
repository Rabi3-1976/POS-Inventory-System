// =====================================================
// 015_transaction_engine.js
// Phase 10B
// Transaction Engine - Procedures, Triggers, Views
// =====================================================

module.exports = {

    id: "015_transaction_engine",

    description: "Create transaction engine: procedures, triggers, and views",

    async up(client) {

        console.log("Applying Migration 015 - Transaction Engine...");

        // --------------------------------------------------
        // 1. FUNCTIONS
        // --------------------------------------------------

        // Function to calculate profit for a sale
        await client.query(`
            CREATE OR REPLACE FUNCTION calculate_sale_profit()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.profit := (NEW.price - NEW.cost) * NEW.qty;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        // Function to calculate line_total for purchase order items
        await client.query(`
            CREATE OR REPLACE FUNCTION calculate_po_line_total()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.line_total := NEW.qty * NEW.unit_cost;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        // Function to calculate line_total for invoice items
        await client.query(`
            CREATE OR REPLACE FUNCTION calculate_invoice_line_total()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.line_total := NEW.qty * NEW.unit_price;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        // --------------------------------------------------
        // 2. TRIGGERS
        // --------------------------------------------------

        // Trigger for sales: calculate profit
        await client.query(`
            DROP TRIGGER IF EXISTS trigger_calculate_sale_profit ON sales;
            CREATE TRIGGER trigger_calculate_sale_profit
            BEFORE INSERT OR UPDATE OF price, cost, qty ON sales
            FOR EACH ROW
            EXECUTE FUNCTION calculate_sale_profit();
        `);

        // Trigger for branch_sales: calculate profit
        await client.query(`
            DROP TRIGGER IF EXISTS trigger_calculate_branch_sale_profit ON branch_sales;
            CREATE TRIGGER trigger_calculate_branch_sale_profit
            BEFORE INSERT OR UPDATE OF price, cost, qty ON branch_sales
            FOR EACH ROW
            EXECUTE FUNCTION calculate_sale_profit();
        `);

        // Trigger for purchase order items: calculate line_total
        await client.query(`
            DROP TRIGGER IF EXISTS trigger_calculate_po_line_total ON purchase_order_items;
            CREATE TRIGGER trigger_calculate_po_line_total
            BEFORE INSERT OR UPDATE OF qty, unit_cost ON purchase_order_items
            FOR EACH ROW
            EXECUTE FUNCTION calculate_po_line_total();
        `);

        // Trigger for invoice items: calculate line_total
        await client.query(`
            DROP TRIGGER IF EXISTS trigger_calculate_invoice_line_total ON invoice_items;
            CREATE TRIGGER trigger_calculate_invoice_line_total
            BEFORE INSERT OR UPDATE OF qty, unit_price ON invoice_items
            FOR EACH ROW
            EXECUTE FUNCTION calculate_invoice_line_total();
        `);

        // --------------------------------------------------
        // 3. VIEWS - Using only columns that exist in your schema
        // --------------------------------------------------

        // View: Sales Summary
        await client.query(`
            CREATE OR REPLACE VIEW v_sales_summary AS
            SELECT 
                s.id,
                s.product_id,
                p.name AS product_name,
                s.qty,
                s.price,
                s.cost,
                s.profit,
                s.date,
                s.customer_id,
                c.name AS customer_name
            FROM sales s
            LEFT JOIN products p ON s.product_id = p.id
            LEFT JOIN customers c ON s.customer_id = c.id;
        `);

        // View: Branch Sales Summary
        await client.query(`
            CREATE OR REPLACE VIEW v_branch_sales_summary AS
            SELECT 
                bs.id,
                bs.branch_id,
                b.name AS branch_name,
                bs.product_id,
                p.name AS product_name,
                bs.qty,
                bs.price,
                bs.cost,
                bs.profit,
                bs.date,
                bs.customer_id,
                c.name AS customer_name
            FROM branch_sales bs
            LEFT JOIN branches b ON bs.branch_id = b.id
            LEFT JOIN products p ON bs.product_id = p.id
            LEFT JOIN customers c ON bs.customer_id = c.id;
        `);

        // View: Product Sales Performance
        await client.query(`
            CREATE OR REPLACE VIEW v_product_sales_performance AS
            SELECT 
                p.id AS product_id,
                p.name AS product_name,
                p.barcode,
                COALESCE(SUM(s.qty), 0) AS total_sold,
                COALESCE(SUM(s.profit), 0) AS total_profit,
                COALESCE(AVG(s.price), 0) AS avg_price,
                COUNT(s.id) AS sale_count
            FROM products p
            LEFT JOIN sales s ON p.id = s.product_id
            GROUP BY p.id, p.name, p.barcode;
        `);

        // View: Purchase Order Status (only columns that exist)
        await client.query(`
            CREATE OR REPLACE VIEW v_purchase_order_status AS
            SELECT 
                po.id AS po_id,
                po.branch_id,
                b.name AS branch_name,
                po.supplier_id,
                s.name AS supplier_name,
                po.received_qty,
                po.status,
                COUNT(poi.id) AS item_count,
                COALESCE(SUM(poi.line_total), 0) AS total_value
            FROM purchase_orders po
            LEFT JOIN branches b ON po.branch_id = b.id
            LEFT JOIN suppliers s ON po.supplier_id = s.id
            LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
            GROUP BY po.id, po.branch_id, b.name, po.supplier_id, 
                     s.name, po.received_qty, po.status;
        `);

        // View: Customer Purchase History
        await client.query(`
            CREATE OR REPLACE VIEW v_customer_purchase_history AS
            SELECT 
                c.id AS customer_id,
                c.name AS customer_name,
                c.email,
                c.phone,
                COUNT(s.id) AS total_purchases,
                COALESCE(SUM(s.profit), 0) AS total_spent,
                MAX(s.date) AS last_purchase_date,
                COALESCE(AVG(s.qty), 0) AS avg_quantity
            FROM customers c
            LEFT JOIN sales s ON c.id = s.customer_id
            GROUP BY c.id, c.name, c.email, c.phone;
        `);

        // View: Daily Sales Report
        await client.query(`
            CREATE OR REPLACE VIEW v_daily_sales_report AS
            SELECT 
                DATE(s.date) AS sale_date,
                COUNT(s.id) AS total_transactions,
                SUM(s.qty) AS total_items_sold,
                SUM(s.profit) AS total_profit,
                AVG(s.profit) AS avg_profit_per_sale
            FROM sales s
            GROUP BY DATE(s.date)
            ORDER BY sale_date DESC;
        `);

        // --------------------------------------------------
        // 4. STORED PROCEDURES
        // --------------------------------------------------

        // Procedure: Process a Sale
        await client.query(`
            CREATE OR REPLACE PROCEDURE process_sale(
                p_product_id INTEGER,
                p_qty INTEGER,
                p_price DECIMAL,
                p_cost DECIMAL,
                p_customer_id INTEGER DEFAULT NULL,
                p_date DATE DEFAULT CURRENT_DATE
            )
            LANGUAGE plpgsql
            AS $$
            BEGIN
                -- Insert the sale
                INSERT INTO sales (
                    product_id, qty, price, cost, 
                    profit, customer_id, date
                ) VALUES (
                    p_product_id, p_qty, p_price, p_cost,
                    (p_price - p_cost) * p_qty, p_customer_id, p_date
                );
            END;
            $$;
        `);

        // Procedure: Process a Branch Sale
        await client.query(`
            CREATE OR REPLACE PROCEDURE process_branch_sale(
                p_branch_id INTEGER,
                p_product_id INTEGER,
                p_qty INTEGER,
                p_price DECIMAL,
                p_cost DECIMAL,
                p_customer_id INTEGER DEFAULT NULL,
                p_date DATE DEFAULT CURRENT_DATE
            )
            LANGUAGE plpgsql
            AS $$
            BEGIN
                -- Insert the branch sale
                INSERT INTO branch_sales (
                    branch_id, product_id, qty, price, cost, 
                    profit, customer_id, date
                ) VALUES (
                    p_branch_id, p_product_id, p_qty, p_price, p_cost,
                    (p_price - p_cost) * p_qty, p_customer_id, p_date
                );
            END;
            $$;
        `);

        console.log("✓ Migration 015 - Transaction Engine completed.");

    }

};