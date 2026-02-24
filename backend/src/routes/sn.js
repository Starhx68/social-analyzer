/**
 * SN 查询与锁定路由
 * 功能：提供 SN 码的查询与锁定接口
 */

const express = require('express');
const router = express.Router();
const ExternalInterfaceService = require('../services/externalInterfaceService');
const multer = require('multer');
const sharp = require('sharp');
const { auth } = require('../middleware/auth');
const Minio = require('minio');
const config = require('../config');
const db = require('../config/database');

const minioClient = new Minio.Client({
  endPoint: config.minio.endpoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey
});

// 配置文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

/**
 * 图片预处理函数（与materials.js一致）
 * 处理方向修正、压缩等
 */
async function processImage(buffer, mimetype) {
  const TARGET_SIZE = 5 * 1024 * 1024; // 5MB
  let extension = mimetype.split('/')[1];
  if (extension === 'jpeg') extension = 'jpg';
  let contentType = mimetype;
  let processedBuffer = buffer;

  // 如果文件超过5MB，进行压缩处理
  if (buffer.length > TARGET_SIZE) {
    const image = sharp(buffer);
    const metadata = await image.metadata();
    let width = metadata.width;
    let quality = 90; // 初始高质量

    // 转换为 JPEG 以获得更好的压缩率
    extension = 'jpg';
    contentType = 'image/jpeg';

    // 第一次尝试：高质量 JPEG
    processedBuffer = await image
      .resize(width, null, { withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer();

    // 如果仍然超过5MB，继续降低质量
    while (processedBuffer.length > TARGET_SIZE && quality > 50) {
      quality -= 10;
      processedBuffer = await image
        .resize(width, null, { withoutEnlargement: true })
        .jpeg({ quality })
        .toBuffer();
      console.log(`Compressed to quality ${quality}, size: ${processedBuffer.length}`);
    }

    // 如果降低质量后仍然超过5MB，则调整尺寸
    if (processedBuffer.length > TARGET_SIZE) {
      const scaleRatio = Math.sqrt(TARGET_SIZE / processedBuffer.length);
      width = Math.floor(width * scaleRatio);
      processedBuffer = await image
        .resize(width, null, { withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      console.log(`Resized to width ${width}, size: ${processedBuffer.length}`);
    }
  } else if (mimetype !== 'image/png' && mimetype !== 'image/jpeg' && mimetype !== 'image/jpg') {
    // 如果不是 PNG/JPG (例如 bmp, tiff 等)，统一转换为 PNG
    const image = sharp(buffer);
    processedBuffer = await image.png().toBuffer();
    extension = 'png';
    contentType = 'image/png';
  }

  return { buffer: processedBuffer, extension, contentType };
}

/**
 * SN 查询接口
 * POST /api/sn/query
 */
router.post('/query', auth, async (req, res) => {
  try {
    const { orderNo, sn } = req.body;

    // 参数验证
    if (!orderNo || !sn) {
      return res.status(400).json({ error: '订单号和 SN 码不能为空' });
    }

    // 验证产品类型：3C数码或 A05 品类支持SN查询
    const orderResult = await db.query(
      `SELECT o.plate_type, os.product_category_code 
       FROM orders o 
       LEFT JOIN order_sync os ON o.sync_id = os.id 
       WHERE o.mchnt_ord_no = $1 OR o.crm_order_no = $2`,
      [orderNo, orderNo]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }

    const order = orderResult.rows[0];
    // 允许条件：板块类型为 3C数码 (digital_3c) 或 品类编码为 A05
    // 兼容 '3C数码' 中文值以防万一
    const is3C = order.plate_type === 'digital_3c' || order.plate_type === '3C数码';
    const isA05 = order.product_category_code === 'A05';

    if (!is3C && !isA05) {
      return res.status(400).json({
        error: 'SN查询功能仅适用于3C数码类产品或指定家电型号(A05)',
        plate_type: order.plate_type,
        product_category_code: order.product_category_code
      });
    }

    const result = await ExternalInterfaceService.querySn(orderNo, sn);

    if (result.success) {
      res.json({
        success: true,
        sellState: result.sellState,
        message: result.message,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || 'SN 查询失败'
      });
    }
  } catch (error) {
    console.error('SN Query error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * SN 锁定接口
 * POST /api/sn/lock
 */
router.post('/lock', [auth, upload.single('image')], async (req, res) => {
  try {
    const { orderNo, sn } = req.body;
    const imageFile = req.file;

    // 参数验证
    if (!orderNo || !sn) {
      return res.status(400).json({ error: '订单号和 SN 码不能为空' });
    }

    // 验证产品类型：3C数码或 A05 品类支持SN锁定
    const orderResult = await db.query(
      `SELECT o.plate_type, os.product_category_code 
       FROM orders o 
       LEFT JOIN order_sync os ON o.sync_id = os.id 
       WHERE o.mchnt_ord_no = $1 OR o.crm_order_no = $2`,
      [orderNo, orderNo]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }

    const order = orderResult.rows[0];
    // 允许条件：板块类型为 3C数码 (digital_3c) 或 品类编码为 A05
    const is3C = order.plate_type === 'digital_3c' || order.plate_type === '3C数码';
    const isA05 = order.product_category_code === 'A05';

    if (!is3C && !isA05) {
      return res.status(400).json({
        error: 'SN锁定功能仅适用于3C数码类产品或指定家电型号(A05)',
        plate_type: order.plate_type,
        product_category_code: order.product_category_code
      });
    }

    // 处理图片预处理
    let processedImageFile = null;
    if (imageFile) {
      try {
        const { buffer: processedBuffer, extension, contentType } = await processImage(
          imageFile.buffer,
          imageFile.mimetype
        );

        // 创建处理后的文件对象（保持原始文件结构）
        processedImageFile = {
          buffer: processedBuffer,
          mimetype: contentType,
          originalname: imageFile.originalname,
          size: processedBuffer.length
        };

        console.log(`Image processed: ${imageFile.originalname}, ${imageFile.size} -> ${processedBuffer.length} bytes`);
      } catch (processError) {
        console.error('Image processing error:', processError);
        return res.status(500).json({
          success: false,
          error: '图片处理失败: ' + processError.message
        });
      }
    }

    // 调用锁定服务，传入 userId 用于记录上传人
    const result = await ExternalInterfaceService.lockSn(req.user.id, orderNo, sn, processedImageFile);

    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || 'SN 锁定失败'
      });
    }
  } catch (error) {
    console.error('SN Lock error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
