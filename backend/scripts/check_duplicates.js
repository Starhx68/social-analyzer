
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkDuplicates() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT oracle_rowid, data->>'ORDER_NO' as order_no, data->>'ORDER_GB' as gb, data->>'GOODS_ATTRIBUTE' as attr 
      FROM od_order_subsidy_sync 
      WHERE data->>'ORDER_NO' = '3AX947789300'
    `);
    console.log('Count:', res.rows.length);
    res.rows.forEach(r => console.log(r.oracle_rowid, r.order_no, r.gb, r.attr));
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}
checkDuplicates();
