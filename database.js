const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = process.env.DATA_DIR || __dirname;

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'pos_inventory.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Database connection error:", err.message);
    } else {
        console.log("Connected to SQLite database:", dbPath);
    }
});

// Create Tables
db.serialize(() => {

    // Users
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            role TEXT
        )
    `);
    db.run(`
    CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        phone TEXT,
        email TEXT,
        address TEXT
    )
`);

db.run(`
    CREATE TABLE IF NOT EXISTS purchase_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER,
        product_id INTEGER,
        qty INTEGER,
        status TEXT DEFAULT 'Open',
        date TEXT,
        FOREIGN KEY(supplier_id) REFERENCES suppliers(id),
        FOREIGN KEY(product_id) REFERENCES products(id)
    )
`);

    // Products
    db.run(`
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE,
            barcode TEXT UNIQUE,
            price REAL,
            stock INTEGER DEFAULT 0
        )
    `);

    // Sales
    db.run(`
        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER,
            qty INTEGER,
            date TEXT,
            FOREIGN KEY(product_id) REFERENCES products(id)
        )
    `);

    // Receiving
    db.run(`
        CREATE TABLE IF NOT EXISTS receiving (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER,
            qty INTEGER,
            date TEXT,
            FOREIGN KEY(product_id) REFERENCES products(id)
        )
    `);

});

module.exports = db;