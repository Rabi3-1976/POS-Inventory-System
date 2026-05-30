const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const multer = require("multer");
const XLSX = require("xlsx");
const fs = require("fs");
const pool = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = "secretkey";

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token provided" });

    const token = authHeader.split(" ")[1];

    jwt.verify(token, SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid token" });
        req.user = user;
        next();
    });
}

function adminOnly(req, res, next) {
    if (req.user.role !== "admin") {
        return res.status(403).json({ error: "Admin only" });
    }
    next();
}

// LOGIN
app.post("/login", async (req, res) => {
    const { username, password } = req.body;

    try {
        const result = await pool.query(
            "SELECT * FROM users WHERE username = $1",
            [username]
        );

        const user = result.rows[0];

        if (!user) return res.status(400).json({ error: "Invalid username or password" });

        const valid = await bcrypt.compare(password, user.password);

        if (!valid) return res.status(400).json({ error: "Invalid username or password" });

        const token = jwt.sign({ id: user.id, role: user.role }, SECRET);

        res.json({ token, role: user.role });
    } catch (err) {
        console.error("LOGIN ERROR:", err);
        res.status(500).json({ error: "Login failed" });
    }
});

// USERS
app.post("/create-user", verifyToken, adminOnly, async (req, res) => {
    const { username, password, role } = req.body;

    try {
        const hashed = await bcrypt.hash(password, 10);

        await pool.query(
            "INSERT INTO users (username, password, role) VALUES ($1, $2, $3)",
            [username, hashed, role]
        );

        res.json({ message: "User created" });
    } catch (err) {
        res.status(400).json({ error: "User already exists" });
    }
});

app.get("/users", verifyToken, adminOnly, async (req, res) => {
    try {
        const result = await pool.query("SELECT id, username, role FROM users ORDER BY id");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put("/users/:id/password", verifyToken, adminOnly, async (req, res) => {
    try {
        const hashed = await bcrypt.hash(req.body.password, 10);

        await pool.query(
            "UPDATE users SET password = $1 WHERE id = $2",
            [hashed, req.params.id]
        );

        res.json({ message: "Password updated" });
    } catch (err) {
        res.status(400).json({ error: "Password update failed" });
    }
});

app.delete("/users/:id", verifyToken, adminOnly, async (req, res) => {
    try {
        await pool.query("DELETE FROM users WHERE id = $1", [req.params.id]);
        res.json({ message: "User deleted" });
    } catch (err) {
        res.status(400).json({ error: "Delete failed" });
    }
});

// PRODUCTS
app.get("/products", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM products ORDER BY id DESC");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to load products" });
    }
});

app.post("/products", verifyToken, adminOnly, async (req, res) => {
    const { name, barcode, price, cost } = req.body;

    try {
        await pool.query(
            "INSERT INTO products (name, barcode, price, cost, stock) VALUES ($1, $2, $3, $4, 0)",
            [name, barcode, Number(price), Number(cost || 0)]
        );

        res.json({ message: "Product added" });
    } catch (err) {
        res.status(400).json({ error: "Duplicate product or barcode" });
    }
});

app.delete("/products/:id", verifyToken, adminOnly, async (req, res) => {
    const id = req.params.id;

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        await client.query("DELETE FROM stock_transfers WHERE product_id = $1", [id]);
        await client.query("DELETE FROM branch_sales WHERE product_id = $1", [id]);
        await client.query("DELETE FROM branch_stock WHERE product_id = $1", [id]);
        await client.query("DELETE FROM purchase_orders WHERE product_id = $1", [id]);
        await client.query("DELETE FROM sales WHERE product_id = $1", [id]);
        await client.query("DELETE FROM receiving WHERE product_id = $1", [id]);
        await client.query("DELETE FROM products WHERE id = $1", [id]);

        await client.query("COMMIT");

        res.json({ message: "Product and related data deleted" });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("DELETE PRODUCT ERROR:", err);
        res.status(400).json({ error: "Delete product failed" });
    } finally {
        client.release();
    }
});

// RECEIVING
app.post("/receiving", async (req, res) => {
    const { product_id, qty } = req.body;

    if (!product_id || !qty || Number(qty) <= 0) {
        return res.status(400).json({ error: "Invalid product or quantity" });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const productCheck = await client.query(
            "SELECT * FROM products WHERE id = $1",
            [product_id]
        );

        if (productCheck.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Product not found" });
        }

        await client.query(
            "INSERT INTO receiving (product_id, qty) VALUES ($1, $2)",
            [product_id, Number(qty)]
        );

        await client.query(
            "UPDATE products SET stock = stock + $1 WHERE id = $2",
            [Number(qty), product_id]
        );

        await client.query("COMMIT");

        res.json({ message: "Stock received successfully" });

    } catch (err) {
        await client.query("ROLLBACK");
        console.error("RECEIVING ERROR:", err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// SALES
app.post("/sales", async (req, res) => {
    const { product_id, qty } = req.body;

    try {
        const result = await pool.query("SELECT * FROM products WHERE id = $1", [product_id]);
        const product = result.rows[0];

        if (!product) return res.status(400).json({ error: "Product not found" });
        if (Number(product.stock) < Number(qty)) return res.status(400).json({ error: "Not enough stock" });

        const totalPrice = Number(product.price) * Number(qty);
        const totalCost = Number(product.cost || 0) * Number(qty);
        const profit = totalPrice - totalCost;

        await pool.query("BEGIN");

        await pool.query(
            "INSERT INTO sales (product_id, qty, price, cost, profit) VALUES ($1, $2, $3, $4, $5)",
            [product_id, qty, totalPrice, totalCost, profit]
        );

        await pool.query(
            "UPDATE products SET stock = stock - $1 WHERE id = $2",
            [qty, product_id]
        );

        await pool.query("COMMIT");

        res.json({ message: "Sale recorded", profit });
    } catch (err) {
        await pool.query("ROLLBACK");
        res.status(500).json({ error: "Sale failed" });
    }
});

// DASHBOARD
app.get("/dashboard", async (req, res) => {

    try {

        const products = await pool.query(
            "SELECT COUNT(*) AS total_products FROM products"
        );

        const stock = await pool.query(
            "SELECT COALESCE(SUM(stock),0) AS total_stock FROM products"
        );

        const sales = await pool.query(
            "SELECT COALESCE(SUM(price),0) AS total_sales FROM sales"
        );

        const profit = await pool.query(
            "SELECT COALESCE(SUM(profit),0) AS total_profit FROM sales"
        );

        const lowStock = await pool.query(
            "SELECT COUNT(*) AS low_stock FROM products WHERE stock <= 5"
        );

        res.json({

            totalProducts:
                Number(products.rows[0].total_products),

            totalStock:
                Number(stock.rows[0].total_stock),

            totalSales:
                Number(sales.rows[0].total_sales),

            totalProfit:
                Number(profit.rows[0].total_profit),

            lowStock:
                Number(lowStock.rows[0].low_stock)
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: "Dashboard failed"
        });
    }
});

// REPORTS
app.get("/sales-report", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                s.id,
                p.name AS product_name,
                p.barcode,
                s.qty,
                s.price,
                s.cost,
                s.profit,
                s.date
            FROM sales s
            JOIN products p ON s.product_id = p.id
            ORDER BY s.date DESC
        `);

        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Sales report failed" });
    }
});

app.get("/receiving-report", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                r.id,
                p.name AS product_name,
                p.barcode,
                r.qty,
                r.date
            FROM receiving r
            JOIN products p ON r.product_id = p.id
            ORDER BY r.date DESC
        `);

        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Receiving report failed" });
    }
});

// SUPPLIERS
app.post("/suppliers", verifyToken, adminOnly, async (req, res) => {
    const { name, phone, email, address } = req.body;

    try {
        await pool.query(
            "INSERT INTO suppliers (name, phone, email, address) VALUES ($1, $2, $3, $4)",
            [name, phone, email, address]
        );

        res.json({ message: "Supplier added" });
    } catch (err) {
        res.status(400).json({ error: "Supplier already exists" });
    }
});

app.get("/suppliers", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM suppliers ORDER BY id DESC");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Suppliers failed" });
    }
});

