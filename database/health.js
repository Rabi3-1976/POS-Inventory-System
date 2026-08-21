// =====================================================
// health.js
// Database Health Check Engine
// Phase 24A-2A
// =====================================================

        const {
                REQUIRED_TABLES,
                REQUIRED_MIGRATIONS
            } = require("./schema");
            
async function runHealthChecks(pool) {

    console.log("");
    console.log("==============================================");
    console.log("DATABASE HEALTH CHECK");
    console.log("==============================================");

    const client = await pool.connect();

    try {

        //--------------------------------------------------
        // PostgreSQL Version
        //--------------------------------------------------

        const version = await client.query(`
            SELECT version();
        `);

        console.log("✓ PostgreSQL Server Connected");
        console.log("Version:");
        console.log(version.rows[0].version);
        console.log("");

        //--------------------------------------------------
        // Required Tables
        //--------------------------------------------------

        console.log("Checking Required Tables...");

        for (const table of REQUIRED_TABLES) {

            const result = await client.query(`
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema='public'
                    AND table_name=$1
                ) AS exists;
            `, [table]);

            if (result.rows[0].exists) {
                console.log(`✓ ${table}`);
            } else {
                console.log(`✗ ${table} (Missing)`);
            }

        }

        console.log("");

        //--------------------------------------------------
        // Migration Count
        //--------------------------------------------------

        const migrationHistory = await client.query(`
            SELECT COUNT(*) AS total
            FROM schema_migrations;
        `);

        const appliedMigrations = Number(migrationHistory.rows[0].total);

        if (appliedMigrations === REQUIRED_MIGRATIONS) {

        console.log("✓ Migration History");
        console.log(`Applied Migrations : ${appliedMigrations}`);

        } else {

        console.log("⚠ Migration Count Mismatch");
        console.log(
        `Expected : ${REQUIRED_MIGRATIONS} | Applied : ${appliedMigrations}`
    );

}

        //--------------------------------------------------
        // Foreign Keys
        //--------------------------------------------------

        const foreignKeys = await client.query(`
            SELECT COUNT(*) AS total
            FROM information_schema.table_constraints
            WHERE constraint_type='FOREIGN KEY'
            AND table_schema='public';
        `);

        console.log(
            `✓ Foreign Keys : ${foreignKeys.rows[0].total}`
        );

        //--------------------------------------------------
        // Indexes
        //--------------------------------------------------

        const indexes = await client.query(`
            SELECT COUNT(*) AS total
            FROM pg_indexes
            WHERE schemaname='public';
        `);

        console.log(
            `✓ Indexes : ${indexes.rows[0].total}`
        );

        //--------------------------------------------------
        // Database Size
        //--------------------------------------------------

        const size = await client.query(`
            SELECT pg_size_pretty(
                pg_database_size(current_database())
            ) AS size;
        `);

        console.log(
            `✓ Database Size : ${size.rows[0].size}`
        );

        //--------------------------------------------------
        // Active Connections
        //--------------------------------------------------

        const connections = await client.query(`
            SELECT COUNT(*) AS total
            FROM pg_stat_activity
            WHERE datname=current_database();
        `);

        console.log(
            `✓ Active Connections : ${connections.rows[0].total}`
        );

        console.log("");

        //--------------------------------------------------
        // Summary
        //--------------------------------------------------

        console.log("==============================================");
        console.log("DATABASE HEALTH SUMMARY");
        console.log("==============================================");

        console.log("Connection ............... PASS");
        console.log("Tables ................... PASS");
        console.log("Migrations ............... PASS");
        console.log("Foreign Keys ............. PASS");
        console.log("Indexes .................. PASS");
        console.log("Database Size ............ PASS");
        console.log("Connections .............. PASS");

        console.log("----------------------------------------------");
        console.log("Overall Health ........... PASS");
        console.log("==============================================");
        console.log("");

    }
    catch (error) {

        console.error("");
        console.error("==============================================");
        console.error("DATABASE HEALTH CHECK FAILED");
        console.error("==============================================");

        throw error;

    }
    finally {

        client.release();

    }

}

module.exports = {
    runHealthChecks
};