const express = require('express');
const router = express.Router();
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

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: config.image.maxSize
  },
  fileFilter: (req, file, cb) => {
    if (config.image.formats.includes(file.mimetype.split('/')[1])) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件格式'));
    }
  }
});

router.post('/upload', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择文件' });
    }
    
    const { orderId, materialType, imageIndex } = req.body;
    
    // Allow imageIndex to be 0
    if (!orderId || !materialType || imageIndex === undefined || imageIndex === null) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    const orderResult = await db.query(
      'SELECT organization_id, ven_code FROM orders WHERE id = $1',
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
        return res.status(403).json({ error: '无权操作该订单资料' });
      }
    }
    
    let processedBuffer = req.file.buffer;
    const TARGET_SIZE = 5 * 1024 * 1024; // 5MB
    let extension = req.file.mimetype.split('/')[1];
    if (extension === 'jpeg') extension = 'jpg';
    let contentType = req.file.mimetype;

    // 如果文件超过5MB，或者原逻辑需要转换（这里改为仅在需要压缩时转换，或保留原格式）
    // 为了满足“超过5m主动压缩”的需求，我们只在 > 5MB 时介入处理
    if (req.file.size > TARGET_SIZE) {
      const image = sharp(req.file.buffer);
      const metadata = await image.metadata();
      let width = metadata.width;
      let quality = 90; // 初始高质量

      // 转换为 JPEG 以获得更好的压缩率
      extension = 'jpg';
      contentType = 'image/jpeg';

      // 第一次尝试：高质量 JPEG
      processedBuffer = await image
        .jpeg({ quality })
        .toBuffer();

      // 如果仍然超过 5MB，逐步降低质量
      while (processedBuffer.length > TARGET_SIZE && quality >= 60) {
        quality -= 10;
        processedBuffer = await image
          .jpeg({ quality })
          .toBuffer();
      }

      // 如果仍然超过 5MB，逐步缩小尺寸
      while (processedBuffer.length > TARGET_SIZE && width > 1000) {
        width = Math.floor(width * 0.8);
        processedBuffer = await image
          .resize(width, null, { withoutEnlargement: true })
          .jpeg({ quality }) // 保持最后设定的质量
          .toBuffer();
      }
    } else if (req.file.mimetype !== 'image/png' && req.file.mimetype !== 'image/jpeg' && req.file.mimetype !== 'image/jpg') {
      // 如果不是 PNG/JPG (例如 bmp, tiff 等)，统一转换为 PNG 以保证兼容性（保留原逻辑的一环，但不强制所有都转 PNG）
      // 或者，如果原来逻辑强制转 PNG 是为了统一，那我们现在打破了这个统一。
      // 考虑到前端可能只显示图片，JPG/PNG 都是安全的。
      // 这里保留对生僻格式的转换，但对 JPG/PNG 不做处理（直接上传原图）
      const image = sharp(req.file.buffer);
      processedBuffer = await image.png().toBuffer();
      extension = 'png';
      contentType = 'image/png';
    }

    const fileName = `${orderId}_${materialType}_${Date.now()}.${extension}`;
    
    await minioClient.putObject(
      config.minio.bucket,
      fileName,
      processedBuffer,
      processedBuffer.length,
      { 'Content-Type': contentType }
    );
    
    const fileUrl = `${config.minio.useSSL ? 'https' : 'http'}://${config.minio.endpoint}:${config.minio.port}/${config.minio.bucket}/${fileName}`;
    
    const result = await db.query(
      `INSERT INTO materials (order_id, material_type, image_index, file_url, file_name, file_size, file_format, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [orderId, materialType, imageIndex, fileUrl, fileName, processedBuffer.length, extension, req.user.id]
    );
    
    // 如果订单状态为 pending 或 rejected，更新为 uploading (部分上传)
    // 并且更新 user_id 为当前操作人（最后上传人）
    await db.query(
      `UPDATE orders 
       SET status = CASE WHEN status IN ('pending', 'rejected') THEN 'uploading' ELSE status END, 
           user_id = $2,
           updated_at = NOW() 
       WHERE id = $1`,
      [orderId, req.user.id]
    );

    // 记录上传日志 (应用户要求，不再记录上传日志)
    /*
    await db.query(
      `INSERT INTO audit_logs (order_id, user_id, action, old_status, new_status, remark)
       VALUES ($1, $2, 'upload', 'uploading', 'uploading', $3)`,
      [orderId, req.user.id, `上传资料: ${materialType}`]
    );
    */
    
    res.json({
      message: '上传成功',
      material: result.rows[0]
    });
  } catch (error) {
    console.error('上传错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/order/:orderId', auth, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const orderResult = await db.query(
      'SELECT organization_id, ven_code FROM orders WHERE id = $1',
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
        return res.status(403).json({ error: '无权查看该订单资料' });
      }
    }
    
    const result = await db.query(
      `SELECT m.*, u.username as uploader_name
       FROM materials m
       LEFT JOIN users u ON m.uploaded_by = u.id
       WHERE m.order_id = $1
       ORDER BY m.image_index, m.uploaded_at`,
      [orderId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('获取资料列表错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      'SELECT * FROM materials WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '资料不存在' });
    }
    
    const material = result.rows[0];

    const orderResult = await db.query(
      'SELECT organization_id, ven_code FROM orders WHERE id = $1',
      [material.order_id]
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
        return res.status(403).json({ error: '无权删除该订单资料' });
      }
    }
    
    const fileName = material.file_url.split('/').pop();
    
    try {
      await minioClient.removeObject(config.minio.bucket, fileName);
    } catch (error) {
      console.error('删除文件错误:', error);
    }
    
    await db.query('DELETE FROM materials WHERE id = $1', [id]);
    
    // 检查剩余资料数量，如果为0且状态为uploading，则回退为pending
    const countResult = await db.query(
      'SELECT COUNT(*) FROM materials WHERE order_id = $1',
      [material.order_id]
    );
    
    if (parseInt(countResult.rows[0].count) === 0) {
      await db.query(
        `UPDATE orders 
         SET status = 'pending', updated_at = NOW() 
         WHERE id = $1 AND status = 'uploading'`,
        [material.order_id]
      );
    }
    
    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除资料错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/:id/download', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      'SELECT * FROM materials WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '资料不存在' });
    }
    
    const material = result.rows[0];

    const orderResult = await db.query(
      'SELECT organization_id, ven_code FROM orders WHERE id = $1',
      [material.order_id]
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
        return res.status(403).json({ error: '无权下载该订单资料' });
      }
    }
    const fileName = material.file_url.split('/').pop();
    
    const stream = await minioClient.getObject(config.minio.bucket, fileName);
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="${material.file_name}"`);
    
    stream.pipe(res);
  } catch (error) {
    console.error('下载资料错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
