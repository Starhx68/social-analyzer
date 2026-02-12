/**
 * 国补审核系统上报服务
 * 功能：将订单数据上报到湖南省以旧换新企业垫资审核系统
 * 接口文档：D:\Temp\guobu\政策文件\湖南以旧换新企业垫资审核系统数据完善接口文档V1.2
 */

const axios = require('axios');
const db = require('../../config/database');
const logger = require('../../config/logger');

class NationalAuditReportService {
  constructor() {
    this.enabled = process.env.NATIONAL_AUDIT_REPORT_ENABLED === 'true';
    this.apiUrl = process.env.NATIONAL_AUDIT_API_URL;
    this.apiKey = process.env.NATIONAL_AUDIT_API_KEY;
    this.reportInterval = parseInt(process.env.NATIONAL_AUDIT_REPORT_INTERVAL || '300'); // 默认5分钟
    this.timer = null;
  }

  /**
   * 获取需要上报的订单列表
   */
  async getOrdersToReport() {
    try {
      const result = await db.query(`
        SELECT
          os.id as sync_id,
          os.mchnt_ord_no,
          os.plate_type,
          os.product_name,
          os.product_model,
          os.product_brand,
          os.product_category,
          os.product_category_code,
          os.invoice_no,
          os.invoice_date,
          os.invoice_amount,
          os.invoice_subsidy_amount,
          os.mchnt_no,
          os.mchnt_nm,
          os.imei1,
          os.imei2,
          os.goods_energy,
          os.external_created_at,
          os.external_updated_at,
          o.id as order_id,
          o.status as order_status,
          org.name as organization_name,
          org.code as organization_code,
          m.file_url as sn_image_url,
          m2.file_url as install_image_url
        FROM order_sync os
        INNER JOIN orders o ON os.order_id = o.id
        LEFT JOIN organizations org ON o.organization_id = org.id
        LEFT JOIN materials m ON o.id = m.order_id AND m.material_type = 'sn_photo'
        LEFT JOIN materials m2 ON o.id = m2.order_id AND m2.material_type = 'install_photo'
        WHERE os.sync_status = 'synced'
          AND os.report_national_status IN ('pending', 'failed')
        ORDER BY os.external_updated_at ASC
        LIMIT 100
      `);

      return result.rows;
    } catch (error) {
      logger.error('获取待上报订单失败:', error);
      throw error;
    }
  }

  /**
   * 组装上报数据
   */
  buildReportData(order) {
    // 映射板块类型
    const plateTypeMapping = {
      'home_appliance': '家电',
      'digital_3c': '3C',
      'home_decoration': '家装',
      'aging_adaptation': '适老化'
    };

    const reportData = {
      // 基础信息
      mchnt_ord_no: order.mchnt_ord_no,
      plate_type: plateTypeMapping[order.plate_type] || order.plate_type,
      product_name: order.product_name,
      product_model: order.product_model,
      product_brand: order.product_brand,
      product_category: order.product_category,

      // 发票信息
      invoice_no: order.invoice_no,
      invoice_date: order.invoice_date,
      invoice_amount: order.invoice_amount,
      subsidy_amount: order.invoice_subsidy_amount,

      // 商户信息
      mchnt_no: order.mchnt_no,
      mchnt_nm: order.mchnt_nm,

      // 单位信息
      organization_code: order.organization_code,
      organization_name: order.organization_name,

      // 上报时间
      report_time: new Date().toISOString(),

      // 订单状态
      order_status: order.order_status,

      // 图片链接
      images: {
        sn_photo: order.sn_image_url,
        install_photo: order.install_image_url
      }
    };

    // 3C品类特殊字段
    if (order.plate_type === 'digital_3c') {
      reportData.imei1 = order.imei1;
      reportData.imei2 = order.imei2;
    }

    // 家电品类特殊字段
    if (order.plate_type === 'home_appliance') {
      reportData.goods_energy = order.goods_energy;
    }

    return reportData;
  }

  /**
   * 上报单个订单
   */
  async reportOrder(order) {
    if (!this.enabled) {
      logger.info('国补审核系统上报功能未启用');
      return;
    }

    if (!this.apiUrl || !this.apiKey) {
      logger.error('国补审核系统API配置不完整');
      await this.updateReportStatus(order.sync_id, 'failed', 'API配置不完整');
      return;
    }

    try {
      const reportData = this.buildReportData(order);

      logger.info(`上报订单到国补审核系统: ${order.mchnt_ord_no}`);

      const response = await axios.post(
        `${this.apiUrl}/api/report/order`,
        reportData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'X-API-Key': this.apiKey
          },
          timeout: 30000 // 30秒超时
        }
      );