// PURCHASE ORDERS
app.post("/purchase-orders", verifyToken, adminOnly, async (req, res) => {
    const { supplier_id, product_id, branch_id, qty } = req.body;

    if (!supplier_id || !product_id || !branch_id || !qty || Number(qty) <= 0) {
        return res.status(400).json({ error: "Please select supplier, product, branch, and valid quantity" });
    }

    try {
        await pool.query(
            "INSERT INTO purchase_orders (supplier_id, product_id, branch_id, qty) VALUES ($1, $2, $3, $4)",
            [supplier_id, product_id, branch_id, Number(qty)]
        );

        res.json({ message: "Purchase order created" });
    } catch (err) {
        console.error("CREATE PO ERROR:", err);
        res.status(400).json({ error: "Purchase order failed" });
    }
});

app.get("/purchase-orders", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                po.id,
                s.name AS supplier_name,
                p.name AS product_name,
                p.barcode,
                b.name AS branch_name,
                po.qty,
                COALESCE(po.received_qty, 0) AS received_qty,
                (po.qty - COALESCE(po.received_qty, 0)) AS remaining_qty,
                po.status,
                po.date
            FROM purchase_orders po
            JOIN suppliers s ON po.supplier_id = s.id
            JOIN products p ON po.product_id = p.id
            LEFT JOIN branches b ON po.branch_id = b.id
            ORDER BY po.date DESC
        `);

        res.json(result.rows);
    } catch (err) {
        console.error("PO LIST ERROR:", err);
        res.status(500).json({ error: "Purchase orders failed" });
    }
});

app.put("/purchase-orders/:id/receive", verifyToken, adminOnly, async (req, res) => {
    const poId = req.params.id;
    const { received_qty } = req.body;

    if (!received_qty || Number(received_qty) <= 0) {
        return res.status(400).json({ error: "Please enter valid received quantity" });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const result = await client.query(
            "SELECT * FROM purchase_orders WHERE id = $1",
            [poId]
        );

        const po = result.rows[0];

        if (!po) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Purchase order not found" });
        }

        if (po.status === "Received") {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Purchase order already fully received" });
        }

        if (!po.branch_id) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Purchase order has no branch assigned" });
        }

        const orderedQty = Number(po.qty || 0);
        const alreadyReceived = Number(po.received_qty || 0);
        const receiveNow = Number(received_qty);
        const newReceivedTotal = alreadyReceived + receiveNow;

        if (newReceivedTotal > orderedQty) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                error: `Received quantity exceeds remaining quantity. Remaining: ${orderedQty - alreadyReceived}`
            });
        }

        let newStatus = "Partially Received";

        if (newReceivedTotal === orderedQty) {
            newStatus = "Received";
        }

        await client.query(`
            INSERT INTO branch_stock (branch_id, product_id, stock)
            VALUES ($1, $2, $3)
            ON CONFLICT (branch_id, product_id)
            DO UPDATE SET stock = branch_stock.stock + EXCLUDED.stock
        `, [po.branch_id, po.product_id, receiveNow]);

        await client.query(
            "UPDATE products SET stock = stock + $1 WHERE id = $2",
            [receiveNow, po.product_id]
        );

        await client.query(
            "INSERT INTO receiving (product_id, qty) VALUES ($1, $2)",
            [po.product_id, receiveNow]
        );

        await client.query(
            "UPDATE purchase_orders SET received_qty = $1, status = $2 WHERE id = $3",
            [newReceivedTotal, newStatus, poId]
        );

        await client.query("COMMIT");

        res.json({
            message: `Purchase order received successfully. Received now: ${receiveNow}. Remaining: ${orderedQty - newReceivedTotal}`,
            status: newStatus,
            received_qty: newReceivedTotal,
            remaining_qty: orderedQty - newReceivedTotal
        });

    } catch (err) {
        await client.query("ROLLBACK");
        console.error("RECEIVE PO ERROR:", err);
        res.status(500).json({ error: "Receive PO failed: " + err.message });
    } finally {
        client.release();
    }
});


// CHARTS
app.get("/charts/sales-profit", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                DATE(date) AS sale_date,
                COALESCE(SUM(price),0) AS total_sales,
                COALESCE(SUM(profit),0) AS total_profit
            FROM sales
            GROUP BY DATE(date)
            ORDER BY sale_date ASC
        `);

        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Chart data failed" });
    }
});

