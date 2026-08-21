// =====================================================
// version.js
// Application & Database Version Information
// =====================================================

const VERSION = {

    application: {
        name: "POS Inventory System",
        release: "Commercial",
        version: "24A",
        build: "24A-2A",
        releaseDate: "2026-07-17"
    },

    database: {
        schemaVersion: "24A_2A",
        migrationVersion: "24A_2A_INDEX_CONSTRAINTS",
        engine: "PostgreSQL"
    },

    developer: {
        company: "Rabih Al Jammal",
        supportEmail: "",
        website: ""
    }

};

function getVersion() {
    return VERSION;
}

module.exports = {
    VERSION,
    getVersion
};