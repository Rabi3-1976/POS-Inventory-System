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
//app.get("/setup-admin", async (req, res) => {
    //try {
        //const hashedPassword = await bcrypt.hash("1234", 10);

        //await pool.query(`
            //INSERT INTO users (username, password, role)
            //VALUES ($1, $2, $3)
            //ON CONFLICT (username) DO UPDATE
            //SET password = EXCLUDED.password,
                //role = EXCLUDED.role
       // `, ["admin", hashedPassword, "admin"]);

        //res.send("Admin user ready. Username: admin / Password: 1234");
    //} catch (err) {
       // console.error(err);
       // res.status(500).send("Setup admin failed: " + err.message);
    //}
//});

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

    try {
        await pool.query(`
            INSERT INTO branch_stock (branch_id, product_id, stock)
            VALUES ($1, $2, $3)
            ON CONFLICT (branch_id, product_id)
            DO UPDATE SET stock = EXCLUDED.stock
        `, [branch_id, product_id, stock]);

        res.json({ message: "Branch stock updated" });
    } catch (err) {
        res.status(500).json({ error: "Branch stock update failed" });
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
                bs.stock
            FROM branch_stock bs
            JOIN branches b ON bs.branch_id = b.id
            JOIN products p ON bs.product_id = p.id
            ORDER BY b.name, p.name
        `);

        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Branch stock failed" });
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
    const { branch_id, product_id, qty } = req.body;

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
            "INSERT INTO branch_sales (branch_id, product_id, qty, price, cost, profit) VALUES ($1, $2, $3, $4, $5, $6)",
            [branch_id, product_id, Number(qty), totalPrice, totalCost, profit]
        );

        await client.query(
            "INSERT INTO sales (product_id, qty, price, cost, profit) VALUES ($1, $2, $3, $4, $5)",
            [product_id, Number(qty), totalPrice, totalCost, profit]
        );

        await client.query("COMMIT");

        res.json({ message: "Branch sale completed successfully", profit });

    } catch (err) {
        await client.query("ROLLBACK");
        console.error("BRANCH SALE ERROR:", err);
        res.status(500).json({ error: "Branch sale failed" });
    } finally {
        client.release();
    }
});
// START SERVER
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});