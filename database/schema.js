// =====================================================
// schema.js
// Database Schema Metadata
// Single Source of Truth
// =====================================================

const REQUIRED_TABLES = [

    "users",
    "customers",
    "suppliers",
    "products",

    "branches",
    "branch_stock",

    "sales",
    "branch_sales",

    "invoices",
    "invoice_items",

    "purchase_orders",
    "purchase_order_items",

    "stock_adjustments",
    "stock_transfers",

    "expenses",

    "system_settings",

    "product_categories"

];

const REQUIRED_MIGRATIONS = 15; // Update this number whenever a new migration is added

module.exports = {

    REQUIRED_TABLES,
    REQUIRED_MIGRATIONS

};