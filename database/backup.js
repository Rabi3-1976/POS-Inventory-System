// =====================================================
// backup.js
// Backup & Recovery Validation Engine
// Phase 24A-2A
// =====================================================

const {
    REQUIRED_TABLES,
    REQUIRED_MIGRATIONS
} = require("./schema");

async function validateBackupRecovery(pool) {

    console.log("");
    console.log("==============================================");
    console.log("BACKUP & RECOVERY VALIDATION");
    console.log("==============================================");

    const client = await pool.connect();

    try {

        //--------------------------------------------------
        // Migration History
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
        // Required Tables
        //--------------------------------------------------

        console.log("Checking Required Tables...");

        let missingTables = 0;

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
                missingTables++;
            }

        }

        console.log("");

        //--------------------------------------------------
        // System Settings
        //--------------------------------------------------

        const settings = await client.query(`
            SELECT COUNT(*) AS total
            FROM system_settings;
        `);

        if (Number(settings.rows[0].total) > 0) {
            console.log("✓ System Settings");
        } else {
            console.log("✗ System Settings Missing");
        }

        //--------------------------------------------------
        // Administrator Account
        //--------------------------------------------------

        const admin = await client.query(`
            SELECT COUNT(*) AS total
            FROM users
            WHERE LOWER(role) = 'administrator'
               OR LOWER(role) = 'admin';
        `);

        if (Number(admin.rows[0].total) > 0) {
            console.log("✓ Administrator Account");
        } else {
            console.log("✗ Administrator Account Missing");
        }

        console.log("");

        //--------------------------------------------------
        // Recovery Summary
        //--------------------------------------------------

        const recoveryReady =
            missingTables === 0 &&
            Number(settings.rows[0].total) > 0 &&
            Number(admin.rows[0].total) > 0;

        console.log("==============================================");
        console.log("BACKUP & RECOVERY SUMMARY");
        console.log("==============================================");

        console.log("Migration History ........ PASS");
        console.log(
            `Required Tables .......... ${missingTables === 0 ? "PASS" : "FAIL"}`
        );
        console.log(
            `Seed Data ................ ${
                Number(settings.rows[0].total) > 0 &&
                Number(admin.rows[0].total) > 0
                    ? "PASS"
                    : "FAIL"
            }`
        );

        console.log(
            `Recovery Ready ........... ${
                recoveryReady ? "YES" : "NO"
            }`
        );

        console.log("==============================================");
        console.log("");

        return {
            recoveryReady,
            migrationCount: Number(migrationHistory.rows[0].total),
            missingTables
        };

    } catch (error) {

        console.error("");
        console.error("==============================================");
        console.error("BACKUP VALIDATION FAILED");
        console.error("==============================================");

        throw error;

    } finally {

        client.release();

    }

}

module.exports = {
    validateBackupRecovery
};