const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function syncOrdersData() {
  const client = await pool.connect();
  try {
    console.log('开始同步 orders 表数据 (从 order_sync)...');
    
    // Select all synced orders
    const res = await client.query(`
      SELECT os.* 
      FROM order_sync os 
      WHERE os.order_id IS NOT NULL
    `);
    
    console.log(`找到 ${res.rows.length} 条已关联记录`);
    
    let updatedCount = 0;
    
    for (const row of res.rows) {
      await client.query(`
        UPDATE orders
        SET plate_type = $1,
            product_name = $2,
            product_brand = $3,
            product_model = $4,
            product_category = $5,
            product_price = $6,
            subsidy_amount = $7,
            invoice_no = $8,
            invoice_amount = $9,
            invoice_date = $10,
            updated_at = NOW()
        WHERE id = $11
      `, [
        row.plate_type,
        row.product_name,
        row.product_brand,
        row.product_model,
        row.product_category,
        row.product_price,
        row.subsidy_amount,
        row.invoice_no,
        row.invoice_amount,
        row.invoice_date,
        row.order_id
      ]);
      
      updatedCount++;
      if (updatedCount % 100 === 0) {
        process.stdout.write(`\r已更新: ${updatedCount}/${res.rows.length}`);
      }
    }
    
    console.log(`\n同步完成! 更新了 ${updatedCount} 条记录`);
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

syncOrdersData();
