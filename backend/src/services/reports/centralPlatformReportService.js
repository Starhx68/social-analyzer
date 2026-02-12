/**
 * 中央平台上报服务
 * 功能：生成Excel文件并通过SFTP上传到中央平台
 * 接口文档：D:\Temp\guobu\政策文件\全国家电以旧换新对接标准1.7（含3C）.docx
 */

const ExcelJS = require('exceljs');
const SftpClient = require('ssh2-sftp-client');
const db = require('../../config/database');
const logger = require('../../config/logger');
const path = require('path');
const fs = require('fs');
const os = require('os');

class CentralPlatformReportService {
  constructor() {
    this.enabled = process.env.CENTRAL_PLATFORM_REPORT_ENABLED === 'true';
    this.sftpConfig = {
      host: process.env.CENTRAL_PLATFORM_SFTP_HOST,
      port: parseInt(process.env.CENTRAL_PLATFORM_SFTP_PORT || '22'),
      username: process.env.CENTRAL_PLATFORM_SFTP_USERNAME,
      password: process.env.CENTRAL_PLATFORM_SFTP_PASSWORD,
      privateKeyPath: process.env.CENTRAL_PLATFORM_SFTP_PRIVATE_KEY_PATH
    };
    this.remotePath = process.env.CENTRAL_PLATFORM_REMOTE_PATH || '/upload';
    this.reportTime = process.env.CENTRAL_PLATFORM_REPORT_TIME || '02:00'; // 默认凌晨2点执行
    this.timer = null;
  }

  /**
   * 获取需要上报的订单列表
   */
  async getOrdersToReport() {
    try {
      // 获取所有已同步且需要上报的订单（新增或更新过的）
      const result = await db.query(`
        SELECT
          os.mchnt_ord_no,
          os.plate_type,
          os.product_name,
          os.product_model,
          os.product_brand,
          os.product_category,
          os.product_category_code,
          os.product_unit,
          os.product_quantity,
          os.product_price,
          os.subsidy_amount,
          os.product_total_amount,
          os.invoice_no,
          os.invoice_date,
          os.invoice_amount,
          os.invoice_subsidy_amount,
          os.invoice_item_name,
          os.mchnt_no,
          os.mchnt_nm,
          os.mchnt_reg_dist,
          os.mchnt_reg_dist_code,
          os.goods_energy,
          os.goods_energy_grade,
          os.imei1,
          os.imei2,
          os.delivery_type,
          os.delivery_address,
          os.delivery_no,
          os.signed_time,
          os.buyer_id_code,
          os.seller_id_code,
          os.seller_unit,
          os.external_created_at,
          os.external_updated_at,
          o.id as order_id,
          o.status as order_status,
          org.name as organization_name,
          org.code as organization_code
        FROM order_sync os
        INNER JOIN orders o ON os.order_id = o.id
        LEFT JOIN organizations org ON o.organization_id = org.id
        WHERE os.sync_status = 'synced'
          AND (
              os.report_central_status = 'pending'
              OR os.external_updated_at > COALESCE(o.last_report_central_at, '1970-01-01'::timestamp)
          )
        ORDER BY os.external_created_at ASC
      `);

      return result.rows;
    } catch (error) {
      logger.error('获取中央平台待上报订单失败:', error);
      throw error;
    }
  }

  /**
   * 生成Excel文件
   */
  async generateExcel(orders) {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('订单数据');

      // 定义表头
      worksheet.columns = [
        { header: '商户订单号', key: 'mchnt_ord_no', width: 20 },
        { header: '板块类型', key: 'plate_type', width: 15 },
        { header: '产品名称', key: 'product_name', width: 30 },
        { header: '产品型号', key: 'product_model', width: 20 },
        { header: '产品品牌', key: 'product_brand', width: 20 },
        { header: '产品品类', key: 'product_category', width: 20 },
        { header: '品类编码', key: 'product_category_code', width: 15 },
        { header: '单位', key: 'product_unit', width: 10 },
        { header: '数量', key: 'product_quantity', width: 10 },
        { header: '单价(元)', key: 'product_price', width: 15 },
        { header: '补贴金额(元)', key: 'subsidy_amount', width: 15 },
        { header: '总金额(元)', key: 'product_total_amount', width: 15 },
        { header: '发票号码', key: 'invoice_no', width: 20 },
        { header: '发票日期', key: 'invoice_date', width: 15 },
        { header: '发票金额(元)', key: 'invoice_amount', width: 15 },
        { header: '发票补贴金额(元)', key: 'invoice_subsidy_amount', width: 18 },
        { header: '发票商品名称', key: 'invoice_item_name', width: 30 },
        { header: '商户编码', key: 'mchnt_no', width: 20 },
        { header: '商户名称', key: 'mchnt_nm', width: 30 },
        { header: '商户注册地区', key: 'mchnt_reg_dist', width: 20 },
        { header: '商户注册地区编码', key: 'mchnt_reg_dist_code', width: 20 },
        { header: '能效等级', key: 'goods_energy', width: 15 },
        { header: 'IMEI1', key: 'imei1', width: 20 },
        { header: 'IMEI2', key: 'imei2', width: 20 },
        { header: '配送方式', key: 'delivery_type', width: 15 },
        { header: '配送地址', key: 'delivery_address', width: 40 },
        { header: '物流单号', key: 'delivery_no', width: 20 },
        { header: '签收时间', key: 'signed_time', width: 20 },
        { header: '买方身份证号', key: 'buyer_id_code', width: 20 },
        { header: '卖方身份证号', key: 'seller_id_code', width: 20 },
        { header: '卖方单位', key: 'seller_unit', width: 30 },
        { header: '单位名称', key: 'organization_name', width: 30 },
        { header: '单位编码', key: 'organization_code', width: 20 },
        { header: '订单创建时间', key: 'external_created_at', width: 20 },
        { header: '订单更新时间', key: 'external_updated_at', width: 20 }
      ];

      // 设置表头样式
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6E6FA' }
      };

