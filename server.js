const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./database');
const app = express();
const path = require('path');
const PORT = process.env.PORT || 3000;
const multer = require('multer');
const XLSX = require('xlsx');

const upload = multer({ dest: 'uploads/' });

app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());
app.use(express.json());

app.get('/setup-admin', async (req, res) => {
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
        console.error("Setup admin error:", err);
        res.status(500).send("Setup admin failed: " + err.message);
    }
});

const SECRET = "secretkey";
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

// ================= LOGIN =================
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
        if (err || !user) return res.status(400).json({ error: "User not found" });

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(400).json({ error: "Invalid password" });

        const token = jwt.sign({ id: user.id, role: user.role }, SECRET);
        res.json({ token, role: user.role });
    });
});

// ================= CREATE USER =================
app.post('/create-user', async (req, res) => {
    const { username, password, role } = req.body;

    const hashed = await bcrypt.hash(password, 10);

    db.run(
        "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
        [username, hashed, role],
        function (err) {
            if (err) return res.status(400).json({ error: "User already exists" });
            res.json({ message: "User created" });
        }
    );
});

// ================= ADD PRODUCT =================
app.post('/products', verifyToken, adminOnly, (req, res) => {
    const { name, barcode, price, cost } = req.body;

    db.run(
        "INSERT INTO products (name, barcode, price, cost) VALUES (?, ?, ?, ?)",
        [name, barcode, price, cost],
        function (err) {
            if (err) return res.status(400).json({ error: "Duplicate product or barcode" });
            res.json({ message: "Product added" });
        }
    );
});

// ================= GET PRODUCTS =================
app.get('/products', (req, res) => {
    db.all("SELECT * FROM products", [], (err, rows) => {
        res.json(rows);
    });
});

// ================= RECEIVING =================
app.post('/receiving', (req, res) => {
    const { product_id, qty } = req.body;

    if (!qty || qty <= 0) {
        return res.status(400).json({ error: "Invalid quantity" });
    }

    db.run(
        "INSERT INTO receiving (product_id, qty, date) VALUES (?, ?, datetime('now'))",
        [product_id, qty]
    );

    db.run(
        "UPDATE products SET stock = stock + ? WHERE id = ?",
        [qty, product_id]
    );

    res.json({ message: "Stock received successfully" });
});

// ================= SALES =================
app.post('/sales', (req, res) => {
    const { product_id, qty } = req.body;

    db.get("SELECT * FROM products WHERE id = ?", [product_id], (err, p) => {
        if (!p) return res.status(400).json({ error: "Product not found" });

        if (p.stock < qty) {
            return res.status(400).json({ error: "Not enough stock" });
        }

        const totalPrice = p.price * qty;
        const totalCost = p.cost * qty;
        const profit = totalPrice - totalCost;

        db.run(
            "INSERT INTO sales (product_id, qty, price, cost, profit, date) VALUES (?, ?, ?, ?, ?, datetime('now'))",
            [product_id, qty, totalPrice, totalCost, profit]
        );

        db.run(
            "UPDATE products SET stock = stock - ? WHERE id = ?",
            [qty, product_id]
        );

        res.json({ message: "Sale recorded", profit });
    });
});
//================= DELETE PRODUCT =================
app.delete('/products/:id', verifyToken, adminOnly, (req, res) => {
    const id = req.params.id;

    db.run("DELETE FROM sales WHERE product_id = ?", [id]);
    db.run("DELETE FROM receiving WHERE product_id = ?", [id]);
    db.run("DELETE FROM products WHERE id = ?", [id]);

    res.json({ message: "Product and related data deleted" });
});
// ================= DASHBOARD DATA =================
app.get('/dashboard', (req, res) => {
    const data = {};

    db.get("SELECT COUNT(*) AS totalProducts FROM products", [], (err, row) => {
        data.totalProducts = row.totalProducts;

        db.get("SELECT SUM(stock) AS totalStock FROM products", [], (err, row) => {
            data.totalStock = row.totalStock || 0;

            db.get("SELECT SUM(s.qty * p.price) AS totalSales FROM sales s JOIN products p ON s.product_id = p.id", [], (err, row) => {
                data.totalSales = row.totalSales || 0;

                db.get("SELECT SUM(profit) AS totalProfit FROM sales", [], (err, row) => {
                data.totalProfit = row.totalProfit || 0;

                db.get("SELECT COUNT(*) AS lowStock FROM products WHERE stock <= 5", [], (err, row) => {
                    data.lowStock = row.lowStock;
                    res.json(data);
                });
            });
        });
    });
});
});
app.get('/sales-report', (req, res) => {
    db.all(`
        SELECT 
            s.id,
            p.name AS product_name,
            p.barcode,
            s.qty,
            p.price,
            (s.qty * p.price) AS total,
            s.date
        FROM sales s
        JOIN products p ON s.product_id = p.id
        ORDER BY s.date DESC
    `, [], (err, rows) => {
        res.json(rows);
    });
});
// ================= SALES REPORT =================
app.get('/sales-report', (req, res) => {
    db.all(`
        SELECT 
            s.id,
            p.name AS product_name,
            p.barcode,
            s.qty,
            p.price,
            (s.qty * p.price) AS total,
            s.date
        FROM sales s
        JOIN products p ON s.product_id = p.id
        ORDER BY s.date DESC
    `, [], (err, rows) => {
        res.json(rows);
    });
});
// ================= RECEIVING REPORT =================
app.get('/receiving-report', (req, res) => {
    db.all(`
        SELECT 
            r.id,
            p.name AS product_name,
            p.barcode,
            r.qty,
            r.date
        FROM receiving r
        JOIN products p ON r.product_id = p.id
        ORDER BY r.date DESC
    `, [], (err, rows) => {
        res.json(rows);
    });
});
// ================= USER MANAGEMENT =================
app.get('/users', verifyToken, adminOnly, (req, res) => {
    db.all("SELECT id, username, role FROM users", [], (err, rows) => {
        res.json(rows);
    });
});

