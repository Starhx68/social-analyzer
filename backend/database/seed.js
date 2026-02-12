require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function seed() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('开始插入种子数据...');
    
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const orgResult = await client.query(`
      INSERT INTO organizations (name, code, type, contact_person, contact_phone, district, status)
      VALUES ('示例商户', 'DEMO001', 'retailer', '张三', '13800138000', '长沙市开福区', 'active')
      ON CONFLICT (code) DO NOTHING
      RETURNING id
    `);
    
    const orgId = orgResult.rows[0]?.id;
    
    if (orgId) {
      await client.query(`
        INSERT INTO users (username, password_hash, phone, real_name, role, organization_id, status)
        VALUES ('admin', $1, '13800138000', '管理员', 'admin', $2, 'active')
        ON CONFLICT (username) DO NOTHING
      `, [hashedPassword, orgId]);
      
      await client.query(`
        INSERT INTO users (username, password_hash, phone, real_name, role, organization_id, status)
        VALUES ('auditor', $1, '13800138001', '审核员', 'auditor', $2, 'active')
        ON CONFLICT (username) DO NOTHING
      `, [hashedPassword, orgId]);
      
      await client.query(`
        INSERT INTO users (username, password_hash, phone, real_name, role, organization_id, status)
        VALUES ('user', $1, '13800138002', '普通用户', 'user', $2, 'active')
        ON CONFLICT (username) DO NOTHING
      `, [hashedPassword, orgId]);
    }
    
    await client.query('COMMIT');
    console.log('种子数据插入完成!');
    console.log('默认账号:');
    console.log('  - admin/admin123 (管理员)');
    console.log('  - auditor/admin123 (审核员)');
    console.log('  - user/admin123 (普通用户)');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('种子数据插入失败:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(console.error);
