const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes("render.com")
        ? { rejectUnauthorized: false }
        : false
});

pool.connect()
    .then(() => {
        console.log("PostgreSQL connected");
    })
    .catch(err => {
        console.error("PostgreSQL connection error:", err);
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

    console.log("Tables initialized");
}

initializeDatabase().catch(err => {
    console.error("Initialization failed:", err);
});

module.exports = pool;