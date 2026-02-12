const db = require('../config/database');
const WebServiceUtils = require('../utils/webService');
const logger = require('../config/logger');
const schedule = require('node-schedule');
const axios = require('axios');
const Minio = require('minio');
const config = require('../config');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

const minioClient = new Minio.Client({
  endPoint: config.minio.endpoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey
});

class ExternalInterfaceService {
  
  /**
   * Helper function for SiliconFlow OCR
   */
  static async callSiliconFlowOCR(imageBase64, prompt) {
    if (!config.ocr.siliconFlow.apiKey) {
      throw new Error('未配置 SiliconFlow API Key');
    }

    const response = await axios.post(
      `${config.ocr.siliconFlow.baseUrl}/chat/completions`,
      {
        model: config.ocr.siliconFlow.model,
        messages: [
          {
            "role": "user",
            "content": [
              {
                "type": "image_url",
                "image_url": {
                  "url": imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`
                }
              },
              {
                "type": "text",
                "text": prompt
              }
            ]
          }
        ],
        max_tokens: 4096
      },
      {
        headers: {
          'Authorization': `Bearer ${config.ocr.siliconFlow.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    return response.data.choices[0].message.content;
  }

  /**
   * Helper function for SiliconFlow Text LLM
   */
  static async callSiliconFlowTextLLM(text, prompt) {
    if (!config.ocr.siliconFlow.apiKey) {
      throw new Error('未配置 SiliconFlow API Key');
    }

    const response = await axios.post(
      `${config.ocr.siliconFlow.baseUrl}/chat/completions`,
      {
        model: config.ocr.siliconFlow.textModel,
        messages: [
          {
            "role": "user",
            "content": `${prompt}\n\n待处理文本:\n${text}`
          }
        ],
        max_tokens: 1024
      },
      {
        headers: {
          'Authorization': `Bearer ${config.ocr.siliconFlow.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    return response.data.choices[0].message.content;
  }

  /**
   * 根据手机号查询订单 (HG800025)
   * @param {string} mobile 手机号
   */
  static async queryOrderByMobile(mobile) {
    try {
      logger.info(`Querying order by mobile: ${mobile}`);

      const response = await WebServiceUtils.queryOrder(mobile);
      const result = response.parsed.Program;
      
      let status = 'failure';
      let errorMessage = null;
      let orders = [];

      // Check ErrorNo (1 means success based on example)
      if (result.ErrorNo === '1') {
        status = 'success';
        
        if (result.result_info) {
            const rows = [];
            // Iterate over all keys in result_info that start with 'row'
            Object.keys(result.result_info).forEach(key => {
                if (key.toLowerCase().startsWith('row')) {
                    const rowData = result.result_info[key];
                    if (Array.isArray(rowData)) {
                        rows.push(...rowData);
                    } else {
                        rows.push(rowData);
                    }
                }
            });
            
            orders = rows.map(r => ({
                order_no: r.order_no,
                crm_order_no: r.crm_order_no
            }));
        }
      } else {
        errorMessage = result.ErrorMessage || 'Unknown error';
        logger.warn(`Query order by mobile failed: ${errorMessage}`);
      }

      // Log
      await this.logInterfaceCall({
          interface_type: 'query_order_by_mobile',
          request_params: response.requestXml,
          response_data: response.raw,
          status: status,
          error_message: errorMessage
      });

      if (status === 'failure') {
          throw new Error(errorMessage);
      }

      return orders;

    } catch (error) {
      logger.error(`Error in queryOrderByMobile for mobile ${mobile}:`, error);
      
      // 避免在 WebServiceUtils 抛出错误时重复记录日志（如果需要更精细的控制，可以检查是否是 WebServiceUtils 抛出的）
      // 这里简单起见，统一记录异常
      try {
        await this.logInterfaceCall({
            interface_type: 'query_order_by_mobile',
            request_params: `mobile=${mobile}`,
            response_data: '',
            status: 'failure',
            error_message: error.message
        });
      } catch (logError) {
        console.error('Failed to log error:', logError);
      }
      
      throw error;
    }
  }

  /**
   * 记录接口调用日志
   */
  static async logInterfaceCall(logData) {
    const {
      interface_type,
      order_id,
      crm_order_no,
      request_params,
      response_data,
      status,
      error_message,
      retry_count = 0,
      next_retry_time = null
    } = logData;

    const query = `
      INSERT INTO interface_logs (
        interface_type, order_id, crm_order_no, request_params, response_data, 
        status, error_message, retry_count, next_retry_time
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `;

    try {
      const result = await db.query(query, [
        interface_type, order_id, crm_order_no, request_params, response_data,
        status, error_message, retry_count, next_retry_time
      ]);
      return result.rows[0].id;
    } catch (error) {
      logger.error('Failed to log interface call:', error);
      // 日志记录失败不应阻断业务流程，但需要记录错误
    }
  }

  /**
   * 调用更新 SN 接口
   * @param {string} orderId 订单ID
   */
  static async callUpdateSn(orderId) {
    let order;
    try {
      // 1. 获取订单信息
      const orderResult = await db.query(
        `SELECT id, crm_order_no, sn_code, imei1, imei2 
         FROM orders WHERE id = $1`,
        [orderId]
      );
      
      if (orderResult.rows.length === 0) {
        throw new Error(`Order not found: ${orderId}`);
      }
      order = orderResult.rows[0];

      if (!order.crm_order_no) {
        throw new Error(`Order ${orderId} missing crm_order_no`);
      }

      // 2. 调用 WebService
      const params = {
        crmOrderNo: order.crm_order_no,
        sn: order.sn_code,
        imei1: order.imei1,
        imei2: order.imei2
      };

      const response = await WebServiceUtils.updateSn(params);
      const result = response.parsed.Program;
      const flag = result.parameters?.flag;

      // 3. 处理响应
      let status = 'failure';
      let errorMessage = null;

      if (flag === 'success') {
        status = 'success';
        logger.info(`Update SN success for order ${order.crm_order_no}`);
        
        // 成功后，安排 1 小时后获取发票
        this.scheduleGetInvoice(orderId, order.crm_order_no);
      } else {
        errorMessage = result.ErrorMessage || result.return_info?.row1?.rtn_msg || 'Unknown error';
        logger.warn(`Update SN failed for order ${order.crm_order_no}: ${errorMessage}`);
      }

      // 4. 记录日志
      await this.logInterfaceCall({
        interface_type: 'update_sn',
        order_id: order.id,
        crm_order_no: order.crm_order_no,
        request_params: response.requestXml,
        response_data: response.raw,
        status: status,
        error_message: errorMessage
      });

      return { success: status === 'success', message: errorMessage };

    } catch (error) {
      logger.error(`Error in callUpdateSn for order ${orderId}:`, error);
      
      // 记录异常日志
      if (order) {
        await this.logInterfaceCall({
          interface_type: 'update_sn',
          order_id: order.id,
          crm_order_no: order.crm_order_no,
          request_params: '',
          response_data: '',
          status: 'failure',
          error_message: error.message
        });
      }
      throw error;
    }
  }

  /**
   * 调度获取发票任务
   * @param {string} orderId 
   * @param {string} crmOrderNo 
   * @param {number} delayHours 延迟小时数，默认 1
   */
  static scheduleGetInvoice(orderId, crmOrderNo, delayHours = 1) {
    const fireDate = new Date(Date.now() + delayHours * 60 * 60 * 1000);
    // const fireDate = new Date(Date.now() + 10 * 1000); // 测试用：10秒后

    logger.info(`Scheduling getInvoice for order ${crmOrderNo} at ${fireDate}`);

    schedule.scheduleJob(fireDate, async () => {
      await this.callGetInvoice(orderId, crmOrderNo);
    });
    
    // 同时更新日志表中的下次重试时间（如果是重试逻辑）
    // 这里简化处理，调度任务主要在内存中，重启会丢失。
    // 生产环境建议使用持久化的任务队列 (如 Bull, Agenda) 或数据库轮询。
    // 鉴于当前架构，我们可以在数据库中记录 next_retry_time，并有一个定时任务轮询 pending 状态的任务。
  }

  /**
   * 调用获取发票接口
   * @param {string} orderId 
   * @param {string} crmOrderNo 
   */
  static async callGetInvoice(orderId, crmOrderNo) {
    try {
      logger.info(`Starting getInvoice for order ${crmOrderNo}`);

      // 1. 调用接口
      const response = await WebServiceUtils.getInvoice(crmOrderNo);
      const result = response.parsed.Program;
      const invoiceList = result.invoice_list?.row1;

      // 2. 判断结果
      if (invoiceList && invoiceList.order_no) {
        // 成功获取发票
        logger.info(`Get Invoice success for order ${crmOrderNo}`);
        
        // 2.1 保存发票信息
        let invoiceUrl = invoiceList.imgurl;
        if (invoiceUrl) {
          try {
            logger.info(`Downloading invoice image from ${invoiceUrl}`);
            
            // 2.1.1 下载图片
            const imgResponse = await axios.get(invoiceUrl, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(imgResponse.data);
            
            // 2.1.2 上传到 MinIO
            const fileName = `invoice_${crmOrderNo}_${uuidv4()}.jpg`;
            await minioClient.putObject(config.minio.bucket, fileName, buffer);
            
            // 生成 MinIO URL (假设是公开读或生成预签名 URL，这里简化为直接拼接)
            // 注意：生产环境应使用 presigned URL 或配置 Nginx 反向代理
            // 这里我们构造一个前端可访问的路径
            const fileUrl = `${config.minio.useSSL ? 'https' : 'http'}://${config.minio.endpoint}:${config.minio.port}/${config.minio.bucket}/${fileName}`;
            
            // 2.1.3 保存到 materials 表
            // 先检查是否已存在
            const existMaterial = await db.query(
                `SELECT id FROM materials WHERE order_id = $1 AND material_type = 'invoice'`,
                [orderId]
            );
            
            if (existMaterial.rows.length === 0) {
                 await db.query(
                    `INSERT INTO materials (order_id, material_type, file_url, file_name, file_size, mime_type)
                     VALUES ($1, 'invoice', $2, $3, $4, 'image/jpeg')`,
                    [orderId, fileUrl, `invoice_${crmOrderNo}.jpg`, buffer.length]
                );
            } else {
                 await db.query(
                    `UPDATE materials SET file_url = $2 WHERE id = $1`,
                    [existMaterial.rows[0].id, fileUrl]
                 );
            }
            
            // 2.1.4 执行 OCR 识别
            if (config.ocr.serviceProvider === 'siliconflow') {
                const base64 = buffer.toString('base64');
                const rawOcrText = await this.callSiliconFlowOCR(base64, '请识别图片中的所有文字，按阅读顺序输出。');
                
                // 提取发票关键信息 (代码、号码、日期、校验码、金额、抬头、备注)
                const invoiceInfoJson = await this.callSiliconFlowTextLLM(rawOcrText, `
                    请从上述OCR识别结果中提取增值税发票的关键信息。
                    需要提取的字段：
                    1. invoice_code (发票代码)
                    2. invoice_no (发票号码)
                    3. invoice_date (开票日期，格式 YYYY-MM-DD)
                    4. invoice_amount (价税合计，纯数字)
                    5. invoice_check_code (校验码，后6位)
                    6. invoice_title (购买方名称)
                    7. invoice_remark (备注，提取备注栏内的所有内容，包括换行符，不要遗漏)
                    
                    请返回纯 JSON 格式，不要包含 Markdown 标记。如果某个字段未找到，设为 null。
                `);
                
                try {
                    const cleanedJson = invoiceInfoJson.replace(/```json/g, '').replace(/```/g, '').trim();
                    const invoiceData = JSON.parse(cleanedJson);
                    
                    // 更新订单表中的发票信息
                    // 动态构建更新语句 (仅更新非空值)
                    const updateFields = [];
                    const updateValues = [];
                    let paramIdx = 1;
                    
                    if (invoiceData.invoice_code) {
                        updateFields.push(`invoice_code = $${paramIdx++}`);
                        updateValues.push(invoiceData.invoice_code);
                    }
                    if (invoiceData.invoice_no) {
                        updateFields.push(`invoice_no = $${paramIdx++}`);
                        updateValues.push(invoiceData.invoice_no);
                    }
                    if (invoiceData.invoice_date) {
                        updateFields.push(`invoice_date = $${paramIdx++}`);
                        updateValues.push(invoiceData.invoice_date);
                    }
                    
                    if (invoiceData.invoice_amount) {
                        updateFields.push(`invoice_amount = $${paramIdx++}`);
                        updateValues.push(invoiceData.invoice_amount);
                    }
                    
                    if (invoiceData.invoice_check_code) {
                        updateFields.push(`invoice_check_code = $${paramIdx++}`);
                        updateValues.push(invoiceData.invoice_check_code);
                    }

                    if (invoiceData.invoice_title) {
                        updateFields.push(`invoice_title = $${paramIdx++}`);
                        updateValues.push(invoiceData.invoice_title);
                    }

                    if (invoiceData.invoice_remark) {
                        updateFields.push(`invoice_remark = $${paramIdx++}`);
                        updateValues.push(invoiceData.invoice_remark);
                    }
                    
                    if (updateFields.length > 0) {
                        updateValues.push(orderId);
                        await db.query(
                            `UPDATE orders SET ${updateFields.join(', ')} WHERE id = $${paramIdx}`,
                            updateValues
                        );
                        logger.info(`Updated invoice info for order ${crmOrderNo}: ${JSON.stringify(invoiceData)}`);
                    }
                    
                } catch (parseError) {
                    logger.error(`Failed to parse invoice OCR result for ${crmOrderNo}:`, parseError);
                }
            }
            
          } catch (imgError) {
            logger.error(`Failed to process invoice image for ${crmOrderNo}:`, imgError);
            // 图片处理失败不应阻断整体流程，但应记录
          }
        }

        // 2.2 更新订单状态
        await db.query(
          `UPDATE orders SET status = 'invoice_collected', updated_at = NOW() WHERE id = $1`,
          [orderId]
        );

        // 2.3 记录日志
        await this.logInterfaceCall({
          interface_type: 'get_invoice',
          order_id: orderId,
          crm_order_no: crmOrderNo,
          request_params: response.requestXml,
          response_data: response.raw,
          status: 'success'
        });

      } else {
        // 获取失败
        const errorMessage = result.ErrorMessage || 'Invoice list empty';
        logger.warn(`Get Invoice failed for order ${crmOrderNo}: ${errorMessage}`);

        // 记录失败日志并安排重试
        const nextRetryTime = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1小时后

        await this.logInterfaceCall({
          interface_type: 'get_invoice',
          order_id: orderId,
          crm_order_no: crmOrderNo,
          request_params: response.requestXml,
          response_data: response.raw,
          status: 'failure',
          error_message: errorMessage,
          next_retry_time: nextRetryTime
        });

        // 重新调度
        this.scheduleGetInvoice(orderId, crmOrderNo, 1);
      }

    } catch (error) {
      logger.error(`Error in callGetInvoice for order ${crmOrderNo}:`, error);
      // 记录异常并重试
       await this.logInterfaceCall({
          interface_type: 'get_invoice',
          order_id: orderId,
          crm_order_no: crmOrderNo,
          request_params: JSON.stringify({ order_no: crmOrderNo }),
          response_data: '',
          status: 'failure',
          error_message: error.message,
          next_retry_time: new Date(Date.now() + 1 * 60 * 60 * 1000)
        });
        
       this.scheduleGetInvoice(orderId, crmOrderNo, 1);
    }
  }

  /**
   * 启动时恢复未完成的任务 (简单的轮询机制)
   * 每 5 分钟检查一次需要重试的任务，以及补漏机制
   */
  static startRetryJob() {
    schedule.scheduleJob('*/5 * * * *', async () => {
      logger.info('Checking for pending interface retries and catch-ups...');
      
      // 1. 查找状态为 failure 且到达重试时间的日志 (仅针对 get_invoice)
      const retryResult = await db.query(`
        SELECT DISTINCT ON (order_id) * 
        FROM interface_logs 
        WHERE interface_type = 'get_invoice' 
          AND status = 'failure' 
          AND next_retry_time <= NOW()
        ORDER BY order_id, created_at DESC
      `);

      for (const log of retryResult.rows) {
        logger.info(`Retrying getInvoice for order ${log.crm_order_no}`);
        await this.callGetInvoice(log.order_id, log.crm_order_no);
      }

      // 2. 补漏机制：查找 SN 更新成功超过 1 小时，且从未尝试获取发票的订单
      // (防止后端重启导致内存中的定时任务丢失)
      const catchUpResult = await db.query(`
        SELECT sn_log.order_id, sn_log.crm_order_no
        FROM interface_logs sn_log
        WHERE sn_log.interface_type = 'update_sn'
          AND sn_log.status = 'success'
          AND sn_log.created_at < NOW() - INTERVAL '1 hour'
          AND NOT EXISTS (
            SELECT 1 FROM interface_logs inv_log
            WHERE inv_log.order_id = sn_log.order_id
              AND inv_log.interface_type = 'get_invoice'
          )
      `);

      if (catchUpResult.rows.length > 0) {
        logger.info(`Found ${catchUpResult.rows.length} orders missing invoice fetch. Catching up...`);
        for (const order of catchUpResult.rows) {
          logger.info(`Catching up getInvoice for order ${order.crm_order_no}`);
          await this.callGetInvoice(order.order_id, order.crm_order_no);
        }
      }
    });
  }
}

module.exports = ExternalInterfaceService;
