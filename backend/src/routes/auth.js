const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const db = require('../config/database');
const config = require('../config');

router.post('/login', [
  body('username').notEmpty().withMessage('用户名不能为空'),
  body('password').notEmpty().withMessage('密码不能为空')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const { username, password } = req.body;
  
  try {
    const result = await db.query(
      `SELECT u.*, o.name as organization_name 
       FROM users u 
       LEFT JOIN organizations o ON u.organization_id = o.id 
       WHERE u.username = $1`,
      [username]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    const user = result.rows[0];
    
    if (user.status !== 'active') {
      return res.status(403).json({ error: '账号已被禁用' });
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    await db.query(
      'UPDATE users SET last_login_at = NOW(), last_login_ip = $1 WHERE id = $2',
      [req.ip, user.id]
    );
    
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        realName: user.real_name,
        role: user.role,
        organizationId: user.organization_id,
        organizationName: user.organization_name,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/register', [
  body('username').isLength({ min: 3, max: 50 }).withMessage('用户名长度为3-50字符'),
  body('password').isLength({ min: 6 }).withMessage('密码至少6位'),
  body('phone').isMobilePhone('zh-CN').withMessage('手机号格式不正确')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const { username, password, phone, realName, organizationId } = req.body;
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await db.query(
      `INSERT INTO users (username, password_hash, phone, real_name, organization_id, role)
       VALUES ($1, $2, $3, $4, $5, 'user')
       RETURNING id, username, real_name, role, organization_id`,
      [username, hashedPassword, phone, realName, organizationId]
    );
    
    const user = result.rows[0];
    
    res.status(201).json({
      message: '注册成功',
      user: {
        id: user.id,
        username: user.username,
        realName: user.real_name,
        role: user.role
      }
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: '用户名或手机号已存在' });
    }
    console.error('注册错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.*, o.name as organization_name 
       FROM users u 
       LEFT JOIN organizations o ON u.organization_id = o.id 
       WHERE u.id = $1`,
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    const user = result.rows[0];
    
    res.json({
      user: {
        id: user.id,
        username: user.username,
        realName: user.real_name,
        role: user.role,
        organizationId: user.organization_id,
        organizationName: user.organization_name,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
