
const path = require('path');
const fs = require('fs');
const envPath = path.resolve(__dirname, '../.env');
console.log('Env path:', envPath);
console.log('Env file exists:', fs.existsSync(envPath));
const result = require('dotenv').config({ path: envPath });
if (result.error) {
  console.error('Dotenv error:', result.error);
}
console.log('Dotenv parsed:', result.parsed);

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function debugPlateType() {
  console.log('DB Config:', {
    connectionString: process.env.DATABASE_URL
  });

  const client = await pool.connect();
  try {
    const targetId = '3AX947789300';
    
    console.log(`正在查询 external_order_id 为 ${targetId} 的记录...`);

    // 1. 查询 order_sync 表
    const orderSyncRes = await client.query(`
      SELECT * FROM order_sync WHERE external_order_id = $1
    `, [targetId]);

    if (orderSyncRes.rows.length > 0) {
      console.log('--- order_sync 表记录 ---');
      console.log('plate_type:', orderSyncRes.rows[0].plate_type);
      console.log('product_category:', orderSyncRes.rows[0].product_category);
      console.log('product_name:', orderSyncRes.rows[0].product_name);
    } else {
      console.log('order_sync 表中未找到该记录');
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

debugPlateType();