      // 映射板块类型
      const plateTypeMapping = {
        'home_appliance': '家电',
        'digital_3c': '3C',
        'home_decoration': '家装',
        'aging_adaptation': '适老化'
      };

      // 填充数据
      orders.forEach(order => {
        worksheet.addRow({
          mchnt_ord_no: order.mchnt_ord_no,
          plate_type: plateTypeMapping[order.plate_type] || order.plate_type,
          product_name: order.product_name,
          product_model: order.product_model,
          product_brand: order.product_brand,
          product_category: order.product_category,
          product_category_code: order.product_category_code,
          product_unit: order.product_unit,
          product_quantity: order.product_quantity,
          product_price: order.product_price,
          subsidy_amount: order.subsidy_amount,
          product_total_amount: order.product_total_amount,
          invoice_no: order.invoice_no,
          invoice_date: order.invoice_date ? new Date(order.invoice_date).toLocaleDateString('zh-CN') : '',
          invoice_amount: order.invoice_amount,
          invoice_subsidy_amount: order.invoice_subsidy_amount,
          invoice_item_name: order.invoice_item_name,
          mchnt_no: order.mchnt_no,
          mchnt_nm: order.mchnt_nm,
          mchnt_reg_dist: order.mchnt_reg_dist,
          mchnt_reg_dist_code: order.mchnt_reg_dist_code,
          goods_energy: order.goods_energy,
          imei1: order.imei1,
          imei2: order.imei2,
          delivery_type: order.delivery_type,
          delivery_address: order.delivery_address,
          delivery_no: order.delivery_no,
          signed_time: order.signed_time ? new Date(order.signed_time).toLocaleString('zh-CN') : '',
          buyer_id_code: order.buyer_id_code,
          seller_id_code: order.seller_id_code,
          seller_unit: order.seller_unit,
          organization_name: order.organization_name,
          organization_code: order.organization_code,
          external_created_at: order.external_created_at ? new Date(order.external_created_at).toLocaleString('zh-CN') : '',
          external_updated_at: order.external_updated_at ? new Date(order.external_updated_at).toLocaleString('zh-CN') : ''
        });
      });

      // 生成临时文件
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `中央平台订单上报_${timestamp}.xlsx`;
      const tempFilePath = path.join(os.tmpdir(), filename);

      await workbook.xlsx.writeFile(tempFilePath);
      logger.info(`Excel文件生成成功: ${tempFilePath}`);

