const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function resetPassword() {
  const client = await pool.connect();
  try {
    console.log('Resetting admin password...');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const res = await client.query(
      `UPDATE users SET password_hash = $1 WHERE username = 'admin'`,
      [hashedPassword]
    );
    if (res.rowCount > 0) {
      console.log('Admin password reset to "admin123" successfully.');
    } else {
      console.log('Admin user not found.');
    }
  } catch (err) {
    console.error('Error resetting password:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

resetPassword();