      if (response.data.code === 200 || response.data.success === true) {
        logger.info(`订单上报成功: ${order.mchnt_ord_no}`);
        await this.updateReportStatus(order.sync_id, 'success', null);
        await this.logReport(order.sync_id, order.mchnt_ord_no, reportData, response.data, 'success');
      } else {
        const errorMsg = response.data.message || response.data.msg || '上报失败';
        logger.error(`订单上报失败: ${order.mchnt_ord_no}, 错误: ${errorMsg}`);
        await this.updateReportStatus(order.sync_id, 'failed', errorMsg);
        await this.logReport(order.sync_id, order.mchnt_ord_no, reportData, response.data, 'failed', errorMsg);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message || '网络请求失败';
      logger.error(`上报订单异常 (${order.mchnt_ord_no}):`, errorMsg);
      await this.updateReportStatus(order.sync_id, 'failed', errorMsg);
      await this.logReport(order.sync_id, order.mchnt_ord_no, null, null, 'failed', errorMsg);
    }
  }

  /**
   * 更新上报状态
   */
  async updateReportStatus(syncId, status, errorMsg) {
    try {
      await db.query(`
        UPDATE order_sync
        SET report_national_status = $1,
            sync_error = $2,
            updated_at = NOW()
        WHERE id = $3
      `, [status, errorMsg, syncId]);

      // 如果上报成功，更新订单表的上报时间
      if (status === 'success') {
        await db.query(`
          UPDATE orders
          SET last_report_national_at = NOW()
          WHERE sync_id = $1
        `, [syncId]);
      }
    } catch (error) {
      logger.error('更新上报状态失败:', error);
    }
  }

  /**
   * 记录上报日志
   */
  async logReport(syncId, mchntOrdNo, requestData, responseData, status, errorMsg = null) {
    try {
      await db.query(`
        INSERT INTO report_logs (
          order_id,
          platform,
          status,
          request_data,
          response_data,
          error_message,
          created_at
        ) VALUES (
          (SELECT id FROM orders WHERE sync_id = $1),
          'national',
          $2,
          $3,
          $4,
          $5,
          NOW()
        )
      `, [syncId, status, JSON.stringify(requestData), JSON.stringify(responseData), errorMsg]);
    } catch (error) {
      logger.error('记录上报日志失败:', error);
    }
  }

  /**
   * 批量上报
   */
  async runReport() {
    if (!this.enabled) {
      logger.info('国补审核系统上报功能未启用');
      return;
    }

    try {
      const orders = await this.getOrdersToReport();

      if (orders.length === 0) {
        logger.info('没有需要上报到国补审核系统的订单');
        return;
      }

      logger.info(`开始上报 ${orders.length} 条订单到国补审核系统`);

      let successCount = 0;
      let failCount = 0;

      for (const order of orders) {
        await this.reportOrder(order);

        if (order.report_national_status === 'success') {
          successCount++;
        } else {
          failCount++;
        }

        // 避免请求过于频繁
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      logger.info(`国补审核系统上报完成: 成功=${successCount}, 失败=${failCount}`);
    } catch (error) {
      logger.error('国补审核系统上报失败:', error);
    }
  }

  /**
   * 启动定时上报任务
   */
  start() {
    if (this.timer) {
      clearInterval(this.timer);
    }

    logger.info(`启动国补审核系统上报服务，上报间隔: ${this.reportInterval}秒`);

    // 立即执行一次
    this.runReport();

    // 定时执行
    this.timer = setInterval(() => {
      this.runReport();
    }, this.reportInterval * 1000);
  }

  /**
   * 停止上报服务
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('国补审核系统上报服务已停止');
    }
  }

  /**
   * 手动触发上报（用于测试）
   */
  async manualReport(orderId) {
    try {
      const result = await db.query(`
        SELECT
          os.id as sync_id,
          os.mchnt_ord_no,
          os.plate_type,
          os.product_name,
          os.product_model,
          os.product_brand,
          os.product_category,
          os.product_category_code,
          os.invoice_no,
          os.invoice_date,
          os.invoice_amount,
          os.invoice_subsidy_amount,
          os.mchnt_no,
          os.mchnt_nm,
          os.imei1,
          os.imei2,
          os.goods_energy,
          os.external_created_at,
          os.external_updated_at,
          o.id as order_id,
          o.status as order_status,
          org.name as organization_name,
          org.code as organization_code
        FROM orders o
        INNER JOIN order_sync os ON o.sync_id = os.id
        LEFT JOIN organizations org ON o.organization_id = org.id
        WHERE o.id = $1
      `, [orderId]);

      if (result.rows.length === 0) {
        throw new Error('订单不存在');
      }

      const order = result.rows[0];
      await this.reportOrder(order);

      return { success: true, message: '上报成功' };
    } catch (error) {
      logger.error('手动上报失败:', error);
      throw error;
    }
  }
}

// 导出单例
const nationalAuditReportService = new NationalAuditReportService();

module.exports = nationalAuditReportService;