      return { filePath: tempFilePath, filename };
    } catch (error) {
      logger.error('生成Excel文件失败:', error);
      throw error;
    }
  }

  /**
   * 通过SFTP上传文件
   */
  async uploadViaSFTP(localFilePath, remoteFileName) {
    if (!this.enabled) {
      logger.info('中央平台上报功能未启用');
      return;
    }

    if (!this.sftpConfig.host) {
      throw new Error('SFTP配置不完整');
    }

    const sftp = new SftpClient();

    try {
      logger.info(`开始SFTP上传: ${localFilePath} -> ${this.remotePath}/${remoteFileName}`);

      await sftp.connect({
        host: this.sftpConfig.host,
        port: this.sftpConfig.port,
        username: this.sftpConfig.username,
        password: this.sftpConfig.password,
        privateKey: this.sftpConfig.privateKeyPath ? fs.readFileSync(this.sftpConfig.privateKeyPath) : undefined
      });

      // 确保远程目录存在
      try {
        await sftp.mkdir(this.remotePath, true);
      } catch (error) {
        // 目录可能已存在，忽略错误
      }

      const remoteFilePath = `${this.remotePath}/${remoteFileName}`;
      await sftp.fastPut(localFilePath, remoteFilePath);

      logger.info(`SFTP上传成功: ${remoteFilePath}`);

      await sftp.end();
      return true;
    } catch (error) {
      logger.error('SFTP上传失败:', error);
      await sftp.end();
      throw error;
    }
  }

  /**
   * 更新上报状态
   */
  async updateReportStatus(mchntOrdNos, status, errorMsg = null) {
    try {
      await db.query(`
        UPDATE order_sync
        SET report_central_status = $1,
            sync_error = $2,
            updated_at = NOW()
        WHERE mchnt_ord_no = ANY($3)
      `, [status, errorMsg, mchntOrdNos]);

      // 如果上报成功，更新订单表的上报时间
      if (status === 'success') {
        await db.query(`
          UPDATE orders
          SET last_report_central_at = NOW()
          WHERE sync_id IN (
            SELECT id FROM order_sync WHERE mchnt_ord_no = ANY($1)
          )
        `, [mchntOrdNos]);
      }
    } catch (error) {
      logger.error('更新上报状态失败:', error);
    }
  }

  /**
   * 记录上报日志
   */
  async logReport(mchntOrdNos, filename, status, errorMsg = null) {
    try {
      const orders = await db.query(`
        SELECT id FROM orders WHERE sync_id IN (
          SELECT id FROM order_sync WHERE mchnt_ord_no = ANY($1)
        )
      `, [mchntOrdNos]);

      for (const row of orders.rows) {
        await db.query(`
          INSERT INTO report_logs (
            order_id,
            platform,
            status,
            request_data,
            error_message,
            created_at
          ) VALUES ($1, 'central', $2, $3, $4, NOW())
        `, [row.id, status, JSON.stringify({ filename }), errorMsg]);
      }
    } catch (error) {
      logger.error('记录上报日志失败:', error);
    }
  }

  /**
   * 执行上报
   */
  async runReport() {
    if (!this.enabled) {
      logger.info('中央平台上报功能未启用');
      return;
    }

    let tempFilePath = null;

    try {
      const orders = await this.getOrdersToReport();

      if (orders.length === 0) {
        logger.info('没有需要上报到中央平台的订单');
        return;
      }

      logger.info(`开始上报 ${orders.length} 条订单到中央平台`);

      // 生成Excel文件
      const { filePath, filename } = await this.generateExcel(orders);
      tempFilePath = filePath;

      // 上传SFTP
      await this.uploadViaSFTP(filePath, filename);

      // 更新状态
      const mchntOrdNos = orders.map(o => o.mchnt_ord_no);
      await this.updateReportStatus(mchntOrdNos, 'success');
      await this.logReport(mchntOrdNos, filename, 'success');

      logger.info(`中央平台上报完成: ${orders.length} 条订单, 文件名: ${filename}`);
    } catch (error) {
      logger.error('中央平台上报失败:', error);

      // 失败时更新状态
      try {
        const orders = await this.getOrdersToReport();
        const mchntOrdNos = orders.map(o => o.mchnt_ord_no);
        await this.updateReportStatus(mchntOrdNos, 'failed', error.message);
        await this.logReport(mchntOrdNos, null, 'failed', error.message);
      } catch (logError) {
        logger.error('更新失败状态时出错:', logError);
      }
    } finally {
      // 清理临时文件
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          logger.info(`临时文件已删除: ${tempFilePath}`);
        } catch (error) {
          logger.error('删除临时文件失败:', error);
        }
      }
    }
  }

  /**
   * 计算下一次执行时间
   */
  getNextRunTime() {
    const [hour, minute] = this.reportTime.split(':').map(Number);
    const now = new Date();
    const next = new Date();

    next.setHours(hour, minute, 0, 0);

    // 如果今天的时间已过，设置为明天
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    return next;
  }

  /**
   * 启动定时上报任务
   */
  start() {
    if (this.timer) {
      clearTimeout(this.timer);
    }

    const scheduleNextRun = () => {
      const nextRunTime = this.getNextRunTime();
      const delay = nextRunTime.getTime() - Date.now();

      logger.info(`中央平台上报服务已启动，下次执行时间: ${nextRunTime.toLocaleString('zh-CN')}`);

      this.timer = setTimeout(() => {
        this.runReport();
        scheduleNextRun(); // 递归调度下一次执行
      }, delay);
    };

    scheduleNextRun();
  }

  /**
   * 停止上报服务
   */
  stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      logger.info('中央平台上报服务已停止');
    }
  }

  /**
   * 手动触发上报（用于测试）
   */
  async manualReport() {
    logger.info('手动触发中央平台上报');
    await this.runReport();
  }
}

// 导出单例
const centralPlatformReportService = new CentralPlatformReportService();

module.exports = centralPlatformReportService;
