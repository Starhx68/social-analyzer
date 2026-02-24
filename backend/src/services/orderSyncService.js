/**
 * 订单同步服务
 * 功能：从 od_order_subsidy_sync 表解析数据到 order_sync 表，并创建业务订单
 * 数据流向：Oracle -> od_order_subsidy_sync -> order_sync -> orders
 */

const db = require('../config/database');
const logger = require('../config/logger');

class OrderSyncService {
  constructor() {
    this.running = false;
    this.timer = null;
  }

  /**
   * 解析 Oracle 数据，提取订单字段
   * @param {Object} data - Oracle 原始数据
   * @returns {Object} 解析后的订单数据
   */
  parseOracleData(data) {
    try {
      // 尝试从 NOTICE_DATA 解析 buyerPayAmount
      let buyerPayAmount = data.BUYERPAYAMOUNT || data.buyerPayAmount;
      if (!buyerPayAmount && data.NOTICE_DATA) {
        try {
          const noticeData = typeof data.NOTICE_DATA === 'string' 
            ? JSON.parse(data.NOTICE_DATA) 
            : data.NOTICE_DATA;
          buyerPayAmount = noticeData.buyerPayAmount || noticeData.BUYERPAYAMOUNT;
        } catch (e) {
          // ignore
        }
      }

      // 判断订单类型：HM30 表示退货单，其他为正常订单
      const orderGb = data.ORDER_GB || data.PLATE_TYPE || data.PC_TP;
      const orderType = (orderGb === 'HM30') ? 'return' : 'normal';

      // 从 Oracle 数据中提取字段（根据实际字段名映射）
      const parsed = {
        oracle_rowid: data.ORACLE_ROWID,
        external_order_id: data.ORDER_NO || data.ORD_NO || data.ORDER_ID || data.HOMA_ORDER_NO,
        mchnt_ord_no: data.MCHNT_ORD_NO || data.HOMA_ORDER_NO || data.ORDER_NO || data.ORD_NO,
        crm_order_no: data.CRM_ORDER_NO,
        order_type: orderType,

        // 板块类型
        plate_type: this.getPlateTypeFromAttr(data) || this.mapPlateType(data.PLATE_TYPE || data.PC_TP || data.ORDER_GB),

        // 产品基础信息
        product_name: data.GOODS_NAME || data.GOODS_NM || data.ITEM_NAME || data.PRODUCT_NAME || this.getProductNameFromAttr(data),
        product_model: data.GOODS_MODEL || data.PRODUCT_MODEL || this.getProductModelFromAttr(data),
        product_brand: data.BRAND_NAME || data.GOODS_BRND || data.PRODUCT_BRAND || this.getProductBrandFromAttr(data),
        product_category: data.CATEGORY_NAME || this.getProductNameFromAttr(data),
        product_category_code: this.getPlbmFromAttr(data) || data.CATEGORY_CODE,
        pc_tp: data.PC_TP,

        // 发票信息
        invoice_no: data.INVOICE_NO,
        invoice_date: data.INVOICE_DATE ? new Date(data.INVOICE_DATE) : null,
        invoice_amount: this.parseDecimal(data.INVOICE_AMT),
        invoice_subsidy_amount: this.parseDecimal(data.INVOICE_SUBSIDY_AMT),
        invoice_item_name: data.INVOICE_ITEM_NAME,
        invoice_order_no: data.INVOICE_ORDER_NO,
        invoice_platform_order_no: data.INVOICE_PLATFORM_ORDER_NO,
        invoice_remark: data.INVOICE_REMARK,

        // 商户信息
        mchnt_no: data.MCHNT_NO,
        mchnt_nm: data.MCHNT_NM,
        mchnt_reg_dist: data.MCHNT_REG_DIST,
        mchnt_reg_dist_code: data.MCHNT_REG_DIST_CODE,

        // 产品详细信息
        goods_energy: data.GOODS_ENERGY,
        goods_energy_grade: data.GOODS_ENERGY_GRADE,
        goods_color: data.GOODS_COLOR,
        goods_volume: data.GOODS_VOLUME,
        product_unit: data.UNIT || data.GOODS_UNIT,
        product_quantity: parseInt(data.GOODS_QTY) || 1,
        product_price: this.parseDecimal(data.ORDER_ACTINCM_AMT),
        subsidy_amount: this.parseDecimal(data.SUBSIDY_AMT || data.NATION_DSCNT_AMT),
        product_total_amount: this.parseDecimal(buyerPayAmount, 100),

        // IMEI 信息（3C品类）
        imei1: data.IMEI1,
        imei2: data.IMEI2,

        // 物流信息
        delivery_type: data.DELIVERY_TYPE,
        delivery_address: data.DELIVERY_ADDR,
        delivery_no: data.LOGISTICS_NO || data.DELIVERY_NO,
        signed_time: data.SIGNED_TIME ? new Date(data.SIGNED_TIME) : null,

        // 身份信息
        buyer_id_code: data.BUYER_ID_CODE,
        seller_id_code: data.SELLER_ID_CODE,
        seller_unit: data.SELLER_UNIT,

        // 额外信息
        extra_info: this.buildExtraInfo(data),

        // 时间戳
        external_created_at: data.CREATE_TIME
          ? new Date(data.CREATE_TIME)
          : (data.INSERT_DATE ? new Date(data.INSERT_DATE) : new Date()),
        external_updated_at: data.MODIFY_DATE
          ? new Date(data.MODIFY_DATE)
          : (data.CREATE_TIME
            ? new Date(data.CREATE_TIME)
            : (data.INSERT_DATE ? new Date(data.INSERT_DATE) : new Date())),
      };

      return parsed;
    } catch (error) {
      logger.error('解析 Oracle 数据失败:', error);
      throw error;
    }
  }

