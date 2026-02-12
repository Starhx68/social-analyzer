
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const orderSyncService = require('../src/services/orderSyncService');

async function debugRecord() {
  const client = await pool.connect();
  try {
    const externalOrderId = '3AX947789300';
    console.log(`Checking record with external_order_id: ${externalOrderId}`);

    // Get from sync table
    const res = await client.query(
      `SELECT * FROM od_order_subsidy_sync 
       WHERE data->>'ORDER_NO' = $1`,
      [externalOrderId]
    );

    if (res.rows.length === 0) {
      console.log('Record not found in od_order_subsidy_sync');
      return;
    }
    const rawRecord = res.rows[0];
    
    // Parse manually
    const data = typeof rawRecord.data === 'string' ? JSON.parse(rawRecord.data) : rawRecord.data;
    
    console.log('Raw Record Keys:', Object.keys(data));
    console.log('Raw Record Sample:', JSON.stringify(data).substring(0, 200));

    console.log('--- Manual Parse Check ---');
    console.log('plate_type from logic:', orderSyncService.getPlateTypeFromAttr(data));
    
    const parsed = orderSyncService.parseOracleData(data);
    console.log('Parsed mchnt_ord_no:', parsed.mchnt_ord_no);
    console.log('Parsed external_order_id:', parsed.external_order_id);

    // Call syncRecord
    console.log('--- Calling orderSyncService.syncRecord (forceUpdate=true) ---');
    const result = await orderSyncService.syncRecord(rawRecord, true);
    console.log('Sync Result ID:', result.id);
    console.log('Sync Result plate_type:', result.plate_type);

    // Inspect the record returned by syncRecord
    const syncRes = await client.query('SELECT * FROM order_sync WHERE id = $1', [result.id]);
    console.log('Sync Record (from ID):', syncRes.rows[0]);

    // Verify in DB
    const finalRes = await client.query('SELECT id, plate_type, external_order_id, mchnt_ord_no FROM order_sync WHERE external_order_id = $1', [externalOrderId]);
    console.log('Final DB Search Count:', finalRes.rows.length);
    for (const r of finalRes.rows) {
        console.log(`DB Record ID: ${r.id}, plate_type: ${r.plate_type}, mchnt: ${r.mchnt_ord_no}`);
        // Check order
        const ordRes = await client.query('SELECT id, status FROM orders WHERE sync_id = $1', [r.id]);
        if (ordRes.rows.length > 0) {
            console.log(`  -> Linked Order ID: ${ordRes.rows[0].id}, Status: ${ordRes.rows[0].status}`);
        } else {
            console.log(`  -> No linked order`);
        }
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

debugRecord();
