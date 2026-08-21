// =====================================================
// seed.js
// Default Data Seeder
// Compatible with Migration Architecture
// =====================================================

const DEFAULT_CONFIG = {
    companyName: "My Company",
    currency: "USD",
    adminUsername: "admin",
    adminPassword: "admin"
};

async function seedDatabase(pool) {

    //----------------------------------------------------
    // System Settings
    //----------------------------------------------------

    await pool.query(`
        INSERT INTO settings (key, value)
        VALUES ('SYSTEM_VERSION','24A')
        ON CONFLICT (key) DO NOTHING;
    `);

    await pool.query(`
        INSERT INTO settings (key, value)
        VALUES ('DEFAULT_CURRENCY', $1)
        ON CONFLICT (key) DO NOTHING;
    `, [DEFAULT_CONFIG.currency]);

    await pool.query(`
        INSERT INTO settings (key, value)
        VALUES ('COMPANY_NAME', $1)
        ON CONFLICT (key) DO NOTHING;
    `, [DEFAULT_CONFIG.companyName]);

    //----------------------------------------------------
    // Default Administrator
    //----------------------------------------------------

    await pool.query(`
        INSERT INTO users
            (username, password, role)
        VALUES
            ($1, $2, $3)
        ON CONFLICT (username)
        DO NOTHING;
    `, [
        DEFAULT_CONFIG.adminUsername,
        DEFAULT_CONFIG.adminPassword,
        "Administrator"
    ]);

    console.log("✓ Default settings verified.");
    console.log("✓ Default administrator verified.");

    console.log("");
    console.log("==============================================");
    console.log("Seed completed successfully.");
    console.log("==============================================");
    console.log("");

}

module.exports = {
    seedDatabase
};