const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function checkSyncStatus() {
  const client = await pool.connect();
  try {
    console.log('=== 订单同步状态监控 ===\n');
    
    const res = await client.query(`
      SELECT 
        sync_status,
        COUNT(*) as count
      FROM order_sync
      GROUP BY sync_status
      ORDER BY count DESC
    `);
    
    console.table(res.rows);
    
    const pendingCount = res.rows.find(r => r.sync_status === 'pending')?.count || 0;
    const syncedCount = res.rows.find(r => r.sync_status === 'synced')?.count || 0;
    const failedCount = res.rows.find(r => r.sync_status === 'failed')?.count || 0;
    
    console.log(`\n总计: ${res.rows.reduce((acc, r) => acc + parseInt(r.count), 0)}`);
    console.log(`待处理: ${pendingCount}`);
    console.log(`已完成: ${syncedCount}`);
    console.log(`失败: ${failedCount}`);
    
  } catch (err) {
    console.error('查询出错:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkSyncStatus();
