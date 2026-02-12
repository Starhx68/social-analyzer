
const path = require('path');
const fs = require('fs');
const envPath = path.resolve(__dirname, '../.env');
require('dotenv').config({ path: envPath });

const { Pool } = require('pg');
const orderSyncService = require('../src/services/orderSyncService');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function reprocessAmounts() {
  const client = await pool.connect();
  try {
    console.log('开始重新处理订单金额 (Reprocess Amounts)...');
    
    // 1. 获取所有原始数据
    const res = await client.query('SELECT * FROM od_order_subsidy_sync');
    // const res = await client.query(`
    //   SELECT * FROM od_order_subsidy_sync 
    //   WHERE data::text LIKE '%25060330980746%'
    // `);
    console.log(`找到 ${res.rows.length} 条原始记录`);

    let updatedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const row of res.rows) {
      try {
        // 解析数据以检查字段是否存在
        const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        
        // 调试：检查 BUYERPAYAMOUNT 是否存在
        if (updatedCount === 0) {
            console.log('Sample Data Keys:', Object.keys(data));
            if (data.BUYERPAYAMOUNT !== undefined) {
                console.log('Found BUYERPAYAMOUNT:', data.BUYERPAYAMOUNT);
            } else if (data.buyerPayAmount !== undefined) {
                console.log('Found buyerPayAmount:', data.buyerPayAmount);
            } else {
                console.warn('WARNING: BUYERPAYAMOUNT not found in first record!');
            }
            if (data.ORDER_ACTINCM_AMT !== undefined) {
                console.log('Found ORDER_ACTINCM_AMT:', data.ORDER_ACTINCM_AMT);
            }
        }

        // 使用 orderSyncService 解析和同步
        // forceUpdate = true ensuring fields are updated in order_sync
        const syncRecord = await orderSyncService.syncRecord(row, true);
            // 如果已生成业务订单，同步更新业务订单表
            if (syncRecord.order_id) {
              await orderSyncService.createBusinessOrder(syncRecord);
            }

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
    process.exit(0);
  }
}

reprocessAmounts();
