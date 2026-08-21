// =====================================================
// setup.js
// Database Setup Orchestrator
// =====================================================

const { runMigrations } = require("./migrations");
const { validateDatabase } = require("./validator");
const { seedDatabase } = require("./seed");
const { runHealthChecks } = require("./health");
const { validateBackupRecovery } = require("./backup");

async function runDatabaseSetup(pool) {

    try{    

    console.log("");
    console.log("==============================================");
    console.log("DATABASE SETUP STARTED");
    console.log("==============================================");

    //----------------------------------------------------
    // Run Versioned Migrations
    //----------------------------------------------------

    await runMigrations(pool);

    console.log("");
    console.log("==============================================");
    console.log("Running database validation...");
    console.log("==============================================");

    //----------------------------------------------------
    // Validate Database
    //----------------------------------------------------

    await validateDatabase(pool);

    console.log("");
    console.log("==============================================");
    console.log("Checking default seed data...");
    console.log("==============================================");

    //----------------------------------------------------
    // Seed Default Data
    //----------------------------------------------------

    await seedDatabase(pool);

    console.log("");
    console.log("==============================================");
    console.log("Running database health checks...");
    console.log("==============================================");

    await runHealthChecks(pool);

    console.log("");
    console.log("==============================================");
    console.log("Running backup validation...");
    console.log("==============================================");

await validateBackupRecovery(pool);

    console.log("");
    console.log("==============================================");
    console.log("DATABASE SETUP COMPLETED");
    console.log("==============================================");
    console.log("");

}

catch (error) {

        console.error("");
        console.error("==============================================");
        console.error("DATABASE SETUP FAILED");
        console.error("==============================================");

        throw error;

    }
} 


//----------------------------------------------------
// Backup Validation
//----------------------------------------------------

//await validateBackupRecovery(pool);

module.exports = {
    runDatabaseSetup
};