app.get("/charts/stock", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT name, stock
            FROM products
            ORDER BY stock ASC
        `);

        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Stock chart failed" });
    }
});

// IMPORT PRODUCTS
app.post("/import-products", upload.single("file"), async (req, res) => {
    try {
        const workbook = XLSX.readFile(req.file.path);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet);

        for (const item of data) {
            await pool.query(`
                INSERT INTO products (name, barcode, price, cost, stock)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (barcode) DO NOTHING
            `, [
                item.name,
                item.barcode,
                Number(item.price || 0),
                Number(item.cost || 0),
                Number(item.stock || 0)
            ]);
        }

        fs.unlinkSync(req.file.path);

        res.json({ message: "Products imported successfully" });
    } catch (err) {
        res.status(500).json({ error: "Import failed" });
    }
});
// BRANCHES
app.post("/branches", verifyToken, adminOnly, async (req, res) => {
    const { name, location } = req.body;

    try {
        await pool.query(
            "INSERT INTO branches (name, location) VALUES ($1, $2)",
            [name, location]
        );

        res.json({ message: "Branch added" });
    } catch (err) {
        res.status(400).json({ error: "Branch already exists" });
    }
});

app.get("/branches", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM branches ORDER BY id");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Branches failed" });
    }
});
// BRANCH STOCK
app.post("/branch-stock", verifyToken, adminOnly, async (req, res) => {
    const { branch_id, product_id, stock } = req.body;

    if (!branch_id || !product_id || stock === undefined || Number(stock) < 0) {
        return res.status(400).json({ error: "Invalid branch/product/stock" });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        await client.query(`
            INSERT INTO branch_stock (branch_id, product_id, stock)
            VALUES ($1, $2, $3)
            ON CONFLICT (branch_id, product_id)
            DO UPDATE SET stock = EXCLUDED.stock
        `, [branch_id, product_id, Number(stock)]);

        // Keep product total stock equal to the sum of stock in all branches.
        const total = await client.query(
            "SELECT COALESCE(SUM(stock), 0) AS total_stock FROM branch_stock WHERE product_id = $1",
            [product_id]
        );

        await client.query(
            "UPDATE products SET stock = $1 WHERE id = $2",
            [Number(total.rows[0].total_stock), product_id]
        );

        await client.query("COMMIT");

        res.json({ message: "Branch stock updated" });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("BRANCH STOCK ERROR:", err);
        res.status(500).json({ error: "Branch stock update failed" });
    } finally {
        client.release();
    }
});
// GET BRANCH STOCK
app.get("/branch-stock", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                bs.id,
                b.name AS branch_name,
                p.name AS product_name,
                p.barcode,
                bs.stock,
                COALESCE(bs.min_stock, 0) AS min_stock
            FROM branch_stock bs
            JOIN branches b ON bs.branch_id = b.id
            JOIN products p ON bs.product_id = p.id
            ORDER BY b.name, p.name
        `);

        res.json(result.rows);
    } catch (err) {
        console.error("BRANCH STOCK LOAD ERROR:", err);
        res.status(500).json({ error: "Branch stock failed to load" });
    }
});
// STOCK TRANSFER
app.post("/stock-transfer", verifyToken, adminOnly, async (req, res) => {
    const { from_branch_id, to_branch_id, product_id, qty } = req.body;

    if (!from_branch_id || !to_branch_id || !product_id || !qty || qty <= 0) {
        return res.status(400).json({ error: "Invalid transfer data" });
    }

    if (from_branch_id === to_branch_id) {
        return res.status(400).json({ error: "Cannot transfer to same branch" });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const source = await client.query(
            "SELECT stock FROM branch_stock WHERE branch_id = $1 AND product_id = $2",
            [from_branch_id, product_id]
        );

        if (source.rows.length === 0 || Number(source.rows[0].stock) < Number(qty)) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Not enough stock in source branch" });
        }

        await client.query(
            "UPDATE branch_stock SET stock = stock - $1 WHERE branch_id = $2 AND product_id = $3",
            [qty, from_branch_id, product_id]
        );

        await client.query(`
            INSERT INTO branch_stock (branch_id, product_id, stock)
            VALUES ($1, $2, $3)
            ON CONFLICT (branch_id, product_id)
            DO UPDATE SET stock = branch_stock.stock + EXCLUDED.stock
        `, [to_branch_id, product_id, qty]);

        await client.query(`
            INSERT INTO stock_transfers (from_branch_id, to_branch_id, product_id, qty)
            VALUES ($1, $2, $3, $4)
        `, [from_branch_id, to_branch_id, product_id, qty]);

        await client.query("COMMIT");

        res.json({ message: "Stock transferred successfully" });

    } catch (err) {
        await client.query("ROLLBACK");
        console.error("TRANSFER ERROR:", err);
        res.status(500).json({ error: "Stock transfer failed" });
    } finally {
        client.release();
    }
});
// TRANSFER HISTORY
app.get("/stock-transfers", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                st.id,
                fb.name AS from_branch,
                tb.name AS to_branch,
                p.name AS product_name,
                p.barcode,
                st.qty,
                st.date
            FROM stock_transfers st
            JOIN branches fb ON st.from_branch_id = fb.id
            JOIN branches tb ON st.to_branch_id = tb.id
            JOIN products p ON st.product_id = p.id
            ORDER BY st.date DESC
        `);

        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Transfer history failed" });
    }
});
// RECEIVE PRODUCT TO BRANCH
app.post("/receive-to-branch", verifyToken, adminOnly, async (req, res) => {
    const { branch_id, product_id, qty } = req.body;

    if (!branch_id || !product_id || !qty || Number(qty) <= 0) {
        return res.status(400).json({ error: "Invalid branch/product/quantity" });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        await client.query(`
            INSERT INTO branch_stock (branch_id, product_id, stock)
            VALUES ($1, $2, $3)
            ON CONFLICT (branch_id, product_id)
            DO UPDATE SET stock = branch_stock.stock + EXCLUDED.stock
        `, [branch_id, product_id, Number(qty)]);

        await client.query(`
            UPDATE products
            SET stock = stock + $1
            WHERE id = $2
        `, [Number(qty), product_id]);

        await client.query(`
            INSERT INTO receiving (product_id, qty)
            VALUES ($1, $2)
        `, [product_id, Number(qty)]);

        await client.query("COMMIT");

        res.json({ message: "Stock received to branch successfully" });

    } catch (err) {
        await client.query("ROLLBACK");
        console.error("RECEIVE TO BRANCH ERROR:", err);
        res.status(500).json({ error: "Receive to branch failed" });
    } finally {
        client.release();
    }
});
// BRANCH SALE
app.post("/branch-sale", async (req, res) => {
    const { branch_id, product_id, qty, customer_id } = req.body;

    if (!branch_id || !product_id || !qty || Number(qty) <= 0) {
        return res.status(400).json({ error: "Invalid branch/product/quantity" });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const productResult = await client.query(
            "SELECT * FROM products WHERE id = $1",
            [product_id]
        );

        const product = productResult.rows[0];

        if (!product) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Product not found" });
        }

        const branchStockResult = await client.query(
            "SELECT stock FROM branch_stock WHERE branch_id = $1 AND product_id = $2",
            [branch_id, product_id]
        );

        if (
            branchStockResult.rows.length === 0 ||
            Number(branchStockResult.rows[0].stock) < Number(qty)
        ) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Not enough stock in selected branch" });
        }

        const totalPrice = Number(product.price) * Number(qty);
        const totalCost = Number(product.cost || 0) * Number(qty);
        const profit = totalPrice - totalCost;

        await client.query(
            "UPDATE branch_stock SET stock = stock - $1 WHERE branch_id = $2 AND product_id = $3",
            [Number(qty), branch_id, product_id]
        );

        await client.query(
            "UPDATE products SET stock = stock - $1 WHERE id = $2",
            [Number(qty), product_id]
        );

        await client.query(
            `INSERT INTO branch_sales 
             (branch_id, product_id, customer_id, qty, price, cost, profit)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                branch_id,
                product_id,
                customer_id || null,
                Number(qty),
                totalPrice,
                totalCost,
                profit
            ]
        );

        await client.query(
            `INSERT INTO sales 
             (product_id, customer_id, qty, price, cost, profit)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                product_id,
                customer_id || null,
                Number(qty),
                totalPrice,
                totalCost,
                profit
            ]
        );

        await client.query("COMMIT");

        res.json({ message: "Branch sale completed successfully", profit });

    } catch (err) {
        await client.query("ROLLBACK");
        console.error("BRANCH SALE ERROR:", err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// BRANCH SALES REPORT
app.get("/branch-sales-report", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                bs.id,
                b.name AS branch_name,
                c.name AS customer_name,
                c.phone AS customer_phone,
                p.name AS product_name,
                p.barcode,
                bs.qty,
                bs.price,
                bs.cost,
                bs.profit,
                bs.date
            FROM branch_sales bs
            JOIN branches b ON bs.branch_id = b.id
            JOIN products p ON bs.product_id = p.id
            LEFT JOIN customers c ON bs.customer_id = c.id
            ORDER BY bs.date DESC
        `);

        res.json(result.rows);
    } catch (err) {
        console.error("BRANCH SALES REPORT ERROR:", err);
        res.status(500).json({ error: "Branch sales report failed" });
    }
});

