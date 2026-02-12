require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkTables() {
  try {
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('数据库表列表:');
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

    // 检查关键表是否存在
    const criticalTables = [
      'users',
      'organizations',
      'orders',
      'order_sync',
      'od_order_subsidy_sync',
      'sync_state',
      'order_materials'
    ];

    console.log('\n关键表检查:');
    for (const table of criticalTables) {
      const exists = result.rows.some(row => row.table_name === table);
      console.log(`  ${exists ? '✓' : '✗'} ${table}`);
    }
  } catch (error) {
    console.error('查询失败:', error.message);
  } finally {
    await pool.end();
  }
}

checkTables();