  /**
   * 映射板块类型
   */
  mapPlateType(plateType) {
    const mapping = {
      '家电': 'home_appliance',
      'home_appliance': 'home_appliance',
      '3C': 'digital_3c',
      'digital_3c': 'digital_3c',
      '家装': 'home_decoration',
      'home_decoration': 'home_decoration',
      '适老化': 'aging_adaptation',
      'aging_adaptation': 'aging_adaptation',
      HM20: 'home_appliance',
      HM30: 'digital_3c',
      HM40: 'home_decoration',
      HM50: 'aging_adaptation',
    };
    return mapping[plateType] || 'home_appliance';
  }

  /**
   * 解析 Decimal 字段
   */
  parseDecimal(value, divisor = 1) {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parseFloat((parsed / divisor).toFixed(2));
  }

  /**
   * 构建额外信息 JSONB
   */
  buildExtraInfo(data) {
    const extra = {};
    const knownFields = [
      'ORACLE_ROWID', 'ORD_NO', 'ORDER_NO', 'HOMA_ORDER_NO', 'MCHNT_ORD_NO', 'PLATE_TYPE', 'PC_TP', 'ORDER_GB',
      'GOODS_NAME', 'GOODS_NM', 'GOODS_MODEL', 'BRAND_NAME', 'GOODS_BRND', 'CATEGORY_NAME', 'CATEGORY_CODE',
      'INVOICE_NO', 'INVOICE_DATE', 'INVOICE_AMT', 'INVOICE_SUBSIDY_AMT',
      'MCHNT_NO', 'MCHNT_NM', 'GOODS_QTY', 'GOODS_PRICE', 'GOODS_UNIT', 'SUBSIDY_AMT', 'NATION_DSCNT_AMT',
      'IMEI1', 'IMEI2', 'DELIVERY_TYPE', 'DELIVERY_ADDR', 'LOGISTICS_NO',
      'BUYER_ID_CODE', 'SELLER_ID_CODE', 'SELLER_UNIT', 'CREATE_TIME', 'INSERT_DATE', 'MODIFY_DATE', 'ORDER_ACTINCM_AMT'
    ];

    // 收集所有未知字段到 extra_info
    for (const key in data) {
      if (!knownFields.includes(key) && data[key] !== null && data[key] !== undefined) {
        extra[key] = data[key];
      }
    }

    return extra;
  }

