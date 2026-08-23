// server.js
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const multer = require("multer");
const XLSX = require("xlsx");
const fs = require("fs");
const pool = require("./database");
const productRoutes = require('./routes/products');
const branchRoutes = require('./routes/branches');
const missingRoutes = require('./routes/missing_routes');  // ✅ NEW LINE 1

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = "secretkey";

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use('/api/products', productRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api', missingRoutes);  // ✅ NEW LINE 2

// =====================================================
// IMPORT ROUTES
// =====================================================
const transactionRoutes = require('./routes/transactions');

// =====================================================
// ROOT ENDPOINTS
// =====================================================

// Welcome route
app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to POS Inventory System API',
        version: '1.0.0',
        endpoints: {
            '/api': 'API information',
            '/api/transactions/sales': 'POST - Process a sale',
            '/api/transactions/branch-sales': 'POST - Process a branch sale',
            '/api/transactions/sales-summary': 'GET - Get sales summary',
            '/api/transactions/branch-sales-summary': 'GET - Get branch sales summary',
            '/api/transactions/product-performance': 'GET - Get product performance',
            '/api/transactions/purchase-orders': 'GET - Get purchase orders',
            '/api/transactions/customer-history': 'GET - Get customer history',
            '/api/transactions/daily-report': 'GET - Get daily sales report',
            '/api/transactions/branch-stock': 'GET - Get branch stock',
            '/api/transactions/dashboard/stats': 'GET - Get dashboard statistics',
            '/health': 'GET - Health check'
        }
    });
});

// API information route
app.get('/api', (req, res) => {
    res.json({
        name: 'POS Inventory System API',
        version: '1.0.0',
        description: 'API for managing sales, inventory, and transactions',
        endpoints: {
            'transactions': {
                'POST /api/transactions/sales': 'Process a sale',
                'POST /api/transactions/branch-sales': 'Process a branch sale',
                'GET /api/transactions/sales-summary': 'Get sales summary',
                'GET /api/transactions/branch-sales-summary': 'Get branch sales summary',
                'GET /api/transactions/product-performance': 'Get product performance',
                'GET /api/transactions/purchase-orders': 'Get purchase orders',
                'GET /api/transactions/customer-history': 'Get customer history',
                'GET /api/transactions/daily-report': 'Get daily sales report',
                'GET /api/transactions/branch-stock': 'Get branch stock',
                'GET /api/transactions/dashboard/stats': 'Get dashboard statistics'
            },
            'health': {
                'GET /health': 'Health check'
            }
        }
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Use transaction routes
app.use('/api/transactions', transactionRoutes);

// =====================================================
// AUTH MIDDLEWARE
// =====================================================

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

// =====================================================
// AUTH ENDPOINTS
// =====================================================

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

// =====================================================
// PRODUCTS ENDPOINTS
// =====================================================

app.get("/products", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM products ORDER BY id DESC");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to load products" });
    }
});

app.post("/products", verifyToken, adminOnly, async (req, res) => {
    const { name, barcode, price, cost, uom } = req.body;

    try {
        await pool.query(
            "INSERT INTO products (name, barcode, price, cost, stock, uom) VALUES ($1, $2, $3, $4, 0, $5)",
            [name.trim(), barcode.trim(), Number(price), Number(cost || 0), uom || "pcs"]   
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

app.put("/products/:id/name", verifyToken, adminOnly, async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ error: "Product name is required" });
    }

    try {
        const duplicate = await pool.query(
            "SELECT id FROM products WHERE LOWER(name) = LOWER($1) AND id <> $2",
            [name.trim(), id]
        );

        if (duplicate.rows.length > 0) {
            return res.status(400).json({ error: "Another product with this name already exists" });
        }

        const result = await pool.query(
            "UPDATE products SET name = $1 WHERE id = $2 RETURNING *",
            [name.trim(), id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }

        res.json({ message: "Product name updated successfully", product: result.rows[0] });

    } catch (err) {
        console.error("UPDATE PRODUCT NAME ERROR:", err);
        res.status(500).json({ error: "Product name update failed: " + err.message });
    }
});

app.put("/products/:id/uom", verifyToken, adminOnly, async (req, res) => {
    const { id } = req.params;
    const { uom } = req.body;

    if (!uom || !uom.trim()) {
        return res.status(400).json({ error: "Unit of measure is required" });
    }

    try {
        const result = await pool.query(
            "UPDATE products SET uom = $1 WHERE id = $2 RETURNING *",
            [uom.trim().toUpperCase(), id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }

        res.json({
            message: "Product UOM updated successfully",
            product: result.rows[0]
        });

    } catch (err) {
        console.error("UPDATE PRODUCT UOM ERROR:", err);
        res.status(500).json({
            error: "Product UOM update failed: " + err.message
        });
    }
});

// =====================================================
// RECEIVING ENDPOINTS
// =====================================================

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

app.get("/receiving-report", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                r.id,
                p.name AS product_name,
                p.barcode,
                COALESCE(p.uom, 'PCS') AS uom,
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

// =====================================================
// SALES ENDPOINTS
// =====================================================

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

app.get("/sales-report", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                s.id,
                p.name AS product_name,
                p.barcode,
                COALESCE(p.uom, 'PCS') AS uom,
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

// =====================================================
// DASHBOARD ENDPOINTS
// =====================================================

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
            totalProducts: Number(products.rows[0].total_products),
            totalStock: Number(stock.rows[0].total_stock),
            totalSales: Number(sales.rows[0].total_sales),
            totalProfit: Number(profit.rows[0].total_profit),
            lowStock: Number(lowStock.rows[0].low_stock)
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Dashboard failed" });
    }
});

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

// =====================================================
// SUPPLIERS ENDPOINTS
// =====================================================

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

// =====================================================
// BRANCHES ENDPOINTS
// =====================================================

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

// =====================================================
// 404 HANDLER
// =====================================================

app.use((req, res) => {
    res.status(404).json({
        error: 'Route not found',
        message: `Cannot ${req.method} ${req.originalUrl}`
    });
});

// =====================================================
// ERROR HANDLER
// =====================================================

app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
    });
});

// =====================================================
// START SERVER
// =====================================================

// Wait for database to be ready before starting server
const startServer = async () => {
    try {
        // Wait for database initialization to complete
        await pool.databaseReady;
        
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Visit http://localhost:${PORT} for API information`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();