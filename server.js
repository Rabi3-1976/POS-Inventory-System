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

// TEMP SETUP ADMIN - REMOVE AFTER LOGIN WORKS
app.get("/setup-admin", async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash("1234", 10);

        await pool.query(`
            INSERT INTO users (username, password, role)
            VALUES ($1, $2, $3)
            ON CONFLICT (username) DO UPDATE
            SET password = EXCLUDED.password,
                role = EXCLUDED.role
        `, ["admin", hashedPassword, "admin"]);

        res.send("Admin user ready. Username: admin / Password: 1234");
    } catch (err) {
        console.error(err);
        res.status(500).send("Setup admin failed: " + err.message);
    }
});

// TEMP DB TEST - REMOVE LATER
app.get("/db-test", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");
        res.json({ status: "Database connected", time: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

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
app.post("/create-user", async (req, res) => {
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

    try {
        await pool.query("DELETE FROM sales WHERE product_id = $1", [id]);
        await pool.query("DELETE FROM receiving WHERE product_id = $1", [id]);
        await pool.query("DELETE FROM purchase_orders WHERE product_id = $1", [id]);
        await pool.query("DELETE FROM products WHERE id = $1", [id]);

        res.json({ message: "Product and related data deleted" });
    } catch (err) {
        res.status(400).json({ error: "Delete product failed" });
    }
});

// RECEIVING
app.post("/receiving", async (req, res) => {
    const { product_id, qty } = req.body;

    if (!qty || qty <= 0) return res.status(400).json({ error: "Invalid quantity" });

    try {
        await pool.query("BEGIN");

        await pool.query(
            "INSERT INTO receiving (product_id, qty) VALUES ($1, $2)",
            [product_id, qty]
        );

        await pool.query(
            "UPDATE products SET stock = stock + $1 WHERE id = $2",
            [qty, product_id]
        );

        await pool.query("COMMIT");

        res.json({ message: "Stock received successfully" });
    } catch (err) {
        await pool.query("ROLLBACK");
        res.status(500).json({ error: "Receiving failed" });
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
        const products = await pool.query("SELECT COUNT(*) FROM products");
        const stock = await pool.query("SELECT COALESCE(SUM(stock),0) FROM products");
        const sales = await pool.query("SELECT COALESCE(SUM(price),0) FROM sales");
        const profit = await pool.query("SELECT COALESCE(SUM(profit),0) FROM sales");
        const lowStock = await pool.query("SELECT COUNT(*) FROM products WHERE stock <= 5");

        res.json({
            totalProducts: Number(products.rows[0].count),
            totalStock: Number(stock.rows[0].coalesce),
            totalSales: Number(sales.rows[0].coalesce),
            totalProfit: Number(profit.rows[0].coalesce),
            lowStock: Number(lowStock.rows[0].count)
        });
    } catch (err) {
        res.status(500).json({ error: "Dashboard failed" });
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
    const { supplier_id, product_id, qty } = req.body;

    try {
        await pool.query(
            "INSERT INTO purchase_orders (supplier_id, product_id, qty) VALUES ($1, $2, $3)",
            [supplier_id, product_id, qty]
        );

        res.json({ message: "Purchase order created" });
    } catch (err) {
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
                po.qty,
                po.status,
                po.date
            FROM purchase_orders po
            JOIN suppliers s ON po.supplier_id = s.id
            JOIN products p ON po.product_id = p.id
            ORDER BY po.date DESC
        `);

        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Purchase orders failed" });
    }
});

app.put("/purchase-orders/:id/receive", verifyToken, adminOnly, async (req, res) => {
    const poId = req.params.id;

    try {
        const result = await pool.query("SELECT * FROM purchase_orders WHERE id = $1", [poId]);
        const po = result.rows[0];

        if (!po) return res.status(404).json({ error: "Purchase order not found" });
        if (po.status === "Received") return res.status(400).json({ error: "Purchase order already received" });

        await pool.query("BEGIN");

        await pool.query(
            "INSERT INTO receiving (product_id, qty) VALUES ($1, $2)",
            [po.product_id, po.qty]
        );

        await pool.query(
            "UPDATE products SET stock = stock + $1 WHERE id = $2",
            [po.qty, po.product_id]
        );

        await pool.query(
            "UPDATE purchase_orders SET status = 'Received' WHERE id = $1",
            [poId]
        );

        await pool.query("COMMIT");

        res.json({ message: "Purchase order received and stock updated" });
    } catch (err) {
        await pool.query("ROLLBACK");
        res.status(500).json({ error: "Receive PO failed" });
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

// START SERVER
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});