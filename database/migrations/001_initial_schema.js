// =====================================================
// 001_initial_schema.js
// Phase 24A-2A
// Initial Database Schema
// =====================================================

module.exports = {

    id: "001_initial_schema",

    description: "Create core users and master-data tables",

    async up(client) {

        //--------------------------------------------------
        // Users
        //--------------------------------------------------

        await client.query(`
            CREATE TABLE IF NOT EXISTS users (

                id SERIAL PRIMARY KEY,

                username VARCHAR(100) NOT NULL UNIQUE,

                password TEXT NOT NULL,

                role VARCHAR(50) NOT NULL DEFAULT 'User',

                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

            );
        `);

        //--------------------------------------------------
        // Customers
        //--------------------------------------------------

        await client.query(`
            CREATE TABLE IF NOT EXISTS customers (

                id SERIAL PRIMARY KEY,

                name VARCHAR(255) NOT NULL,

                phone VARCHAR(50),

                email VARCHAR(255),

                address TEXT,

                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

            );
        `);

        //--------------------------------------------------
        // Suppliers
        //--------------------------------------------------

        await client.query(`
            CREATE TABLE IF NOT EXISTS suppliers (

                id SERIAL PRIMARY KEY,

                name VARCHAR(255) NOT NULL,

                phone VARCHAR(50),

                email VARCHAR(255),

                address TEXT,

                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

            );
        `);

        //--------------------------------------------------
        // Products
        //--------------------------------------------------

        await client.query(`
            CREATE TABLE IF NOT EXISTS products (

                id SERIAL PRIMARY KEY,

                name VARCHAR(255) NOT NULL UNIQUE,

                barcode VARCHAR(100) UNIQUE,

                price NUMERIC(12,2) NOT NULL DEFAULT 0,

                cost NUMERIC(12,2) NOT NULL DEFAULT 0,

                stock INTEGER NOT NULL DEFAULT 0,

                uom VARCHAR(20) DEFAULT 'PCS',

                supplier_id INTEGER,

                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

            );
        `);

        console.log("✓ Migration 001 - Initial Schema completed.");

    }

};