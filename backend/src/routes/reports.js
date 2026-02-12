const express = require('express');
const router = express.Router();
const { auth, requireAuditor, requirePrivilegedOrg } = require('../middleware/auth');
const axios = require('axios');
const config = require('../config');
const db = require('../config/database');

router.post('/audit-system/:orderId', auth, requireAuditor, requirePrivilegedOrg, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const orderResult = await db.query(
      'SELECT * FROM orders WHERE id = $1',
      [orderId]
    );
    
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }
    
    const order = orderResult.rows[0];

    const isPrivilegedOrg = !!req.user.is_privileged_organization;
    if (!isPrivilegedOrg) {
      const sameOrgById = order.organization_id && order.organization_id === req.user.organization_id;
      const sameOrgByVenCode =
        order.ven_code &&
        req.user.organization_code &&
        order.ven_code.toLowerCase() === req.user.organization_code.toLowerCase();
      
      if (!sameOrgById && !sameOrgByVenCode) {
        return res.status(403).json({ error: '无权上报该订单' });
      }
    }
    
    const materialsResult = await db.query(
      'SELECT * FROM materials WHERE order_id = $1 ORDER BY image_index',
      [orderId]
    );
    
    const materials = materialsResult.rows;
    
    const reportData = {
      mchntOrdNo: order.mchnt_ord_no,
      plateType: order.plate_type,
      mchntNo: order.mchnt_no,
      mchntNm: order.mchnt_nm,
      mchntRegDist: order.mchnt_reg_dist,
      mchntRegDistCode: order.mchnt_reg_dist_code,
      productName: order.product_name,
      productModel: order.product_model,
      productBrand: order.product_brand,
      productCategory: order.product_category,
      productCategoryCode: order.product_category_code,
      productUnit: order.product_unit,
      productQuantity: order.product_quantity,
      productPrice: order.product_price,
      productTotalAmount: order.product_total_amount,
      invoiceNo: order.invoice_no,
      invoiceDate: order.invoice_date,
      invoiceAmount: order.invoice_amount,
      invoiceSubsidyAmount: order.invoice_subsidy_amount,
      invoiceTitle: order.invoice_title,
      invoiceItemName: order.invoice_item_name,
      invoiceOrderNo: order.invoice_order_no,
      invoicePlatformOrderNo: order.invoice_platform_order_no,
      invoiceRemark: order.invoice_remark,
      deliveryType: order.delivery_type,
      deliveryAddress: order.delivery_address,
      deliveryNo: order.delivery_no,
      signedTime: order.signed_time,
      buyerIdCode: order.buyer_id_code,
      sellerIdCode: order.seller_id_code,
      sellerUnit: order.seller_unit,
      extraInfo: order.extra_info,
      materials: materials.map(m => ({
        materialType: m.material_type,
        imageIndex: m.image_index,
        fileUrl: m.file_url,
        ocrResult: m.ocr_result
      }))
    };
    
    const logResult = await db.query(
      `INSERT INTO report_logs (order_id, report_type, report_data, status, reported_by)
       VALUES ($1, 'audit_system', $2, 'pending', $3)
       RETURNING *`,
      [orderId, JSON.stringify(reportData), req.user.id]
    );
    
    const reportLog = logResult.rows[0];
    
    try {
      const response = await axios.post(
        `${config.auditSystem.apiUrl}/orders`,
        reportData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.auditSystem.apiKey}`
          },
          timeout: 30000
        }
      );
      
      await db.query(
        `UPDATE report_logs
         SET response_data = $1, status = 'success', reported_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(response.data), reportLog.id]
      );
      
      await db.query(
        `UPDATE orders
         SET status = 'reported'
         WHERE id = $1`,
        [orderId]
      );
      
      res.json({
        success: true,
        message: '上报成功',
        reportLogId: reportLog.id
      });
      
    } catch (error) {
      await db.query(
        `UPDATE report_logs
         SET status = 'failed', error_message = $1, error_code = $2
         WHERE id = $3`,
        [error.message, error.code || 'NETWORK_ERROR', reportLog.id]
      );
      
      res.status(500).json({
        error: '上报失败',
        reportLogId: reportLog.id,
        message: error.message
      });
    }
    
  } catch (error) {
    console.error('上报审核系统错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/central-platform/:orderId', auth, requireAuditor, requirePrivilegedOrg, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const orderResult = await db.query(
      'SELECT * FROM orders WHERE id = $1',
      [orderId]
    );
    
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }
    
    const order = orderResult.rows[0];

    const isPrivilegedOrg = !!req.user.is_privileged_organization;
    if (!isPrivilegedOrg) {
      const sameOrgById = order.organization_id && order.organization_id === req.user.organization_id;
      const sameOrgByVenCode =
        order.ven_code &&
        req.user.organization_code &&
        order.ven_code.toLowerCase() === req.user.organization_code.toLowerCase();
      
      if (!sameOrgById && !sameOrgByVenCode) {
        return res.status(403).json({ error: '无权上报该订单' });
      }
    }
    
    const reportData = {
      orderId: order.id,
      merchantOrderNo: order.mchnt_ord_no,
      plateType: order.plate_type,
      merchantNo: order.mchnt_no,
      merchantName: order.mchnt_nm,
      merchantRegDistrict: order.mchnt_reg_dist,
      productName: order.product_name,
      productModel: order.product_model,
      productBrand: order.product_brand,
      productCategory: order.product_category,
      productQuantity: order.product_quantity,
      productTotalAmount: order.product_total_amount,
      invoiceNo: order.invoice_no,
      invoiceAmount: order.invoice_amount,
      invoiceSubsidyAmount: order.invoice_subsidy_amount,
      deliveryAddress: order.delivery_address,
      buyerIdCode: order.buyer_id_code,
      sellerIdCode: order.seller_id_code,
      extraInfo: order.extra_info,
      reportTime: new Date().toISOString()
    };
    
    const logResult = await db.query(
      `INSERT INTO report_logs (order_id, report_type, report_data, status, reported_by)
       VALUES ($1, 'central_platform', $2, 'pending', $3)
       RETURNING *`,
      [orderId, JSON.stringify(reportData), req.user.id]
    );
    
    const reportLog = logResult.rows[0];
    
    try {
      const response = await axios.post(
        `${config.centralPlatform.apiUrl}/report`,
        reportData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.centralPlatform.apiKey}`
          },
          timeout: 30000
        }
      );
      
      await db.query(
        `UPDATE report_logs
         SET response_data = $1, status = 'success', reported_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(response.data), reportLog.id]
      );
      
      res.json({
        success: true,
        message: '上报成功',
        reportLogId: reportLog.id
      });
      
    } catch (error) {
      await db.query(
        `UPDATE report_logs
         SET status = 'failed', error_message = $1, error_code = $2
         WHERE id = $3`,
        [error.message, error.code || 'NETWORK_ERROR', reportLog.id]
      );
      
      res.status(500).json({
        error: '上报失败',
        reportLogId: reportLog.id,
        message: error.message
      });
    }
    
  } catch (error) {
    console.error('上报中央平台错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/logs', auth, requirePrivilegedOrg, async (req, res) => {
  try {
    const { page = 1, limit = 10, reportType, status, orderId } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 0;
    
    if (reportType) {
      paramCount++;
      whereClause += ` AND report_type = $${paramCount}`;
      params.push(reportType);
    }
    
    if (status) {
      paramCount++;
      whereClause += ` AND status = $${paramCount}`;
      params.push(status);
    }
    
    if (orderId) {
      paramCount++;
      whereClause += ` AND order_id = $${paramCount}`;
      params.push(orderId);
    }
    
    const result = await db.query(
      `SELECT rl.*, o.mchnt_ord_no, o.plate_type, u.username as reporter_name
       FROM report_logs rl
       LEFT JOIN orders o ON rl.order_id = o.id
       LEFT JOIN users u ON rl.reported_by = u.id
       ${whereClause}
       ORDER BY rl.created_at DESC
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...params, parseInt(limit), parseInt(offset)]
    );
    
    const countResult = await db.query(
      `SELECT COUNT(*) FROM report_logs ${whereClause}`,
      params
    );
    
    res.json({
      logs: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('获取上报日志错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/retry/:id', auth, requireAuditor, requirePrivilegedOrg, async (req, res) => {
  try {
    const { id } = req.params;
    
    const logResult = await db.query(
      'SELECT * FROM report_logs WHERE id = $1',
      [id]
    );
    
    if (logResult.rows.length === 0) {
      return res.status(404).json({ error: '上报记录不存在' });
    }
    
    const log = logResult.rows[0];
    
    if (log.retry_count >= log.max_retries) {
      return res.status(400).json({ error: '已达到最大重试次数' });
    }
    
    await db.query(
      `UPDATE report_logs
       SET retry_count = retry_count + 1, status = 'retrying', updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
    
    const apiUrl = log.report_type === 'audit_system' 
      ? config.auditSystem.apiUrl 
      : config.centralPlatform.apiUrl;
    
    const apiKey = log.report_type === 'audit_system' 
      ? config.auditSystem.apiKey 
      : config.centralPlatform.apiKey;
    
    try {
      const endpoint = log.report_type === 'audit_system' ? '/orders' : '/report';
      
      const response = await axios.post(
        `${apiUrl}${endpoint}`,
        log.report_data,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 30000
        }
      );
      
      await db.query(
        `UPDATE report_logs
         SET response_data = $1, status = 'success', reported_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(response.data), id]
      );
      
      res.json({
        success: true,
        message: '重试上报成功'
      });
      
    } catch (error) {
      await db.query(
        `UPDATE report_logs
         SET status = 'failed', error_message = $1, error_code = $2
         WHERE id = $3`,
        [error.message, error.code || 'NETWORK_ERROR', id]
      );
      
      res.status(500).json({
        error: '重试上报失败',
        message: error.message
      });
    }
    
  } catch (error) {
    console.error('重试上报错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