// BRANCH DASHBOARD
app.get("/branch-dashboard", async (req, res) => {
    try {
        const sales = await pool.query(`
            SELECT 
                b.id AS branch_id,
                b.name AS branch_name,
                COALESCE(SUM(bs.price), 0) AS total_sales,
                COALESCE(SUM(bs.profit), 0) AS total_profit
            FROM branches b
            LEFT JOIN branch_sales bs ON b.id = bs.branch_id
            GROUP BY b.id, b.name
            ORDER BY b.name
        `);

        const stock = await pool.query(`
            SELECT 
                b.id AS branch_id,
                b.name AS branch_name,
                COALESCE(SUM(bs.stock), 0) AS total_stock
            FROM branches b
            LEFT JOIN branch_stock bs ON b.id = bs.branch_id
            GROUP BY b.id, b.name
            ORDER BY b.name
        `);

        const lowStock = await pool.query(`
            SELECT 
                b.id AS branch_id,
                b.name AS branch_name,
                COUNT(*) AS low_stock_items
                FROM branch_stock bs
                JOIN branches b ON bs.branch_id = b.id
                WHERE COALESCE(bs.min_stock, 0) > 0
                AND COALESCE(bs.stock, 0) <= COALESCE(bs.min_stock, 0)
                GROUP BY b.id, b.name
    `);

        res.json({
            sales: sales.rows,
            stock: stock.rows,
            lowStock: lowStock.rows
        });

    } catch (err) {
        console.error("BRANCH DASHBOARD ERROR:", err);
        res.status(500).json({ error: err.message });
    }
});
// BRANCH STOCK CHECK
app.get("/branch-stock-check", async (req, res) => {
    const { branch_id, barcode } = req.query;

    try {
        const result = await pool.query(`
            SELECT 
                p.id,
                p.name,
                p.barcode,
                p.price,
                COALESCE(bs.stock, 0) AS branch_stock
            FROM products p
            LEFT JOIN branch_stock bs 
                ON p.id = bs.product_id 
                AND bs.branch_id = $1
            WHERE p.barcode = $2
        `, [branch_id, barcode]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }

        res.json(result.rows[0]);

    } catch (err) {
        res.status(500).json({ error: "Branch stock check failed" });
    }
});
// SYNC UNASSIGNED STOCK TO MAIN BRANCH
app.post("/sync-stock-to-main", verifyToken, adminOnly, async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const mainBranchResult = await client.query(
            "SELECT id FROM branches WHERE LOWER(name) = LOWER($1) LIMIT 1",
            ["Main"]
        );

        if (mainBranchResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                error: "Main branch not found. Please create branch named Main first."
            });
        }

        const mainBranchId = mainBranchResult.rows[0].id;

        const products = await client.query(`
            SELECT 
                p.id,
                p.name,
                p.stock AS product_stock,
                COALESCE(SUM(bs.stock), 0) AS branch_stock
            FROM products p
            LEFT JOIN branch_stock bs ON p.id = bs.product_id
            GROUP BY p.id, p.name, p.stock
        `);

        let synced = 0;

        for (const p of products.rows) {
            const productStock = Number(p.product_stock || 0);
            const branchStock = Number(p.branch_stock || 0);
            const difference = productStock - branchStock;

            if (difference > 0) {
                await client.query(`
                    INSERT INTO branch_stock (branch_id, product_id, stock)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (branch_id, product_id)
                    DO UPDATE SET stock = branch_stock.stock + EXCLUDED.stock
                `, [mainBranchId, p.id, difference]);

                synced++;
            }
        }

        await client.query("COMMIT");

        res.json({
            message: "Unassigned stock synced to Main branch",
            productsUpdated: synced
        });

    } catch (err) {
        await client.query("ROLLBACK");
        console.error("SYNC STOCK ERROR:", err);
        res.status(500).json({ error: "Stock sync failed" });
    } finally {
        client.release();
    }
});
// CUSTOMERS
app.post("/customers", verifyToken, async (req, res) => {
    const { name, phone, email, address } = req.body;

    if (!name || !phone) {
        return res.status(400).json({ error: "Customer name and phone are required" });
    }

    try {
        await pool.query(
            "INSERT INTO customers (name, phone, email, address) VALUES ($1, $2, $3, $4)",
            [name, phone, email || "", address || ""]
        );

        res.json({ message: "Customer added" });
    } catch (err) {
        res.status(400).json({ error: "Customer phone already exists" });
    }
});

app.get("/customers", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM customers ORDER BY id DESC"
        );

        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Customers failed to load" });
    }
});

app.delete("/customers/:id", verifyToken, adminOnly, async (req, res) => {
    try {
        await pool.query("DELETE FROM customers WHERE id = $1", [req.params.id]);
        res.json({ message: "Customer deleted" });
    } catch (err) {
        res.status(400).json({ error: "Customer delete failed" });
    }
});
// CUSTOMER PURCHASE HISTORY
app.get("/customer-history/:id", async (req, res) => {
    const customerId = req.params.id;

    try {
        const result = await pool.query(`
            SELECT 
                bs.id,
                b.name AS branch_name,
                c.name AS customer_name,
                c.phone AS customer_phone,
                p.name AS product_name,
                p.barcode,
                bs.qty,
                bs.price,
                bs.cost,
                bs.profit,
                bs.date
            FROM branch_sales bs
            JOIN branches b ON bs.branch_id = b.id
            JOIN products p ON bs.product_id = p.id
            LEFT JOIN customers c ON bs.customer_id = c.id
            WHERE bs.customer_id = $1
            ORDER BY bs.date DESC
        `, [customerId]);

        res.json(result.rows);
    } catch (err) {
        console.error("CUSTOMER HISTORY ERROR:", err);
        res.status(500).json({ error: "Customer history failed" });
    }
});
// EXPENSES
app.post("/expenses", verifyToken, async (req, res) => {
    const { category, amount, notes } = req.body;

    if (!category || !amount || Number(amount) <= 0) {
        return res.status(400).json({ error: "Category and valid amount are required" });
    }

    try {
        await pool.query(
            "INSERT INTO expenses (category, amount, notes) VALUES ($1, $2, $3)",
            [category, Number(amount), notes || ""]
        );

        res.json({ message: "Expense added" });
    } catch (err) {
        console.error("ADD EXPENSE ERROR:", err);
        res.status(500).json({ error: "Expense add failed" });
    }
});

