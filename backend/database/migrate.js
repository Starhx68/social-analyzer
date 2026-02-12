require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runMigrations() {
  console.log('正在连接数据库...');
  const client = await pool.connect();
  
  try {
    console.log('开始执行数据库迁移...');
    
    const migrationsDir = path.join(__dirname, 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    for (const file of migrationFiles) {
      console.log(`执行迁移文件: ${file}`);
      
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      try {
        await client.query(sql);
        console.log(`✓ ${file} 执行成功`);
      } catch (error) {
        console.error(`✗ ${file} 执行失败:`, error.message);
        throw error;
      }
    }
    
    console.log('数据库迁移完成!');
  } catch (error) {
    console.error('迁移失败:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch(console.error);
