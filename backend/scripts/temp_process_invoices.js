const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../src/config/database');
const ExternalInterfaceService = require('../src/services/externalInterfaceService');
const logger = require('../src/config/logger');

async function run() {
  try {
    console.log('Starting temporary invoice processing...');

    // Force select the specific order to debug
    const query = `
      SELECT id as order_id, crm_order_no
      FROM orders
      WHERE crm_order_no = '5256025297'
    `;

    const result = await db.query(query);
    console.log(`Found ${result.rows.length} candidate orders.`);

    let successCount = 0;
    let failCount = 0;

    for (const row of result.rows) {
      console.log(`Processing order ${row.crm_order_no} (ID: ${row.order_id})...`);
      try {
        await ExternalInterfaceService.callGetInvoice(row.order_id, row.crm_order_no);
        console.log(`✅ Processed ${row.crm_order_no} successfully.`);
        successCount++;
      } catch (err) {
        console.error(`❌ Failed to process ${row.crm_order_no}:`, err.message);
        failCount++;
      }
    }

    console.log('-----------------------------------');
    console.log(`Processing complete.`);
    
    process.exit(0);
  } catch (error) {
    console.error('Script fatal error:', error);
    process.exit(1);
  }
}

run();