app.get("/expenses", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM expenses
            ORDER BY date DESC
        `);

        res.json(result.rows);
    } catch (err) {
        console.error("LOAD EXPENSES ERROR:", err);
        res.status(500).json({ error: "Expenses failed to load" });
    }
});

app.delete("/expenses/:id", verifyToken, adminOnly, async (req, res) => {
    try {
        await pool.query("DELETE FROM expenses WHERE id = $1", [req.params.id]);
        res.json({ message: "Expense deleted" });
    } catch (err) {
        console.error("DELETE EXPENSE ERROR:", err);
        res.status(500).json({ error: "Expense delete failed" });
    }
});
// DAILY CLOSING REPORT
app.get("/daily-closing", async (req, res) => {
    try {
        const selectedDate = req.query.date || new Date().toISOString().slice(0, 10);

        const sales = await pool.query(`
            SELECT 
                COALESCE(SUM(price), 0) AS total_sales,
                COALESCE(SUM(profit), 0) AS total_profit,
                COUNT(*) AS total_transactions
            FROM sales
            WHERE DATE(date) = $1
        `, [selectedDate]);

        const expenses = await pool.query(`
            SELECT 
                COALESCE(SUM(amount), 0) AS total_expenses
            FROM expenses
            WHERE DATE(date) = $1
        `, [selectedDate]);

        const expenseList = await pool.query(`
            SELECT *
            FROM expenses
            WHERE DATE(date) = $1
            ORDER BY date DESC
        `, [selectedDate]);

        const returns = await pool.query(`
            SELECT 
                COALESCE(SUM(refund_amount), 0) AS total_refunds,
                COUNT(*) AS total_returns
            FROM customer_returns
            WHERE DATE(date) = $1
        `, [selectedDate]);

        const returnList = await pool.query(`
            SELECT 
                cr.id,
                c.name AS customer_name,
                p.name AS product_name,
                p.barcode,
                b.name AS branch_name,
                cr.qty,
                cr.refund_amount,
                cr.reason,
                cr.date
            FROM customer_returns cr
            LEFT JOIN customers c ON cr.customer_id = c.id
            JOIN products p ON cr.product_id = p.id
            JOIN branches b ON cr.branch_id = b.id
            WHERE DATE(cr.date) = $1
            ORDER BY cr.date DESC
        `, [selectedDate]);

        const salesValue = Number(sales.rows[0].total_sales || 0);
        const profitValue = Number(sales.rows[0].total_profit || 0);
        const expensesValue = Number(expenses.rows[0].total_expenses || 0);
        const refundsValue = Number(returns.rows[0].total_refunds || 0);

        res.json({
            date: selectedDate,
            total_sales: salesValue,
            total_profit: profitValue,
            total_expenses: expensesValue,
            total_refunds: refundsValue,
            net_profit: profitValue - expensesValue - refundsValue,
            total_transactions: Number(sales.rows[0].total_transactions || 0),
            total_returns: Number(returns.rows[0].total_returns || 0),
            expenses: expenseList.rows,
            returns: returnList.rows
        });

    } catch (err) {
        console.error("DAILY CLOSING ERROR:", err);
        res.status(500).json({ error: "Daily closing failed" });
    }
});
// CREATE INVOICE WITH BRANCH SALES
app.post("/checkout-invoice", verifyToken, async (req, res) => {
    const { branch_id, customer_id, payment_method, items } = req.body;

    if (!branch_id || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Invalid invoice data" });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const invoiceNo = "INV-" + Date.now();

        let invoiceTotal = 0;

        for (const item of items) {
            const productResult = await client.query(
                "SELECT * FROM products WHERE id = $1",
                [item.product_id]
            );

            const product = productResult.rows[0];

            if (!product) {
                await client.query("ROLLBACK");
                return res.status(404).json({
                    error: "Product not found"
                });
            }

            const branchStockResult = await client.query(
                "SELECT stock FROM branch_stock WHERE branch_id = $1 AND product_id = $2",
                [branch_id, item.product_id]
            );

            if (
                branchStockResult.rows.length === 0 ||
                Number(branchStockResult.rows[0].stock) < Number(item.qty)
            ) {
                await client.query("ROLLBACK");
                return res.status(400).json({
                    error: `Not enough stock for ${product.name}`
                });
            }

            invoiceTotal += Number(product.price) * Number(item.qty);
        }

        const invoiceResult = await client.query(
            `INSERT INTO invoices 
             (invoice_no, customer_id, branch_id, user_id, payment_method, total)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, invoice_no`,
            [
                invoiceNo,
                customer_id || null,
                branch_id,
                req.user.id,
                payment_method || "Cash",
                invoiceTotal
            ]
        );

        const invoice = invoiceResult.rows[0];

        for (const item of items) {
            const productResult = await client.query(
                "SELECT * FROM products WHERE id = $1",
                [item.product_id]
            );

            const product = productResult.rows[0];

            const qty = Number(item.qty);
            const unitPrice = Number(product.price);
            const lineTotal = unitPrice * qty;
            const totalCost = Number(product.cost || 0) * qty;
            const profit = lineTotal - totalCost;

            await client.query(
                "UPDATE branch_stock SET stock = stock - $1 WHERE branch_id = $2 AND product_id = $3",
                [qty, branch_id, item.product_id]
            );

            await client.query(
                "UPDATE products SET stock = stock - $1 WHERE id = $2",
                [qty, item.product_id]
            );

            await client.query(
                `INSERT INTO branch_sales 
                 (branch_id, product_id, customer_id, qty, price, cost, profit)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    branch_id,
                    item.product_id,
                    customer_id || null,
                    qty,
                    lineTotal,
                    totalCost,
                    profit
                ]
            );

            await client.query(
                `INSERT INTO sales 
                 (product_id, customer_id, qty, price, cost, profit)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    item.product_id,
                    customer_id || null,
                    qty,
                    lineTotal,
                    totalCost,
                    profit
                ]
            );

            await client.query(
                `INSERT INTO invoice_items 
                 (invoice_id, product_id, product_name, barcode, qty, unit_price, line_total)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    invoice.id,
                    item.product_id,
                    product.name,
                    product.barcode,
                    qty,
                    unitPrice,
                    lineTotal
                ]
            );
        }

        await client.query("COMMIT");

        res.json({
            message: "Invoice created successfully",
            invoice_id: invoice.id,
            invoice_no: invoice.invoice_no,
            total: invoiceTotal
        });

    } catch (err) {
        await client.query("ROLLBACK");
        console.error("CHECKOUT INVOICE ERROR:", err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});
// INVOICE REPORT
app.get("/invoices", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                i.id,
                i.invoice_no,
                i.total,
                i.payment_method,
                i.date,
                c.name AS customer_name,
                c.phone AS customer_phone,
                b.name AS branch_name,
                u.username AS cashier_name
            FROM invoices i
            LEFT JOIN customers c ON i.customer_id = c.id
            LEFT JOIN branches b ON i.branch_id = b.id
            LEFT JOIN users u ON i.user_id = u.id
            ORDER BY i.date DESC
        `);

        res.json(result.rows);
    } catch (err) {
        console.error("INVOICE REPORT ERROR:", err);
        res.status(500).json({ error: "Invoice report failed" });
    }
});

app.get("/invoices/:id", async (req, res) => {
    try {
        const invoiceResult = await pool.query(`
            SELECT 
                i.id,
                i.invoice_no,
                i.total,
                i.payment_method,
                i.date,
                c.name AS customer_name,
                c.phone AS customer_phone,
                b.name AS branch_name,
                u.username AS cashier_name
            FROM invoices i
            LEFT JOIN customers c ON i.customer_id = c.id
            LEFT JOIN branches b ON i.branch_id = b.id
            LEFT JOIN users u ON i.user_id = u.id
            WHERE i.id = $1
        `, [req.params.id]);

        if (invoiceResult.rows.length === 0) {
            return res.status(404).json({ error: "Invoice not found" });
        }

        const itemsResult = await pool.query(`
            SELECT *
            FROM invoice_items
            WHERE invoice_id = $1
            ORDER BY id
        `, [req.params.id]);

        res.json({
            invoice: invoiceResult.rows[0],
            items: itemsResult.rows
        });

    } catch (err) {
        console.error("INVOICE DETAILS ERROR:", err);
        res.status(500).json({ error: "Invoice details failed" });
    }
});
// PURCHASE ORDER REPORT
app.get("/purchase-orders-report", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                po.id,
                s.name AS supplier_name,
                p.name AS product_name,
                p.barcode,
                b.name AS branch_name,
                po.qty,
                po.status,
                po.date
            FROM purchase_orders po
            JOIN suppliers s ON po.supplier_id = s.id
            JOIN products p ON po.product_id = p.id
            LEFT JOIN branches b ON po.branch_id = b.id
            ORDER BY po.date DESC
        `);

        res.json(result.rows);
    } catch (err) {
        console.error("PO REPORT ERROR:", err);
        res.status(500).json({ error: "Purchase order report failed" });
    }
});
// SUPPLIER PURCHASE HISTORY
app.get("/supplier-history/:id", async (req, res) => {
    const supplierId = req.params.id;

    try {
        const result = await pool.query(`
            SELECT 
                po.id,
                s.name AS supplier_name,
                p.name AS product_name,
                p.barcode,
                b.name AS branch_name,
                po.qty,
                po.status,
                po.date
            FROM purchase_orders po
            JOIN suppliers s ON po.supplier_id = s.id
            JOIN products p ON po.product_id = p.id
            LEFT JOIN branches b ON po.branch_id = b.id
            WHERE po.supplier_id = $1
            ORDER BY po.date DESC
        `, [supplierId]);

        res.json(result.rows);
    } catch (err) {
        console.error("SUPPLIER HISTORY ERROR:", err);
        res.status(500).json({ error: "Supplier history failed" });
    }
});
// RETURN TO SUPPLIER
app.post("/supplier-returns", verifyToken, async (req, res) => {
    const { supplier_id, product_id, branch_id, qty, reason } = req.body;

    if (!supplier_id || !product_id || !branch_id || !qty || Number(qty) <= 0) {
        return res.status(400).json({ error: "Please select supplier/product/branch and valid quantity" });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const productResult = await client.query(
            "SELECT * FROM products WHERE id = $1",
            [product_id]
        );

        const product = productResult.rows[0];

        if (!product) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Product not found" });
        }

        const branchStockResult = await client.query(
            "SELECT stock FROM branch_stock WHERE branch_id = $1 AND product_id = $2",
            [branch_id, product_id]
        );

        if (
            branchStockResult.rows.length === 0 ||
            Number(branchStockResult.rows[0].stock) < Number(qty)
        ) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Not enough stock in selected branch" });
        }

        await client.query(
            "UPDATE branch_stock SET stock = stock - $1 WHERE branch_id = $2 AND product_id = $3",
            [Number(qty), branch_id, product_id]
        );

        await client.query(
            "UPDATE products SET stock = stock - $1 WHERE id = $2",
            [Number(qty), product_id]
        );

        await client.query(
            `INSERT INTO supplier_returns 
             (supplier_id, product_id, branch_id, qty, reason)
             VALUES ($1, $2, $3, $4, $5)`,
            [supplier_id, product_id, branch_id, Number(qty), reason || ""]
        );

        await client.query("COMMIT");

        res.json({ message: "Return to supplier completed" });

    } catch (err) {
        await client.query("ROLLBACK");
        console.error("SUPPLIER RETURN ERROR:", err);
        res.status(500).json({ error: "Supplier return failed" });
    } finally {
        client.release();
    }
});

