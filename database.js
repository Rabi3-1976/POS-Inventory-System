const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function initializeDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE,
            password TEXT,
            role TEXT
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            name TEXT UNIQUE,
            barcode TEXT UNIQUE,
            price NUMERIC,
            cost NUMERIC DEFAULT 0,
            stock INTEGER DEFAULT 0
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS sales (
            id SERIAL PRIMARY KEY,
            product_id INTEGER,
            qty INTEGER,
            price NUMERIC,
            cost NUMERIC,
            profit NUMERIC,
            date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS receiving (
            id SERIAL PRIMARY KEY,
            product_id INTEGER,
            qty INTEGER,
            date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS suppliers (
            id SERIAL PRIMARY KEY,
            name TEXT UNIQUE,
            phone TEXT,
            email TEXT,
            address TEXT
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS purchase_orders (
            id SERIAL PRIMARY KEY,
            supplier_id INTEGER,
            product_id INTEGER,
            qty INTEGER,
            status TEXT DEFAULT 'Open',
            date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    console.log("PostgreSQL connected successfully");
}

initializeDatabase().catch(err => {
    console.error("Database initialization failed:", err);
});

module.exports = pool;