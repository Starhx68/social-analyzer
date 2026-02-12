const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const db = require('../config/database');
const ExternalInterfaceService = require('../services/externalInterfaceService');

// Middleware to allow admin or specific users (like demo001) to access logs
const requireLogAccess = (req, res, next) => {
  if (req.user.role === 'admin' || req.user.username === 'demo001') {
    return next();
  }
  return res.status(403).json({ error: '权限不足' });
};

// 获取日志列表
router.get('/', auth, requireLogAccess, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      interfaceType,
      status,
      crmOrderNo,
      startDate,
      endDate
    } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (interfaceType) {
      paramCount++;
      whereClause += ` AND interface_type = $${paramCount}`;
      params.push(interfaceType);
    }

    if (status) {
      paramCount++;
      whereClause += ` AND status = $${paramCount}`;
      params.push(status);
    }

    if (crmOrderNo) {
      paramCount++;
      whereClause += ` AND crm_order_no ILIKE $${paramCount}`;
      params.push(`%${crmOrderNo}%`);
    }

    if (startDate) {
      paramCount++;
      whereClause += ` AND created_at >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      whereClause += ` AND created_at <= $${paramCount}`;
      params.push(endDate);
    }

    const result = await db.query(
      `SELECT * FROM interface_logs
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) FROM interface_logs ${whereClause}`,
      params
    );

    res.json({
      logs: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Fetch interface logs error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
});

// 重试接口调用
router.post('/:id/retry', auth, requireLogAccess, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. 获取日志记录
    const logResult = await db.query(
      'SELECT * FROM interface_logs WHERE id = $1',
      [id]
    );

    if (logResult.rows.length === 0) {
      return res.status(404).json({ error: 'Log not found' });
    }

    const log = logResult.rows[0];

    // 2. 根据类型重试
    let result;
    if (log.interface_type === 'update_sn') {
      result = await ExternalInterfaceService.callUpdateSn(log.order_id);
    } else if (log.interface_type === 'get_invoice') {
      // 获取发票是异步的，但手动重试可以同步触发一次
      // 注意：callGetInvoice 内部会记录新日志
      await ExternalInterfaceService.callGetInvoice(log.order_id, log.crm_order_no);
      result = { success: true, message: 'Retry initiated' };
    } else {
      return res.status(400).json({ error: 'Unknown interface type' });
    }

    res.json({ message: 'Retry successful', result });

  } catch (error) {
    console.error('Retry interface call error:', error);
    res.status(500).json({ error: 'Retry failed: ' + error.message });
  }
});

module.exports = router;