app.get("/supplier-returns", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                sr.id,
                s.name AS supplier_name,
                p.name AS product_name,
                p.barcode,
                b.name AS branch_name,
                sr.qty,
                sr.reason,
                sr.date
            FROM supplier_returns sr
            JOIN suppliers s ON sr.supplier_id = s.id
            JOIN products p ON sr.product_id = p.id
            JOIN branches b ON sr.branch_id = b.id
            ORDER BY sr.date DESC
        `);

        res.json(result.rows);
    } catch (err) {
        console.error("SUPPLIER RETURNS LOAD ERROR:", err);
        res.status(500).json({ error: "Supplier returns failed to load" });
    }
});
// FILTERED PURCHASE ORDER REPORT
app.get("/purchase-orders-filtered", async (req, res) => {
    const { status, supplier_id, branch_id } = req.query;

    try {
        let query = `
            SELECT 
                po.id,
                s.id AS supplier_id,
                s.name AS supplier_name,
                p.name AS product_name,
                p.barcode,
                b.id AS branch_id,
                b.name AS branch_name,
                po.qty,
                po.status,
                po.date
            FROM purchase_orders po
            JOIN suppliers s ON po.supplier_id = s.id
            JOIN products p ON po.product_id = p.id
            LEFT JOIN branches b ON po.branch_id = b.id
            WHERE 1=1
        `;

        const params = [];

        if (status) {
            params.push(status);
            query += ` AND po.status = $${params.length}`;
        }

        if (supplier_id) {
            params.push(supplier_id);
            query += ` AND po.supplier_id = $${params.length}`;
        }

        if (branch_id) {
            params.push(branch_id);
            query += ` AND po.branch_id = $${params.length}`;
        }

        query += ` ORDER BY po.date DESC`;

        const result = await pool.query(query, params);

        res.json(result.rows);
    } catch (err) {
        console.error("FILTERED PO REPORT ERROR:", err);
        res.status(500).json({ error: "Filtered PO report failed" });
    }
});
// FILTERED SUPPLIER RETURNS REPORT
app.get("/supplier-returns-filtered", async (req, res) => {
    const { supplier_id, branch_id } = req.query;

    try {
        let query = `
            SELECT 
                sr.id,
                s.id AS supplier_id,
                s.name AS supplier_name,
                p.name AS product_name,
                p.barcode,
                b.id AS branch_id,
                b.name AS branch_name,
                sr.qty,
                sr.reason,
                sr.date
            FROM supplier_returns sr
            JOIN suppliers s ON sr.supplier_id = s.id
            JOIN products p ON sr.product_id = p.id
            JOIN branches b ON sr.branch_id = b.id
            WHERE 1=1
        `;

        const params = [];

        if (supplier_id) {
            params.push(supplier_id);
            query += ` AND sr.supplier_id = $${params.length}`;
        }

        if (branch_id) {
            params.push(branch_id);
            query += ` AND sr.branch_id = $${params.length}`;
        }

        query += ` ORDER BY sr.date DESC`;

        const result = await pool.query(query, params);

        res.json(result.rows);
    } catch (err) {
        console.error("FILTERED SUPPLIER RETURNS ERROR:", err);
        res.status(500).json({ error: "Filtered supplier returns failed" });
    }
});
// SUPPLIER BALANCE / NET PURCHASE REPORT
app.get("/supplier-balance-report", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                s.id AS supplier_id,
                s.name AS supplier_name,

                COALESCE(received.total_received_qty, 0) AS total_received_qty,
                COALESCE(received.total_received_value, 0) AS total_received_value,

                COALESCE(returns.total_returned_qty, 0) AS total_returned_qty,
                COALESCE(returns.total_returned_value, 0) AS total_returned_value,

                COALESCE(received.total_received_qty, 0) - COALESCE(returns.total_returned_qty, 0) AS net_qty,
                COALESCE(received.total_received_value, 0) - COALESCE(returns.total_returned_value, 0) AS net_value

            FROM suppliers s

            LEFT JOIN (
                SELECT
                    po.supplier_id,
                    SUM(po.qty) AS total_received_qty,
                    SUM(po.qty * COALESCE(p.cost, 0)) AS total_received_value
                FROM purchase_orders po
                JOIN products p ON po.product_id = p.id
                WHERE po.status = 'Received'
                GROUP BY po.supplier_id
            ) received ON s.id = received.supplier_id

            LEFT JOIN (
                SELECT
                    sr.supplier_id,
                    SUM(sr.qty) AS total_returned_qty,
                    SUM(sr.qty * COALESCE(p.cost, 0)) AS total_returned_value
                FROM supplier_returns sr
                JOIN products p ON sr.product_id = p.id
                GROUP BY sr.supplier_id
            ) returns ON s.id = returns.supplier_id

            ORDER BY s.name
        `);

        res.json(result.rows);

    } catch (err) {
        console.error("SUPPLIER BALANCE REPORT ERROR:", err);
        res.status(500).json({ error: "Supplier balance report failed" });
    }
});
// CUSTOMER RETURNS
app.post("/customer-returns", verifyToken, async (req, res) => {
    const { customer_id, invoice_id, product_id, branch_id, qty, reason } = req.body;

    if (!product_id || !branch_id || !qty || Number(qty) <= 0) {
        return res.status(400).json({ error: "Please select product, branch, and valid return quantity" });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const productResult = await client.query(
            "SELECT * FROM products WHERE id = $1",
            [product_id]
        );

        const product = productResult.rows[0];

        if (!product) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Product not found" });
        }

        await client.query(`
            INSERT INTO branch_stock (branch_id, product_id, stock)
            VALUES ($1, $2, $3)
            ON CONFLICT (branch_id, product_id)
            DO UPDATE SET stock = branch_stock.stock + EXCLUDED.stock
        `, [branch_id, product_id, Number(qty)]);

        await client.query(
            "UPDATE products SET stock = stock + $1 WHERE id = $2",
            [Number(qty), product_id]
        );

        await client.query(`
            INSERT INTO customer_returns 
            (customer_id, invoice_id, product_id, branch_id, qty, refund_amount, reason)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
            customer_id || null,
            invoice_id || null,
            product_id,
            branch_id,
            Number(qty),
            calculatedRefundAmount,
            reason || ""
        ]);
let calculatedRefundAmount = 0;

if (invoice_id) {
    const invoiceItemResult = await client.query(`
        SELECT unit_price
        FROM invoice_items
        WHERE invoice_id = $1
        AND product_id = $2
        LIMIT 1
    `, [invoice_id, product_id]);

    if (invoiceItemResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
            error: "Selected product was not found in selected invoice"
        });
    }

    calculatedRefundAmount =
        Number(invoiceItemResult.rows[0].unit_price || 0) * Number(qty);
} else {
    calculatedRefundAmount = Number(product.price || 0) * Number(qty);
}
        await client.query("COMMIT");

        res.json({ message: "Customer return completed successfully" });

    } catch (err) {
        await client.query("ROLLBACK");
        console.error("CUSTOMER RETURN ERROR:", err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.get("/customer-returns", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                cr.id,
                c.name AS customer_name,
                c.phone AS customer_phone,
                i.invoice_no,
                p.name AS product_name,
                p.barcode,
                b.name AS branch_name,
                cr.qty,
                cr.refund_amount,
                cr.reason,
                cr.date
            FROM customer_returns cr
            LEFT JOIN customers c ON cr.customer_id = c.id
            LEFT JOIN invoices i ON cr.invoice_id = i.id
            JOIN products p ON cr.product_id = p.id
            JOIN branches b ON cr.branch_id = b.id
            ORDER BY cr.date DESC
        `);

        res.json(result.rows);
    } catch (err) {
        console.error("CUSTOMER RETURNS LOAD ERROR:", err);
        res.status(500).json({ error: "Customer returns failed to load" });
    }
});
// CURRENCY SETTINGS
app.get("/currency-settings", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT setting_key, setting_value
            FROM system_settings
        `);

        const settings = {};

        result.rows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
        });

        res.json({
            default_currency: settings.default_currency || "USD",
            usd_to_lbp_rate: Number(settings.usd_to_lbp_rate || 89500)
        });

    } catch (err) {
        console.error("CURRENCY SETTINGS ERROR:", err);
        res.status(500).json({ error: "Currency settings failed to load" });
    }
});

app.put("/currency-settings", verifyToken, adminOnly, async (req, res) => {
    const { default_currency, usd_to_lbp_rate } = req.body;

    if (!["USD", "LBP"].includes(default_currency)) {
        return res.status(400).json({ error: "Currency must be USD or LBP" });
    }

    if (!usd_to_lbp_rate || Number(usd_to_lbp_rate) <= 0) {
        return res.status(400).json({ error: "Exchange rate must be valid" });
    }

    try {
        await pool.query(`
            INSERT INTO system_settings (setting_key, setting_value)
            VALUES ('default_currency', $1)
            ON CONFLICT (setting_key)
            DO UPDATE SET setting_value = EXCLUDED.setting_value
        `, [default_currency]);

        await pool.query(`
            INSERT INTO system_settings (setting_key, setting_value)
            VALUES ('usd_to_lbp_rate', $1)
            ON CONFLICT (setting_key)
            DO UPDATE SET setting_value = EXCLUDED.setting_value
        `, [String(usd_to_lbp_rate)]);

        res.json({ message: "Currency settings updated" });

    } catch (err) {
        console.error("UPDATE CURRENCY SETTINGS ERROR:", err);
        res.status(500).json({ error: "Currency settings update failed" });
    }
});

// STOCK ADJUSTMENTS
app.post("/stock-adjustments", verifyToken, async (req, res) => {
    const { branch_id, product_id, adjustment_type, qty, reason } = req.body;

    if (!branch_id || !product_id || !adjustment_type || !qty || Number(qty) <= 0) {
        return res.status(400).json({ error: "Please select branch, product, adjustment type, and valid quantity" });
    }

    if (!["increase", "decrease"].includes(adjustment_type)) {
        return res.status(400).json({ error: "Adjustment type must be increase or decrease" });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const productResult = await client.query(
            "SELECT * FROM products WHERE id = $1",
            [product_id]
        );

        const product = productResult.rows[0];

        if (!product) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Product not found" });
        }

        const qtyNumber = Number(qty);

        if (adjustment_type === "decrease") {
            const branchStockResult = await client.query(
                "SELECT stock FROM branch_stock WHERE branch_id = $1 AND product_id = $2",
                [branch_id, product_id]
            );

            if (
                branchStockResult.rows.length === 0 ||
                Number(branchStockResult.rows[0].stock) < qtyNumber
            ) {
                await client.query("ROLLBACK");
                return res.status(400).json({ error: "Not enough stock in selected branch to decrease" });
            }

            await client.query(
                "UPDATE branch_stock SET stock = stock - $1 WHERE branch_id = $2 AND product_id = $3",
                [qtyNumber, branch_id, product_id]
            );

            await client.query(
                "UPDATE products SET stock = stock - $1 WHERE id = $2",
                [qtyNumber, product_id]
            );
        }

        if (adjustment_type === "increase") {
            await client.query(`
                INSERT INTO branch_stock (branch_id, product_id, stock)
                VALUES ($1, $2, $3)
                ON CONFLICT (branch_id, product_id)
                DO UPDATE SET stock = branch_stock.stock + EXCLUDED.stock
            `, [branch_id, product_id, qtyNumber]);

            await client.query(
                "UPDATE products SET stock = stock + $1 WHERE id = $2",
                [qtyNumber, product_id]
            );
        }

const unitCost = Number(product.cost || 0);
const totalCostValue = unitCost * qtyNumber;

await client.query(`
    INSERT INTO stock_adjustments
    (branch_id, product_id, adjustment_type, qty, reason, user_id, unit_cost, total_cost_value)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
`, [
    branch_id,
    product_id,
    adjustment_type,
    qtyNumber,
    reason || "",
    req.user.id,
    unitCost,
    totalCostValue
]);

        await client.query("COMMIT");

        res.json({ message: "Stock adjustment saved successfully" });

    } catch (err) {
        await client.query("ROLLBACK");
        console.error("STOCK ADJUSTMENT ERROR:", err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.get("/stock-adjustments", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                sa.id,
                b.name AS branch_name,
                p.name AS product_name,
                p.barcode,
                sa.adjustment_type,
                sa.qty,
                sa.reason,
                sa.unit_cost,
                sa.total_cost_value,
                u.username AS username,
                sa.date
            FROM stock_adjustments sa
            JOIN branches b ON sa.branch_id = b.id
            JOIN products p ON sa.product_id = p.id
            LEFT JOIN users u ON sa.user_id = u.id
            ORDER BY sa.date DESC
        `);

        res.json(result.rows);
    } catch (err) {
        console.error("LOAD STOCK ADJUSTMENTS ERROR:", err);
        res.status(500).json({ error: "Stock adjustments failed to load" });
    }
});
// FILTERED STOCK ADJUSTMENT REPORT
app.get("/stock-adjustments-report", async (req, res) => {
    const { branch_id, product_id, adjustment_type, date_from, date_to } = req.query;

    try {
        let query = `
            SELECT 
                sa.id,
                b.id AS branch_id,
                b.name AS branch_name,
                p.id AS product_id,
                p.name AS product_name,
                p.barcode,
                sa.adjustment_type,
                sa.qty,
                sa.unit_cost,
                sa.total_cost_value,
                sa.reason,
                u.username AS username,
                sa.date
            FROM stock_adjustments sa
            JOIN branches b ON sa.branch_id = b.id
            JOIN products p ON sa.product_id = p.id
            LEFT JOIN users u ON sa.user_id = u.id
            WHERE 1=1
        `;

        const params = [];

        if (branch_id) {
            params.push(branch_id);
            query += ` AND sa.branch_id = $${params.length}`;
        }

        if (product_id) {
            params.push(product_id);
            query += ` AND sa.product_id = $${params.length}`;
        }

        if (adjustment_type) {
            params.push(adjustment_type);
            query += ` AND sa.adjustment_type = $${params.length}`;
        }

        if (date_from) {
            params.push(date_from);
            query += ` AND DATE(sa.date) >= $${params.length}`;
        }

        if (date_to) {
            params.push(date_to);
            query += ` AND DATE(sa.date) <= $${params.length}`;
        }

        query += ` ORDER BY sa.date DESC`;

        const result = await pool.query(query, params);

        res.json(result.rows);

    } catch (err) {
        console.error("STOCK ADJUSTMENT REPORT ERROR:", err);
        res.status(500).json({ error: "Stock adjustment report failed" });
    }
});
// UPDATE BRANCH MIN STOCK
app.put("/branch-stock/min-stock", verifyToken, async (req, res) => {
    const { branch_id, product_id, min_stock } = req.body;

    if (!branch_id || !product_id || min_stock === undefined || Number(min_stock) < 0) {
        return res.status(400).json({ error: "Please select branch/product and valid minimum stock" });
    }

    try {
        await pool.query(`
            INSERT INTO branch_stock (branch_id, product_id, stock, min_stock)
            VALUES ($1, $2, 0, $3)
            ON CONFLICT (branch_id, product_id)
            DO UPDATE SET min_stock = EXCLUDED.min_stock
        `, [branch_id, product_id, Number(min_stock)]);

        res.json({ message: "Minimum stock updated" });

    } catch (err) {
        console.error("MIN STOCK UPDATE ERROR:", err);
        res.status(500).json({ error: "Minimum stock update failed" });
    }
});

