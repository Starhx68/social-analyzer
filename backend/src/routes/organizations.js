const express = require('express');
const router = express.Router();
const { auth, requireAdmin } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const oracle = require('../utils/oracle');

// Oracle 供应商查询
router.get('/lookup-vendor/:code', auth, async (req, res) => {
  try {
    const { code } = req.params;
    
    // 如果 Oracle 未启用，直接返回空
    const config = require('../config');
    if (!config.oracle.enabled) {
      return res.status(503).json({ error: 'Oracle 服务未启用' });
    }

    const result = await oracle.execute(
      'SELECT VEN_NAME FROM hmall.hm_ecc_vendor WHERE VEN_CODE = :code',
      { code },
      { outFormat: oracle.oracledb.OUT_FORMAT_OBJECT }
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '供应商不存在' });
    }
    
    res.json({ name: result.rows[0].VEN_NAME });
  } catch (error) {
    console.error('查询供应商错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, type, status, keyword } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 0;
    
    if (type) {
      paramCount++;
      whereClause += ` AND type = $${paramCount}`;
      params.push(type);
    }
    
    if (status) {
      paramCount++;
      whereClause += ` AND status = $${paramCount}`;
      params.push(status);
    }
    
    if (keyword) {
      paramCount++;
      whereClause += ` AND (name ILIKE $${paramCount} OR code ILIKE $${paramCount})`;
      params.push(`%${keyword}%`);
    }
    
    const result = await db.query(
      `SELECT * FROM organizations
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...params, parseInt(limit), parseInt(offset)]
    );
    
    const countResult = await db.query(
      `SELECT COUNT(*) FROM organizations ${whereClause}`,
      params
    );
    
    res.json({
      organizations: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('获取组织列表错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      'SELECT * FROM organizations WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '组织不存在' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('获取组织信息错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/', auth, requireAdmin, [
  body('name').notEmpty().withMessage('组织名称不能为空'),
  body('code').notEmpty().withMessage('组织编码不能为空'),
  body('type').isIn(['retailer', 'brand', 'government']).withMessage('类型无效')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const { name, code, type, contactPerson, contactPhone, address } = req.body;
  
  try {
    const result = await db.query(
      `INSERT INTO organizations (name, code, type, contact_person, contact_phone, district, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name, code, type, contactPerson, contactPhone, address, 'active']
    );
    
    res.status(201).json({ message: '组织创建成功', organization: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: '组织编码已存在' });
    }
    console.error('创建组织错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.put('/:id', auth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, type, contactPerson, contactPhone, address, status } = req.body;
  
  try {
    const result = await db.query(
      `UPDATE organizations
       SET name = $1, type = $2, contact_person = $3, contact_phone = $4,
           district = $5, status = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [name, type, contactPerson, contactPhone, address, status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '组织不存在' });
    }
    
    res.json({ message: '组织更新成功', organization: result.rows[0] });
  } catch (error) {
    console.error('更新组织错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
