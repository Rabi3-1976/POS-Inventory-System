const { Pool } = require("pg");
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});
// Initialize database tables
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
            price NUMERIC DEFAULT 0,
            cost NUMERIC DEFAULT 0,
            stock INTEGER DEFAULT 0
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS sales (
            id SERIAL PRIMARY KEY,
            product_id INTEGER,
            qty INTEGER,
            price NUMERIC DEFAULT 0,
            cost NUMERIC DEFAULT 0,
            profit NUMERIC DEFAULT 0,
            date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await pool.query(`
    CREATE TABLE IF NOT EXISTS branch_sales (
        id SERIAL PRIMARY KEY,
        branch_id INTEGER,
        product_id INTEGER,
        qty INTEGER,
        price NUMERIC DEFAULT 0,
        cost NUMERIC DEFAULT 0,
        profit NUMERIC DEFAULT 0,
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
    await pool.query(`
    ALTER TABLE purchase_orders
    ADD COLUMN IF NOT EXISTS branch_id INTEGER
`);
    await pool.query(`
    CREATE TABLE IF NOT EXISTS branches (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE,
        location TEXT
    )
`);

await pool.query(`
    CREATE TABLE IF NOT EXISTS branch_stock (
        id SERIAL PRIMARY KEY,
        branch_id INTEGER,
        product_id INTEGER,
        stock INTEGER DEFAULT 0,
        UNIQUE(branch_id, product_id)
    )
`);

await pool.query(`
    CREATE TABLE IF NOT EXISTS stock_transfers (
        id SERIAL PRIMARY KEY,
        from_branch_id INTEGER,
        to_branch_id INTEGER,
        product_id INTEGER,
        qty INTEGER,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`);
await pool.query(`
    CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT UNIQUE,
        email TEXT,
        address TEXT,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`);
await pool.query(`
    ALTER TABLE branch_sales
    ADD COLUMN IF NOT EXISTS customer_id INTEGER
`);

await pool.query(`
    ALTER TABLE sales
    ADD COLUMN IF NOT EXISTS customer_id INTEGER
`);
await pool.query(`
    CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        category TEXT NOT NULL,
        amount NUMERIC DEFAULT 0,
        notes TEXT,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`);
await pool.query(`
    CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        invoice_no TEXT UNIQUE,
        customer_id INTEGER,
        branch_id INTEGER,
        user_id INTEGER,
        payment_method TEXT DEFAULT 'Cash',
        total NUMERIC DEFAULT 0,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`);

await pool.query(`
    CREATE TABLE IF NOT EXISTS invoice_items (
        id SERIAL PRIMARY KEY,
        invoice_id INTEGER,
        product_id INTEGER,
        product_name TEXT,
        barcode TEXT,
        qty INTEGER,
        unit_price NUMERIC DEFAULT 0,
        line_total NUMERIC DEFAULT 0
    )
`);
await pool.query(`
    CREATE TABLE IF NOT EXISTS supplier_returns (
        id SERIAL PRIMARY KEY,
        supplier_id INTEGER,
        product_id INTEGER,
        branch_id INTEGER,
        qty INTEGER,
        reason TEXT,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`);
await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_returns (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER,
        invoice_id INTEGER,
        product_id INTEGER,
        branch_id INTEGER,
        qty INTEGER,
        refund_amount NUMERIC DEFAULT 0,
        reason TEXT,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`);
await pool.query(`
    ALTER TABLE purchase_orders
    ADD COLUMN IF NOT EXISTS received_qty INTEGER DEFAULT 0
`);
    console.log("PostgreSQL tables ready");
}
initializeDatabase().catch(err => {
    console.error("Database initialization failed:", err);
});

module.exports = pool;