
const path = require('path');
const fs = require('fs');
const envPath = path.resolve(__dirname, '../.env');
require('dotenv').config({ path: envPath });

const { Pool } = require('pg');
const orderSyncService = require('../src/services/orderSyncService');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Mock db for orderSyncService since it imports '../config/database'
// We need to ensure orderSyncService uses our pool or the one it imports works.
// orderSyncService imports '../config/database', which uses process.env.
// Since we loaded dotenv, it should work fine.
// However, orderSyncService is a class instance.

async function reprocessPlateType() {
  const client = await pool.connect();
  try {
    console.log('开始重新处理板块类型 (Plate Type)...');
    
    // 1. 获取所有原始数据
    const res = await client.query('SELECT * FROM od_order_subsidy_sync');
    console.log(`找到 ${res.rows.length} 条原始记录`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const row of res.rows) {
      try {
        // 使用 orderSyncService 解析和同步
        // forceUpdate = true to ensure fields are updated
        await orderSyncService.syncRecord(row, true);
        updatedCount++;
        if (updatedCount % 100 === 0) {
            process.stdout.write(`\r已处理: ${updatedCount}/${res.rows.length}`);
        }
      } catch (e) {
        errorCount++;
        console.error(`\n处理记录失败 ID: ${row.id}`, e.message);
      }
    }

    console.log(`\n处理完成! 成功: ${updatedCount}, 失败: ${errorCount}`);

  } catch (err) {
    console.error('Fatal error:', err);
  } finally {
    client.release();
    await pool.end();
    // orderSyncService internal pool might need closing if we want clean exit, 
    // but process.exit is fine for a script.
    process.exit(0);
  }
}

reprocessPlateType();
