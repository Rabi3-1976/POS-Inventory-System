// database.js
// Application database bootstrap. Schema changes belong in database/migrations.js.

require('dotenv').config();

const { Pool } = require('pg');
const { runDatabaseSetup } = require('./database/setup');

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured. Add it to the .env file.');
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Supabase and most managed PostgreSQL providers require TLS. Local PostgreSQL
    // connections can opt out by setting DATABASE_SSL=false.
    ssl: process.env.DATABASE_SSL === 'false'
        ? false
        : { rejectUnauthorized: false }
});

pool.on('error', (error) => {
    console.error('Unexpected PostgreSQL pool error:', error);
});

async function initializeDatabase() {
    await pool.query('SELECT 1');
    console.log('PostgreSQL connection ready');
    await runDatabaseSetup(pool);
    console.log('PostgreSQL setup complete');
}

// Preserve the previous module contract: files that do
// `const pool = require('./database')` can continue to call pool.query(...).
// New startup code may await pool.databaseReady before accepting requests.
pool.databaseReady = initializeDatabase().catch((error) => {
    console.error('Database initialization failed:', error);
    throw error;
});

module.exports = pool;