// LOW STOCK ALERTS BY BRANCH
app.get("/low-stock-branch-report", async (req, res) => {
    const { branch_id } = req.query;

    try {
        let query = `
            SELECT 
                bs.id,
                b.id AS branch_id,
                b.name AS branch_name,
                p.id AS product_id,
                p.name AS product_name,
                p.barcode,
                bs.stock,
                COALESCE(bs.min_stock, 0) AS min_stock,
                GREATEST(COALESCE(bs.min_stock, 0) - COALESCE(bs.stock, 0), 0) AS reorder_qty
            FROM branch_stock bs
            JOIN branches b ON bs.branch_id = b.id
            JOIN products p ON bs.product_id = p.id
            WHERE COALESCE(bs.stock, 0) <= COALESCE(bs.min_stock, 0)
            AND COALESCE(bs.min_stock, 0) > 0
        `;

        const params = [];

        if (branch_id) {
            params.push(branch_id);
            query += ` AND bs.branch_id = $${params.length}`;
        }

        query += ` ORDER BY b.name, p.name`;

        const result = await pool.query(query, params);

        res.json(result.rows);

    } catch (err) {
        console.error("LOW STOCK BRANCH REPORT ERROR:", err);
        res.status(500).json({ error: "Low stock branch report failed" });
    }
});
// REORDER SUGGESTIONS BY BRANCH
app.get("/reorder-suggestions", async (req, res) => {
    const { branch_id } = req.query;

    try {
        let query = `
            SELECT 
                bs.branch_id,
                b.name AS branch_name,
                bs.product_id,
                p.name AS product_name,
                p.barcode,
                p.cost,
                bs.stock,
                COALESCE(bs.min_stock, 0) AS min_stock,
                GREATEST(COALESCE(bs.min_stock, 0) - COALESCE(bs.stock, 0), 0) AS suggested_qty
            FROM branch_stock bs
            JOIN branches b ON bs.branch_id = b.id
            JOIN products p ON bs.product_id = p.id
            WHERE COALESCE(bs.min_stock, 0) > 0
            AND COALESCE(bs.stock, 0) <= COALESCE(bs.min_stock, 0)
        `;

        const params = [];

        if (branch_id) {
            params.push(branch_id);
            query += ` AND bs.branch_id = $${params.length}`;
        }

        query += ` ORDER BY b.name, p.name`;

        const result = await pool.query(query, params);

        res.json(result.rows);

    } catch (err) {
        console.error("REORDER SUGGESTIONS ERROR:", err);
        res.status(500).json({ error: "Reorder suggestions failed" });
    }
});
// FINAL STOCK AUDIT REPORT
app.get("/stock-audit-report", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                p.id AS product_id,
                p.name AS product_name,
                p.barcode,
                COALESCE(p.stock, 0) AS product_stock,
                COALESCE(branch_totals.branch_stock_total, 0) AS branch_stock_total,
                COALESCE(p.stock, 0) - COALESCE(branch_totals.branch_stock_total, 0) AS difference,
                p.cost,
                (COALESCE(p.stock, 0) - COALESCE(branch_totals.branch_stock_total, 0)) * COALESCE(p.cost, 0) AS difference_value
            FROM products p
            LEFT JOIN (
                SELECT 
                    product_id,
                    SUM(stock) AS branch_stock_total
                FROM branch_stock
                GROUP BY product_id
            ) branch_totals ON p.id = branch_totals.product_id
            ORDER BY ABS(COALESCE(p.stock, 0) - COALESCE(branch_totals.branch_stock_total, 0)) DESC, p.name
        `);

        res.json(result.rows);

    } catch (err) {
        console.error("STOCK AUDIT REPORT ERROR:", err);
        res.status(500).json({ error: "Stock audit report failed" });
    }
});

// OPTIONAL: SYNC PRODUCT STOCK FROM BRANCH STOCK
app.post("/sync-product-stock-from-branches", verifyToken, adminOnly, async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const result = await client.query(`
            UPDATE products p
            SET stock = COALESCE(branch_totals.branch_stock_total, 0)
            FROM (
                SELECT 
                    product_id,
                    SUM(stock) AS branch_stock_total
                FROM branch_stock
                GROUP BY product_id
            ) branch_totals
            WHERE p.id = branch_totals.product_id
        `);

        await client.query(`
            UPDATE products p
            SET stock = 0
            WHERE NOT EXISTS (
                SELECT 1 
                FROM branch_stock bs 
                WHERE bs.product_id = p.id
            )
        `);

        await client.query("COMMIT");

        res.json({
            message: "Product stock synced from branch stock successfully",
            updated: result.rowCount
        });

    } catch (err) {
        await client.query("ROLLBACK");
        console.error("SYNC PRODUCT STOCK ERROR:", err);
        res.status(500).json({ error: "Stock sync failed: " + err.message });
    } finally {
        client.release();
    }
});
// GET ITEMS FOR SELECTED INVOICE
app.get("/invoice-items/:invoiceId", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                ii.id,
                ii.invoice_id,
                ii.product_id,
                ii.product_name,
                ii.barcode,
                ii.qty,
                ii.unit_price,
                ii.line_total
            FROM invoice_items ii
            WHERE ii.invoice_id = $1
            ORDER BY ii.id
        `, [req.params.invoiceId]);

        res.json(result.rows);

    } catch (err) {
        console.error("INVOICE ITEMS ERROR:", err);
        res.status(500).json({ error: "Invoice items failed to load" });
    }
});

// START SERVER
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});