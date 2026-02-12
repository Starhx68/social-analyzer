const express = require('express');
const router = express.Router();
const { auth, requireAdmin, requireAuditor } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');

router.get('/', auth, requireAuditor, async (req, res) => {
  try {
    const { page = 1, limit = 10, role, organizationId, status } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 0;
    
    if (role) {
      paramCount++;
      whereClause += ` AND u.role = $${paramCount}`;
      params.push(role);
    }
    
    if (organizationId) {
      paramCount++;
      whereClause += ` AND u.organization_id = $${paramCount}`;
      params.push(organizationId);
    }
    
    if (status) {
      paramCount++;
      whereClause += ` AND u.status = $${paramCount}`;
      params.push(status);
    }
    
    const result = await db.query(
      `SELECT u.*, o.name as organization_name
       FROM users u
       LEFT JOIN organizations o ON u.organization_id = o.id
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...params, parseInt(limit), parseInt(offset)]
    );
    
    const countResult = await db.query(
      `SELECT COUNT(*) FROM users u ${whereClause}`,
      params
    );
    
    res.json({
      users: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/profile', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.username, u.phone, u.email, u.real_name, u.role, u.department, u.position, 
              u.organization_id, o.name as organization_name, u.last_login_at, u.status
       FROM users u
       LEFT JOIN organizations o ON u.organization_id = o.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/', auth, requireAdmin, [
  body('username').isLength({ min: 3, max: 50 }).withMessage('用户名长度为3-50字符'),
  body('password').isLength({ min: 6 }).withMessage('密码至少6位'),
  body('role').isIn(['admin', 'auditor', 'user']).withMessage('角色无效')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const { username, password, phone, email, realName, role, organizationId, department, position } = req.body;
  
  try {
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await db.query(
      `INSERT INTO users (username, password_hash, phone, email, real_name, role, organization_id, department, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [username, hashedPassword, phone, email, realName, role, organizationId, department, position]
    );
    
    res.status(201).json({ message: '用户创建成功', user: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: '用户名或手机号已存在' });
    }
    console.error('创建用户错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.put('/:id', auth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { phone, email, realName, role, organizationId, department, position, status } = req.body;
  
  try {
    const result = await db.query(
      `UPDATE users
       SET phone = $1, email = $2, real_name = $3, role = $4, organization_id = $5,
           department = $6, position = $7, status = $8, updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [phone, email, realName, role, organizationId, department, position, status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    res.json({ message: '用户更新成功', user: result.rows[0] });
  } catch (error) {
    console.error('更新用户错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/:id/reset-password', auth, requireAdmin, [
  body('newPassword').isLength({ min: 6 }).withMessage('密码至少6位')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { newPassword } = req.body;

  try {
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const result = await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
      [hashedPassword, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({ message: '密码重置成功' });
  } catch (error) {
    console.error('重置密码错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
