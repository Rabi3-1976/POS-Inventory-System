// database/migrations.js
// The authoritative home for every database schema change.

const MIGRATIONS_TABLE = 'schema_migrations';

async function addColumnIfMissing(client, table, column, definition) {
    await client.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${definition};`);
}

const migration001 = require("./migrations/001_initial_schema");
const migration002 = require("./migrations/002_branches_and_stock");
const migration003 = require("./migrations/003_sales_and_invoices");
const migration004 = require("./migrations/004_purchase_orders");
const migration005 = require("./migrations/005_inventory_operations");
const migration006 = require("./migrations/006_settings_and_finance");
const migration007 = require("./migrations/007_existing_schema_alignment");
const migration008 = require("./migrations/008_foreign_keys");
const migration009 = require("./migrations/009_constraints_and_indexes");
const migration010 = require("./migrations/010_product_categories");
const migration011 = require("./migrations/011_complete_foreign_keys");
const migration012 = require("./migrations/012_foreign_key_indexes");
const migration013 = require("./migrations/013_constraint_standardization");
const migration014 = require("./migrations/014_constraint_standardization_part2");
const migration015 = require("./migrations/015_transaction_engine");

const migrations = [
    migration001,
    migration002,
    migration003,
    migration004,
    migration005,
    migration006,
    migration007,
    migration008,
    migration009,
    migration010,
    migration011,
    migration012,
    migration013,
    migration014,
    migration015
];

async function ensureMigrationsTable(client) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
            id TEXT PRIMARY KEY,
            description TEXT NOT NULL,
            applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);
}

async function hasMigration(client, id) {
    const result = await client.query(
        `SELECT 1 FROM ${MIGRATIONS_TABLE} WHERE id = $1`,
        [id]
    );
    return result.rowCount > 0;
}

async function applyMigration(client, migration) {
    if (await hasMigration(client, migration.id)) {
        return;
    }

    console.log(`Applying migration: ${migration.id} — ${migration.description}`);
    await client.query('BEGIN');
    try {
        await migration.up(client);
        await client.query(
            `INSERT INTO ${MIGRATIONS_TABLE} (id, description) VALUES ($1, $2)`,
            [migration.id, migration.description]
        );
        await client.query('COMMIT');
        console.log(`✓ Applied migration: ${migration.id}`);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`✗ Migration failed: ${migration.id}`);
        throw error;
    }
}

async function runMigrations(pool) {
    const client = await pool.connect();
    try {
        // Prevent two application instances from applying the same migration at once.
        await client.query('SELECT pg_advisory_lock(24020801)');
        await ensureMigrationsTable(client);
        for (const migration of migrations) {
            await applyMigration(client, migration);
        }
    } finally {
        try {
            await client.query('SELECT pg_advisory_unlock(24020801)');
        } finally {
            client.release();
        }
    }
}

module.exports = { runMigrations, migrations };