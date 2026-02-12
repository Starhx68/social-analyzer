
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function cleanupDuplicates() {
  const client = await pool.connect();
  try {
    console.log('Scanning for duplicate external_order_id in order_sync...');

    const res = await client.query(`
      SELECT external_order_id, COUNT(*) as cnt
      FROM order_sync
      GROUP BY external_order_id
      HAVING COUNT(*) > 1
    `);

    console.log(`Found ${res.rows.length} duplicate groups.`);

    for (const row of res.rows) {
      const extId = row.external_order_id;
      console.log(`Processing duplicates for ${extId}...`);

      const records = await client.query(`
        SELECT id, mchnt_ord_no, plate_type, updated_at 
        FROM order_sync 
        WHERE external_order_id = $1 
        ORDER BY updated_at DESC
      `, [extId]);

      // We want to keep the most recently updated one (likely the one from our recent reprocess)
      const keep = records.rows[0];
      const toDelete = records.rows.slice(1);

      console.log(`Keeping ID: ${keep.id} (updated: ${keep.updated_at}, plate: ${keep.plate_type})`);
      
      for (const del of toDelete) {
        console.log(`Processing Delete ID: ${del.id} (updated: ${del.updated_at}, plate: ${del.plate_type})`);
        
        // 1. Check/Update orders referencing the record to be deleted
        const orderRes = await client.query('SELECT id FROM orders WHERE sync_id = $1', [del.id]);
        if (orderRes.rows.length > 0) {
            const orderId = orderRes.rows[0].id;
            console.log(`  -> Referenced by Order ID: ${orderId}. Re-linking to Keep ID...`);
            
            // Re-link order to new sync record
             try {
               await client.query('UPDATE orders SET sync_id = $1 WHERE id = $2', [keep.id, orderId]);
               // Update new sync record to point to order
               await client.query('UPDATE order_sync SET order_id = $1, sync_status = \'synced\' WHERE id = $2', [orderId, keep.id]);
             } catch (err) {
               if (err.code === '23505') { // unique_violation
                 console.warn(`  -> Conflict: Keep record ${keep.id} already has an order. Cannot re-link Order ${orderId}.`);
                 console.warn(`  -> SKIPPING delete for ${del.id} to avoid data loss. Manual review required.`);
                 continue; // Skip deleting this record
               } else {
                 throw err;
               }
             }
         }
 
         // 2. Delete the old record
        await client.query('DELETE FROM order_sync WHERE id = $1', [del.id]);
        console.log(`  -> Deleted.`);
      }
    }
    
    console.log('Cleanup complete.');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanupDuplicates();