app.put('/users/:id/password', verifyToken, adminOnly, async (req, res) => {
    const { password } = req.body;
    const hashed = await bcrypt.hash(password, 10);

    db.run(
        "UPDATE users SET password = ? WHERE id = ?",
        [hashed, req.params.id],
        function (err) {
            if (err) return res.status(400).json({ error: "Password update failed" });
            res.json({ message: "Password updated" });
        }
    );
});

app.delete('/users/:id', verifyToken, adminOnly, (req, res) => {
    db.run("DELETE FROM users WHERE id = ?", [req.params.id], function (err) {
        if (err) return res.status(400).json({ error: "Delete failed" });
        res.json({ message: "User deleted" });
    });
});
// ================= SUPPLIERS =================
app.post('/suppliers', verifyToken, adminOnly, (req, res) => {
    const { name, phone, email, address } = req.body;

    db.run(
        "INSERT INTO suppliers (name, phone, email, address) VALUES (?, ?, ?, ?)",
        [name, phone, email, address],
        function (err) {
            if (err) return res.status(400).json({ error: "Supplier already exists" });
            res.json({ message: "Supplier added" });
        }
    );
});

app.get('/suppliers', (req, res) => {
    db.all("SELECT * FROM suppliers", [], (err, rows) => {
        res.json(rows);
    });
});

// ================= PURCHASE ORDERS =================
app.post('/purchase-orders', verifyToken, adminOnly, (req, res) => {
    const { supplier_id, product_id, qty } = req.body;

    db.run(
        "INSERT INTO purchase_orders (supplier_id, product_id, qty, date) VALUES (?, ?, ?, datetime('now'))",
        [supplier_id, product_id, qty],
        function (err) {
            if (err) return res.status(400).json({ error: "Purchase order failed" });
            res.json({ message: "Purchase order created" });
        }
    );
});

app.get('/purchase-orders', (req, res) => {
    db.all(`
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
    `, [], (err, rows) => {
        res.json(rows);
    });
});
app.put('/purchase-orders/:id/receive', verifyToken, adminOnly, (req, res) => {
    const poId = req.params.id;

    db.get("SELECT * FROM purchase_orders WHERE id = ?", [poId], (err, po) => {
        if (err || !po) {
            return res.status(404).json({ error: "Purchase order not found" });
        }

        if (po.status === "Received") {
            return res.status(400).json({ error: "Purchase order already received" });
        }

        db.run(
            "INSERT INTO receiving (product_id, qty, date) VALUES (?, ?, datetime('now'))",
            [po.product_id, po.qty]
        );

        db.run(
            "UPDATE products SET stock = stock + ? WHERE id = ?",
            [po.qty, po.product_id]
        );

        db.run(
            "UPDATE purchase_orders SET status = 'Received' WHERE id = ?",
            [poId]
        );

        res.json({ message: "Purchase order received and stock updated" });
    });
});
app.get('/charts/sales-profit', (req, res) => {
    db.all(`
        SELECT 
            date(date) AS sale_date,
            SUM(price) AS total_sales,
            SUM(profit) AS total_profit
        FROM sales
        GROUP BY date(date)
        ORDER BY sale_date ASC
    `, [], (err, rows) => {
        if (err) return res.status(400).json({ error: "Chart data failed" });
        res.json(rows);
    });
});

app.get('/charts/stock', (req, res) => {
    db.all(`
        SELECT 
            name,
            stock
        FROM products
        ORDER BY stock ASC
    `, [], (err, rows) => {
        if (err) return res.status(400).json({ error: "Stock chart failed" });
        res.json(rows);
    });
});
// ================= IMPORT PRODUCTS =================
app.post('/import-products', upload.single('file'), (req, res) => {

    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const data = XLSX.utils.sheet_to_json(sheet);

    data.forEach(item => {

        db.run(
            `INSERT OR IGNORE INTO products 
            (name, barcode, price, cost, stock)
            VALUES (?, ?, ?, ?, ?)`,
            [
                item.name,
                item.barcode,
                item.price,
                item.cost,
                item.stock || 0
            ]
        );
    });

    res.json({ message: "Products imported successfully" });
});
app.get('/db-test', async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");
        res.json({
            status: "Database connected",
            time: result.rows[0]
        });
    } catch (err) {
        console.error("DB TEST ERROR:", err);
        res.status(500).json({
            error: err.message
        });
    }
});
// ================= START SERVER =================
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});