  /**
   * 同步单条记录到 order_sync 表
   */
  async syncRecord(rawSyncRecord, forceUpdate = false) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const data = typeof rawSyncRecord.data === 'string'
        ? JSON.parse(rawSyncRecord.data)
        : rawSyncRecord.data;
      const parsed = this.parseOracleData(data);

      // 检查是否已存在（使用复合唯一约束：order_type + mchnt_ord_no）
      let existingResult = await client.query(
        'SELECT * FROM order_sync WHERE (external_order_id = $1 OR mchnt_ord_no = $2) AND order_type = $3',
        [parsed.external_order_id, parsed.mchnt_ord_no, parsed.order_type]
      );

      if (existingResult.rows.length === 0) {
        const result = await client.query(`
          INSERT INTO order_sync (
            oracle_rowid,
            external_order_id,
            mchnt_ord_no,
            crm_order_no,
            order_type,
            plate_type,
            product_name,
            product_model,
            product_brand,
            product_category,
            product_category_code,
            pc_tp,
            invoice_no,
            invoice_date,
            invoice_amount,
            invoice_subsidy_amount,
            invoice_item_name,
            invoice_order_no,
            invoice_platform_order_no,
            invoice_remark,
            mchnt_no,
            mchnt_nm,
            mchnt_reg_dist,
            mchnt_reg_dist_code,
            goods_energy,
            goods_energy_grade,
            goods_color,
            goods_volume,
            product_unit,
            product_quantity,
            product_price,
            subsidy_amount,
            product_total_amount,
            imei1,
            imei2,
            delivery_type,
            delivery_address,
            delivery_no,
            signed_time,
            buyer_id_code,
            seller_id_code,
            seller_unit,
            extra_info,
            external_created_at,
            external_updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45)
          RETURNING *
        `, [
          parsed.oracle_rowid,
          parsed.external_order_id,
          parsed.mchnt_ord_no,
          parsed.crm_order_no,
          parsed.order_type,
          parsed.plate_type,
          parsed.product_name,
          parsed.product_model,
          parsed.product_brand,
          parsed.product_category,
          parsed.product_category_code,
          parsed.pc_tp,
          parsed.invoice_no,
          parsed.invoice_date,
          parsed.invoice_amount,
          parsed.invoice_subsidy_amount,
          parsed.invoice_item_name,
          parsed.invoice_order_no,
          parsed.invoice_platform_order_no,
          parsed.invoice_remark,
          parsed.mchnt_no,
          parsed.mchnt_nm,
          parsed.mchnt_reg_dist,
          parsed.mchnt_reg_dist_code,
          parsed.goods_energy,
          parsed.goods_energy_grade,
          parsed.goods_color,
          parsed.goods_volume,
          parsed.product_unit,
          parsed.product_quantity,
          parsed.product_price,
          parsed.subsidy_amount,
          parsed.product_total_amount,
          parsed.imei1,
          parsed.imei2,
          parsed.delivery_type,
          parsed.delivery_address,
          parsed.delivery_no,
          parsed.signed_time,
          parsed.buyer_id_code,
          parsed.seller_id_code,
          parsed.seller_unit,
          JSON.stringify(parsed.extra_info),
          parsed.external_created_at,
          parsed.external_updated_at,
        ]);

        logger.info(`创建订单同步记录: ${parsed.mchnt_ord_no}`);
        await client.query('COMMIT');
        return result.rows[0];

      } else {
        // 更新已有记录
        const existing = existingResult.rows[0];

        // 检查是否需要更新（对比 external_updated_at 或 状态为失败，或者强制更新）
        if (forceUpdate || parsed.external_updated_at > existing.external_updated_at || existing.sync_status === 'failed') {
          const result = await client.query(`
            UPDATE order_sync SET
              external_updated_at = $1,
              invoice_amount = $2,
              invoice_subsidy_amount = $3,
              delivery_no = $4,
              signed_time = $5,
              extra_info = $6,
              product_name = $7,
              product_brand = $8,
              product_model = $9,
              plate_type = $10,
              product_category = $11,
              product_category_code = $12,
              product_price = $13,
              product_total_amount = $14,
              subsidy_amount = $15,
              crm_order_no = $16,
              order_type = $17,
              sync_status = 'pending',
              updated_at = NOW()
            WHERE id = $18
            RETURNING *
          `, [
            parsed.external_updated_at,
            parsed.invoice_amount,
            parsed.invoice_subsidy_amount,
            parsed.delivery_no,
            parsed.signed_time,
            JSON.stringify(parsed.extra_info),
            parsed.product_name,
            parsed.product_brand,
            parsed.product_model,
            parsed.plate_type,
            parsed.product_category,
            parsed.product_category_code,
            parsed.product_price,
            parsed.product_total_amount,
            parsed.subsidy_amount,
            parsed.crm_order_no,
            parsed.order_type,
            existing.id,
          ]);

          logger.info(`更新订单同步记录: ${parsed.mchnt_ord_no}`);
          await client.query('COMMIT');
          return result.rows[0];
        } else {
          await client.query('ROLLBACK');
          return existing;
        }
      }
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('同步记录失败:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 创建业务订单
   */
  async createBusinessOrder(syncRecord) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // 检查是否已存在业务订单
      if (syncRecord.order_id) {
        logger.info(`业务订单已存在: ${syncRecord.mchnt_ord_no}, order_id=${syncRecord.order_id}，同步更新业务订单信息`);
        
        // 同步更新 orders 表的关键字段
        await client.query(`
          UPDATE orders
          SET plate_type = $1,
              product_name = $2,
              product_brand = $3,
              product_model = $4,
              product_category = $5,
              product_price = $6,
              subsidy_amount = $7,
              invoice_no = $8,
              invoice_amount = $9,
              invoice_date = $10,
              product_total_amount = $11,
              crm_order_no = $12,
              imei1 = $13,
              imei2 = $14,
              order_type = $15,
              updated_at = NOW()
          WHERE id = $16
        `, [
          syncRecord.plate_type,
          syncRecord.product_name,
          syncRecord.product_brand,
          syncRecord.product_model,
          syncRecord.product_category,
          syncRecord.product_price,
          syncRecord.subsidy_amount,
          syncRecord.invoice_no,
          syncRecord.invoice_amount,
          syncRecord.invoice_date,
          syncRecord.product_total_amount,
          syncRecord.crm_order_no,
          syncRecord.imei1,
          syncRecord.imei2,
          syncRecord.order_type,
          syncRecord.order_id
        ]);

        // 修复状态不一致：如果有 order_id 但状态不是 synced，修正为 synced
        await client.query(`
          UPDATE order_sync
          SET sync_status = 'synced',
              synced_at = NOW(),
              updated_at = NOW()
          WHERE id = $1
        `, [syncRecord.id]);

        await client.query('COMMIT');
        return syncRecord;
      }

      let orgId = null;
      // 从同步记录中解析 ven_code
      let venCode = null;
      let extra = syncRecord.extra_info;
      if (extra) {
        if (typeof extra === 'string') {
          try {
            extra = JSON.parse(extra);
          } catch (e) {
            extra = null;
          }
        }
        if (extra && (extra.VEN_CODE || extra.ven_code)) {
          venCode = extra.VEN_CODE || extra.ven_code;
        }
      }
      if (venCode) {
        const orgRes = await client.query(
          'SELECT id FROM organizations WHERE code = $1 LIMIT 1',
          [venCode]
        );
        if (orgRes.rows.length > 0) {
          orgId = orgRes.rows[0].id;
        }
      }

      // 创建业务订单（注意：organization_id 需要根据业务规则分配）
      const orderResult = await client.query(`
        INSERT INTO orders (
          sync_id,
          mchnt_ord_no,
          plate_type,
          product_name,
          product_model,
          product_brand,
          product_category,
          ven_code,
          organization_id,
          product_price,
          subsidy_amount,
          invoice_no,
          invoice_amount,
          invoice_date,
          crm_order_no,
          imei1,
          imei2,
          order_type,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'pending')
        RETURNING id
      `, [
        syncRecord.id,
        syncRecord.mchnt_ord_no,
        syncRecord.plate_type,
        syncRecord.product_name,
        syncRecord.product_model,
        syncRecord.product_brand,
        syncRecord.product_category,
        venCode,
        orgId,
        syncRecord.product_price,
        syncRecord.subsidy_amount,
        syncRecord.invoice_no,
        syncRecord.invoice_amount,
        syncRecord.invoice_date,
        syncRecord.crm_order_no,
        syncRecord.imei1,
        syncRecord.imei2,
        syncRecord.order_type
      ]);

      const orderId = orderResult.rows[0].id;

      // 更新 sync 表的 order_id 和状态
      await client.query(`
        UPDATE order_sync
        SET order_id = $1,
            sync_status = 'synced',
            synced_at = NOW(),
            updated_at = NOW()
        WHERE id = $2
      `, [orderId, syncRecord.id]);

      logger.info(`创建业务订单成功: ${syncRecord.mchnt_ord_no}, order_id=${orderId}`);
      await client.query('COMMIT');

      return { ...syncRecord, order_id: orderId };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('创建业务订单失败:', error);

      // 更新失败状态
      await db.query(`
        UPDATE order_sync
        SET sync_status = 'failed',
            sync_error = $1,
            sync_retry_count = sync_retry_count + 1,
            updated_at = NOW()
        WHERE id = $2
      `, [error.message, syncRecord.id]);

      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 处理待生成业务订单的记录
   */
  async processPendingOrders() {
    try {
      // 查询待处理的记录
      const result = await db.query(`
        SELECT *
        FROM order_sync
        WHERE sync_status = 'pending'
        LIMIT 1000
      `);

      if (result.rows.length > 0) {
        logger.info(`发现 ${result.rows.length} 条待生成订单记录，开始处理...`);
        let successCount = 0;
        let failCount = 0;

        for (const row of result.rows) {
          try {
            await this.createBusinessOrder(row);
            successCount++;
          } catch (error) {
            failCount++;
            // 错误已在 createBusinessOrder 中记录
          }
        }
        logger.info(`待生成订单处理完成: 成功=${successCount}, 失败=${failCount}`);
      }
    } catch (error) {
      logger.error('处理待生成订单失败:', error);
    }
  }

  /**
   * 批量同步数据
   */
  async runSync() {
    if (this.running) {
      logger.info('OrderSyncService 正在运行，跳过本次执行');
      return;
    }

    this.running = true;
    let totalSynced = 0;
    let totalFailed = 0;

    try {
      // 1. 处理 order_sync 表中积压的 pending 记录
      await this.processPendingOrders();

      // 2. 从 Oracle 中间表同步新数据
      const result = await db.query(`
        SELECT *
        FROM od_order_subsidy_sync
        ORDER BY modify_date DESC
        LIMIT 1000
      `);

      logger.info(`发现 ${result.rows.length} 条待同步记录`);

      for (const row of result.rows) {
        try {
          // 同步到 order_sync 表
          const syncRecord = await this.syncRecord(row);

          // 如果状态是 pending，创建业务订单
          if (syncRecord.sync_status === 'pending') {
            await this.createBusinessOrder(syncRecord);
          }

          totalSynced++;
        } catch (error) {
          totalFailed++;
          logger.error(`处理记录失败 (${row.oracle_rowid}):`, error.message);
        }
      }

      logger.info(`OrderSyncService 同步完成: 成功=${totalSynced}, 失败=${totalFailed}`);
    } catch (error) {
      logger.error('OrderSyncService 运行失败:', error);
    } finally {
      this.running = false;
    }
  }

  /**
   * 从 GOODS_ATTRIBUTE 解析产品品类编码 (plbm)
   */
  getPlbmFromAttr(data) {
    try {
      if (!data.GOODS_ATTRIBUTE) return null;
      const attr = typeof data.GOODS_ATTRIBUTE === 'string' 
        ? JSON.parse(data.GOODS_ATTRIBUTE) 
        : data.GOODS_ATTRIBUTE;
      return attr.plbm || null;
    } catch (e) {
      return null;
    }
  }

  /**
   * 从 GOODS_ATTRIBUTE 解析板块类型
   */
  getPlateTypeFromAttr(data) {
    try {
      if (!data.GOODS_ATTRIBUTE) return null;
      const attr = typeof data.GOODS_ATTRIBUTE === 'string' 
        ? JSON.parse(data.GOODS_ATTRIBUTE) 
        : data.GOODS_ATTRIBUTE;
      
      // 优先使用 plbm 判断
      const plbm = attr.plbm;
      if (plbm) {
        // 家电: A01-A06
        if (['A01', 'A02', 'A03', 'A04', 'A05', 'A06'].includes(plbm)) {
          return 'home_appliance';
        }
        // 3C数码: B01-B03
        if (['B01', 'B02', 'B03'].includes(plbm)) {
          return 'digital_3c';
        }
      }

      // xm: 项目/类型 (旧逻辑作为回退)
      const xm = attr.xm;
      if (!xm) return null;

      const mapping = {
        'jd': 'home_appliance',
        'jz': 'home_decoration',
        'sj': 'digital_3c',
        'sl': 'aging_adaptation',
        'slh': 'aging_adaptation'
      };
      return mapping[xm] || null;
    } catch (e) {
      return null;
    }
  }

  /**
   * 从 GOODS_ATTRIBUTE 解析产品名称
   */
  getProductNameFromAttr(data) {
    try {
      if (!data.GOODS_ATTRIBUTE) return '未命名商品';
      const attr = typeof data.GOODS_ATTRIBUTE === 'string' 
        ? JSON.parse(data.GOODS_ATTRIBUTE) 
        : data.GOODS_ATTRIBUTE;
      // pl: 品类
      return attr.pl || '未命名商品';
    } catch (e) {
      return '未命名商品';
    }
  }

  /**
   * 从 GOODS_ATTRIBUTE 解析产品型号
   */
  getProductModelFromAttr(data) {
    try {
      if (!data.GOODS_ATTRIBUTE) return null;
      const attr = typeof data.GOODS_ATTRIBUTE === 'string' 
        ? JSON.parse(data.GOODS_ATTRIBUTE) 
        : data.GOODS_ATTRIBUTE;
      // xh: 型号
      return attr.xh || null;
    } catch (e) {
      return null;
    }
  }

  /**
   * 从 GOODS_ATTRIBUTE 解析产品品牌
   */
  getProductBrandFromAttr(data) {
    try {
      if (!data.GOODS_ATTRIBUTE) return null;
      const attr = typeof data.GOODS_ATTRIBUTE === 'string' 
        ? JSON.parse(data.GOODS_ATTRIBUTE) 
        : data.GOODS_ATTRIBUTE;
      // pp: 品牌
      return attr.pp || null;
    } catch (e) {
      return null;
    }
  }

  /**
   * 启动定时同步任务
   */
  start(intervalSeconds = 60) {
    if (this.timer) {
      clearInterval(this.timer);
    }

    logger.info(`启动 OrderSyncService，同步间隔: ${intervalSeconds}秒`);

    // 立即执行一次
    this.runSync();

    // 定时执行
    this.timer = setInterval(() => {
      this.runSync();
    }, intervalSeconds * 1000);
  }

  /**
   * 停止同步服务
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('OrderSyncService 已停止');
    }
  }
}

// 导出单例
const orderSyncService = new OrderSyncService();

module.exports = orderSyncService;
