const express = require('express');
const router = express.Router();
const ExternalInterfaceService = require('../services/externalInterfaceService');
const { auth, requireAuditor, requirePrivilegedOrg } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');

router.get('/', auth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      plateType,
      status,
      auditStatus,
      startDate,
      endDate,
      keyword,
      exactOrderNos,
      syncStatus,
      reportNationalStatus,
      reportCentralStatus
    } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 0;

    const isPrivilegedOrg = !!req.user.is_privileged_organization;

    // 数据权限控制：除特权单位外只能查看本单位数据
    if (!isPrivilegedOrg) {
      paramCount++;
      whereClause += ` AND o.organization_id = $${paramCount}`;
      params.push(req.user.organization_id);
      
      // 非特权单位默认只显示已同步的订单，除非明确指定了状态
      if (!syncStatus && !exactOrderNos) {
        whereClause += ` AND os.sync_status = 'synced'`;
      }
    }

    if (exactOrderNos) {
      const orderNoList = Array.isArray(exactOrderNos) ? exactOrderNos : exactOrderNos.split(',');
      if (orderNoList.length > 0) {
        paramCount++;
        whereClause += ` AND (os.mchnt_ord_no = ANY($${paramCount}) OR o.crm_order_no = ANY($${paramCount}))`;
        params.push(orderNoList);
      }
    }

    if (plateType) {
      paramCount++;
      whereClause += ` AND os.plate_type = $${paramCount}`;
      params.push(plateType);
    }

    if (status) {
      paramCount++;
      whereClause += ` AND o.status = $${paramCount}`;
      params.push(status);
    }

    if (auditStatus) {
      paramCount++;
      whereClause += ` AND o.audit_status = $${paramCount}`;
      params.push(auditStatus);
    }

    if (syncStatus) {
      paramCount++;
      whereClause += ` AND os.sync_status = $${paramCount}`;
      params.push(syncStatus);
    }

    if (reportNationalStatus) {
      paramCount++;
      whereClause += ` AND os.report_national_status = $${paramCount}`;
      params.push(reportNationalStatus);
    }

    if (reportCentralStatus) {
      paramCount++;
      whereClause += ` AND os.report_central_status = $${paramCount}`;
      params.push(reportCentralStatus);
    }

    if (startDate) {
      paramCount++;
      whereClause += ` AND o.created_at >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      whereClause += ` AND o.created_at <= $${paramCount}`;
      params.push(endDate);
    }

    if (keyword) {
      paramCount++;
      // 状态中文映射
      const statusMap = {
        '待上传': 'pending',
        '上传中': 'uploading',
        '待审核': 'audit_pending',
        '审核通过': 'audit_passed',
        '审核驳回': 'rejected',
        '已驳回': 'rejected', // 常用别名
        '已完成': 'completed',
        '发票已开具': 'invoice_collected'
      };
      
      const mappedStatus = statusMap[keyword.trim()];
      
      if (mappedStatus) {
        // 如果关键字匹配状态名，则同时查询对应的状态
        whereClause += ` AND (os.mchnt_ord_no ILIKE $${paramCount} OR o.crm_order_no ILIKE $${paramCount} OR o.status = '${mappedStatus}')`;
      } else {
        // 只查询订单号（商户订单号或快乐购单号），移除商品名和发票号查询以提高精确度
        whereClause += ` AND (os.mchnt_ord_no ILIKE $${paramCount} OR o.crm_order_no ILIKE $${paramCount})`;
      }
      params.push(`%${keyword}%`);
    }

    const result = await db.query(
      `SELECT
        o.id,
        o.sync_id,
        o.mchnt_ord_no,
        o.crm_order_no,
        o.plate_type,
        o.product_name,
        o.product_model,
        o.product_brand,
        o.product_category,
        o.product_price,
        o.subsidy_amount,
        o.sn_code,
        o.invoice_no,
        o.invoice_amount,
        o.invoice_date,
        o.status,
        o.audit_status,
        o.audit_remark,
        o.created_at,
        o.updated_at,
        o.last_report_national_at,
        o.last_report_central_at,
        u.username as user_name,
        u.real_name as user_real_name,
        au.real_name as auditor_real_name,
        COALESCE(org.name, org2.name) as organization_name,
        -- 同步状态信息
        os.sync_status,
        os.report_national_status,
        os.report_central_status,
        os.external_created_at,
        os.external_updated_at,
        os.synced_at,
        os.imei1,
        os.imei2
       FROM orders o
       INNER JOIN order_sync os ON o.sync_id = os.id
       LEFT JOIN users u ON o.user_id = u.id
       LEFT JOIN users au ON o.audit_user_id = au.id
       LEFT JOIN organizations org ON o.organization_id = org.id
       LEFT JOIN organizations org2 ON org2.code = o.ven_code
       ${whereClause}
       ORDER BY o.created_at DESC
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    const countResult = await db.query(
      `SELECT COUNT(*)
       FROM orders o
       INNER JOIN order_sync os ON o.sync_id = os.id
       ${whereClause}`,
      params
    );

    res.json({
      orders: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('获取订单列表错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/stats', auth, async (req, res) => {
  try {
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 0;

    const isPrivilegedOrg = !!req.user.is_privileged_organization;

    // 数据权限控制：除特权单位外只能查看本单位数据
    if (!isPrivilegedOrg) {
      paramCount++;
      whereClause += ` AND organization_id = $${paramCount}`;
      params.push(req.user.organization_id);
    }

    const result = await db.query(
      `SELECT status, COUNT(*)::int as count
       FROM orders
       ${whereClause}
       GROUP BY status`,
      params
    );
    
    const stats = {
      total: 0,
      pending: 0,
      auditing: 0,
      approved: 0,
      rejected: 0,
      invoice_collected: 0
    };

    result.rows.forEach(row => {
      stats.total += row.count;
      if (stats[row.status] !== undefined) {
        stats[row.status] = row.count;
      }
    });

    res.json(stats);
  } catch (error) {
    console.error('获取订单统计错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT
        o.*,
        u.username as user_name,
        u.real_name as user_real_name,
        COALESCE(org.name, org2.name) as organization_name,
        -- 同步状态信息
        os.id as sync_id,
        os.oracle_rowid,
        os.external_order_id,
        os.sync_status,
        os.sync_error,
        os.sync_retry_count,
        os.report_national_status,
        os.report_central_status,
        os.external_created_at,
        os.external_updated_at,
        os.synced_at,
        os.imei1,
        os.imei2,
        os.goods_energy,
        os.goods_energy_grade,
        os.seller_id_code,
        os.buyer_id_code
       FROM orders o
       LEFT JOIN order_sync os ON o.sync_id = os.id
       LEFT JOIN users u ON o.user_id = u.id
       LEFT JOIN organizations org ON o.organization_id = org.id
       LEFT JOIN organizations org2 ON org2.code = o.ven_code
       WHERE o.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }

    const order = result.rows[0];

    const isPrivilegedOrg = !!req.user.is_privileged_organization;
    if (!isPrivilegedOrg) {
      const sameOrgById = order.organization_id && order.organization_id === req.user.organization_id;
      const sameOrgByVenCode =
        order.ven_code &&
        req.user.organization_code &&
        order.ven_code.toLowerCase() === req.user.organization_code.toLowerCase();

      if (!sameOrgById && !sameOrgByVenCode) {
        return res.status(403).json({ error: '无权查看该订单' });
      }
    }

    const materialsResult = await db.query(
      'SELECT * FROM materials WHERE order_id = $1 ORDER BY image_index, uploaded_at',
      [id]
    );

    order.materials = materialsResult.rows;

    // 获取审核日志
    const auditLogsResult = await db.query(
      `SELECT al.*, u.username as auditor_name, u.real_name as auditor_real_name
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.order_id = $1
       ORDER BY al.created_at DESC`,
      [id]
    );

    order.audit_logs = auditLogsResult.rows;

    res.json(order);
  } catch (error) {
    console.error('获取订单详情错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/', auth, [
  body('mchntOrdNo').notEmpty().withMessage('商户订单号不能为空'),
  body('plateType').isIn(['home_appliance', 'digital_3c', 'home_decoration', 'aging_adaptation']).withMessage('板块类型无效')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const {
    mchntOrdNo,
    plateType,
    mchntNo,
    mchntNm,
    mchntRegDist,
    mchntRegDistCode,
    productName,
    productModel,
    productBrand,
    productCategory,
    productCategoryCode,
    productUnit,
    productQuantity,
    productPrice,
    productTotalAmount,
    invoiceNo,
    invoiceDate,
    invoiceAmount,
    invoiceSubsidyAmount,
    invoiceTitle,
    invoiceItemName,
    invoiceOrderNo,
    invoicePlatformOrderNo,
    invoiceRemark,
    deliveryType,
    deliveryAddress,
    deliveryNo,
    signedTime,
    buyerIdCode,
    sellerIdCode,
    sellerUnit,
    extraInfo
  } = req.body;
  
  try {
    const result = await db.query(
      `INSERT INTO orders (
        mchnt_ord_no, plate_type, user_id, organization_id,
        mchnt_no, mchnt_nm, mchnt_reg_dist, mchnt_reg_dist_code,
        product_name, product_model, product_brand, product_category, product_category_code,
        product_unit, product_quantity, product_price, product_total_amount,
        invoice_no, invoice_date, invoice_amount, invoice_subsidy_amount,
        invoice_title, invoice_item_name, invoice_order_no, invoice_platform_order_no, invoice_remark,
        delivery_type, delivery_address, delivery_no, signed_time,
        buyer_id_code, seller_id_code, seller_unit,
        status, extra_info
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, 'pending', $34)
      RETURNING *`,
      [
        mchntOrdNo, plateType, req.user.id, req.user.organization_id,
        mchntNo, mchntNm, mchntRegDist, mchntRegDistCode,
        productName, productModel, productBrand, productCategory, productCategoryCode,
        productUnit, productQuantity, productPrice, productTotalAmount,
        invoiceNo, invoiceDate, invoiceAmount, invoiceSubsidyAmount,
        invoiceTitle, invoiceItemName, invoiceOrderNo, invoicePlatformOrderNo, invoiceRemark,
        deliveryType, deliveryAddress, deliveryNo, signedTime,
        buyerIdCode, sellerIdCode, sellerUnit,
        JSON.stringify(extraInfo || {})
      ]
    );
    
    res.status(201).json({ message: '订单创建成功', order: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: '商户订单号已存在' });
    }
    console.error('创建订单错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.put('/:id', auth, async (req, res) => {
  const { id } = req.params;
  const {
    productName,
    productModel,
    productBrand,
    productCategory,
    productCategoryCode,
    productQuantity,
    productPrice,
    productTotalAmount,
    invoiceNo,
    invoiceDate,
    invoiceAmount,
    invoiceSubsidyAmount,
    invoiceTitle,
    deliveryAddress,
    deliveryNo,
    signedTime,
    status,
    extraInfo,
    snCode
  } = req.body;
  
  try {
    const orderPermissionResult = await db.query(
      'SELECT organization_id, ven_code FROM orders WHERE id = $1',
      [id]
    );

    if (orderPermissionResult.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }

    const orderPermission = orderPermissionResult.rows[0];
    const isPrivilegedOrg = !!req.user.is_privileged_organization;
    if (!isPrivilegedOrg) {
      const sameOrgById = orderPermission.organization_id && orderPermission.organization_id === req.user.organization_id;
      const sameOrgByVenCode =
        orderPermission.ven_code &&
        req.user.organization_code &&
        orderPermission.ven_code.toLowerCase() === req.user.organization_code.toLowerCase();

      if (!sameOrgById && !sameOrgByVenCode) {
        return res.status(403).json({ error: '无权更新该订单' });
      }
    }

    const result = await db.query(
      `UPDATE orders
       SET product_name = $1, product_model = $2, product_brand = $3, product_category = $4,
           product_category_code = $5, product_quantity = $6, product_price = $7, product_total_amount = $8,
           invoice_no = $9, invoice_date = $10, invoice_amount = $11, invoice_subsidy_amount = $12,
           invoice_title = $13, delivery_address = $14, delivery_no = $15, signed_time = $16,
           status = $17, extra_info = $18, sn_code = $19, updated_at = NOW()
       WHERE id = $20
       RETURNING *`,
      [
        productName, productModel, productBrand, productCategory, productCategoryCode,
        productQuantity, productPrice, productTotalAmount,
        invoiceNo, invoiceDate, invoiceAmount, invoiceSubsidyAmount, invoiceTitle,
        deliveryAddress, deliveryNo, signedTime, status, JSON.stringify(extraInfo || {}), snCode, id
      ]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }

    res.json({ message: '订单更新成功', order: result.rows[0] });
  } catch (error) {
    console.error('更新订单错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.patch('/:id', auth, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  // 允许更新的字段映射 (camelCase -> snake_case)
  const fieldMap = {
    productName: 'product_name',
    productModel: 'product_model',
    productBrand: 'product_brand',
    productCategory: 'product_category',
    productCategoryCode: 'product_category_code',
    productQuantity: 'product_quantity',
    productPrice: 'product_price',
    productTotalAmount: 'product_total_amount',
    invoiceNo: 'invoice_no',
    invoiceDate: 'invoice_date',
    invoiceAmount: 'invoice_amount',
    invoiceSubsidyAmount: 'invoice_subsidy_amount',
    invoiceTitle: 'invoice_title',
    deliveryAddress: 'delivery_address',
    deliveryNo: 'delivery_no',
    signedTime: 'signed_time',
    status: 'status',
    extraInfo: 'extra_info',
    snCode: 'sn_code',
    sn_code: 'sn_code',
    imei1: 'imei1',
    imei2: 'imei2'
  };

  const fields = [];
  const values = [];
  let paramCount = 1;

  Object.keys(updates).forEach(key => {
    if (fieldMap[key] && updates[key] !== undefined) {
      fields.push(`${fieldMap[key]} = $${paramCount}`);
      if (key === 'extraInfo') {
        values.push(JSON.stringify(updates[key]));
      } else {
        values.push(updates[key]);
      }
      paramCount++;
    }
  });

  if (fields.length === 0) {
    return res.status(400).json({ error: '没有提供有效的更新字段' });
  }

  // 检查SN码重复
  const snCodeVal = updates.snCode || updates.sn_code;
  if (snCodeVal) {
    const duplicateCheck = await db.query(
      'SELECT mchnt_ord_no FROM orders WHERE sn_code = $1 AND id != $2',
      [snCodeVal, id]
    );
    if (duplicateCheck.rows.length > 0) {
      return res.status(409).json({
        error: 'SN码重复',
        conflictOrder: duplicateCheck.rows[0].mchnt_ord_no
      });
    }
  }

  // 检查IMEI1重复
  if (updates.imei1) {
    const duplicateCheck = await db.query(
      'SELECT mchnt_ord_no FROM orders WHERE (imei1 = $1 OR imei2 = $1) AND id != $2',
      [updates.imei1, id]
    );
    if (duplicateCheck.rows.length > 0) {
      return res.status(409).json({
        error: 'IMEI1重复',
        conflictOrder: duplicateCheck.rows[0].mchnt_ord_no
      });
    }
  }

  // 检查IMEI2重复
  if (updates.imei2) {
    const duplicateCheck = await db.query(
      'SELECT mchnt_ord_no FROM orders WHERE (imei1 = $1 OR imei2 = $1) AND id != $2',
      [updates.imei2, id]
    );
    if (duplicateCheck.rows.length > 0) {
      return res.status(409).json({
        error: 'IMEI2重复',
        conflictOrder: duplicateCheck.rows[0].mchnt_ord_no
      });
    }
  }

  values.push(id);
  
  try {
    const orderPermissionResult = await db.query(
      'SELECT organization_id, ven_code FROM orders WHERE id = $1',
      [id]
    );

    if (orderPermissionResult.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }

    const orderPermission = orderPermissionResult.rows[0];
    const isPrivilegedOrg = !!req.user.is_privileged_organization;
    if (!isPrivilegedOrg) {
      const sameOrgById = orderPermission.organization_id && orderPermission.organization_id === req.user.organization_id;
      const sameOrgByVenCode =
        orderPermission.ven_code &&
        req.user.organization_code &&
        orderPermission.ven_code.toLowerCase() === req.user.organization_code.toLowerCase();

      if (!sameOrgById && !sameOrgByVenCode) {
        return res.status(403).json({ error: '无权更新该订单' });
      }
    }

    const result = await db.query(
      `UPDATE orders
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }

    res.json({ message: '订单更新成功', order: result.rows[0] });
  } catch (error) {
    console.error('更新订单错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/:id/submit-audit', auth, async (req, res) => {
  const { id } = req.params;
  
  try {
    const orderPermissionResult = await db.query(
      'SELECT organization_id, ven_code, status FROM orders WHERE id = $1',
      [id]
    );

    if (orderPermissionResult.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }

    const orderPermission = orderPermissionResult.rows[0];
    
    if (orderPermission.status !== 'uploading') {
      return res.status(400).json({ error: '只有部分上传状态的订单才能提交审核' });
    }
    
    const isPrivilegedOrg = !!req.user.is_privileged_organization;
    if (!isPrivilegedOrg) {
      const sameOrgById = orderPermission.organization_id && orderPermission.organization_id === req.user.organization_id;
      const sameOrgByVenCode =
        orderPermission.ven_code &&
        req.user.organization_code &&
        orderPermission.ven_code.toLowerCase() === req.user.organization_code.toLowerCase();

      if (!sameOrgById && !sameOrgByVenCode) {
        return res.status(403).json({ error: '无权提交该订单审核' });
      }
    }

    await db.query('BEGIN');
    
    const orderResult = await db.query(
      `UPDATE orders
       SET status = 'auditing', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    
    if (orderResult.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: '订单不存在' });
    }
    
    await db.query(
      `INSERT INTO audit_logs (order_id, user_id, action, old_status, new_status, remark)
       VALUES ($1, $2, 'submit_audit', $3, 'auditing', '提交审核')`,
      [id, req.user.id, orderPermission.status]
    );
    
    await db.query('COMMIT');
    
    res.json({ message: '提交审核成功', order: orderResult.rows[0] });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('提交审核错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/:id/audit', auth, requireAuditor, requirePrivilegedOrg, async (req, res) => {
  const { id } = req.params;
  const { auditStatus, auditRemark } = req.body;
  
  try {
    const orderPermissionResult = await db.query(
      'SELECT organization_id, ven_code FROM orders WHERE id = $1',
      [id]
    );

    if (orderPermissionResult.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }

    const orderPermission = orderPermissionResult.rows[0];
    const isPrivilegedOrg = !!req.user.is_privileged_organization;
    if (!isPrivilegedOrg) {
      const sameOrgById = orderPermission.organization_id && orderPermission.organization_id === req.user.organization_id;
      const sameOrgByVenCode =
        orderPermission.ven_code &&
        req.user.organization_code &&
        orderPermission.ven_code.toLowerCase() === req.user.organization_code.toLowerCase();

      if (!sameOrgById && !sameOrgByVenCode) {
        return res.status(403).json({ error: '无权审核该订单' });
      }
    }

    const ExternalInterfaceService = require('../services/externalInterfaceService');

    await db.query('BEGIN');
    
    // 如果审核通过，订单状态改为 approved
    // 如果审核驳回，订单状态改为 rejected
    const newStatus = auditStatus === 'approved' ? 'approved' : 'rejected';
    
    const orderResult = await db.query(
      `UPDATE orders
       SET status = $1, audit_status = $2, audit_remark = $3, audit_user_id = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [newStatus, auditStatus, auditRemark, req.user.id, id]
    );
    
    if (orderResult.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: '订单不存在' });
    }
    
    await db.query(
      `INSERT INTO audit_logs (order_id, user_id, action, old_status, new_status, remark)
       VALUES ($1, $2, $3, 'auditing', $4, $5)`,
      [id, req.user.id, auditStatus === 'approved' ? 'audit_pass' : 'audit_reject', newStatus, auditRemark]
    );
    
    await db.query('COMMIT');

    // 审核通过后，触发 SN 更新
    if (newStatus === 'approved') {
      try {
        // 异步调用，不阻塞响应
        ExternalInterfaceService.callUpdateSn(id).catch(err => {
          console.error(`Trigger update SN failed for order ${id}:`, err);
        });
      } catch (err) {
        console.error(`Trigger update SN failed for order ${id}:`, err);
      }
    }
    
    res.json({ message: '审核完成', order: orderResult.rows[0] });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('审核订单错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/:id/audit-logs', auth, async (req, res) => {
  const { id } = req.params;
  
  try {
    const orderResult = await db.query(
      'SELECT organization_id, ven_code FROM orders WHERE id = $1',
      [id]
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
        return res.status(403).json({ error: '无权查看该订单审核记录' });
      }
    }

    const logsResult = await db.query(
      `SELECT al.*, u.username, u.real_name
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.order_id = $1
       ORDER BY al.created_at DESC`,
      [id]
    );

    res.json(logsResult.rows);
  } catch (error) {
    console.error('获取审核记录错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * 根据手机号查询外部订单号
 */
router.post('/query-by-mobile', auth, async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile) {
      return res.status(400).json({ error: '手机号不能为空' });
    }

    const orders = await ExternalInterfaceService.queryOrderByMobile(mobile);
    res.json({ success: true, orders });
  } catch (error) {
    console.error('根据手机号查询订单失败:', error);
    res.status(500).json({ error: error.message || '查询失败' });
  }
});

module.exports = router;
