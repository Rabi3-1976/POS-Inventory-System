module.exports = {
    up: async (pool) => {
        console.log('🔄 Running migration 016: Fix PO receiving...');
        
        // Check if quantity_received column exists
        const checkColumn = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'purchase_order_items' 
            AND column_name = 'quantity_received'
        `);
        
        if (checkColumn.rows.length === 0) {
            console.log('Adding quantity_received column to purchase_order_items...');
            await pool.query(`
                ALTER TABLE purchase_order_items 
                ADD COLUMN quantity_received INTEGER DEFAULT 0 NOT NULL
            `);
        }
        
        // Update existing records to set quantity_received = quantity if status is completed
        console.log('Updating existing records...');
        await pool.query(`
            UPDATE purchase_order_items 
            SET quantity_received = quantity 
            WHERE purchase_order_id IN (
                SELECT id FROM purchase_orders WHERE status = 'completed'
            )
        `);
        
        console.log('✅ Migration 016 completed successfully');
    },
    
    down: async (pool) => {
        console.log('⬇️ Rolling back migration 016...');
        // Optional: Remove the column if needed
        // await pool.query('ALTER TABLE purchase_order_items DROP COLUMN quantity_received');
        console.log('✅ Rollback completed');
    }
};