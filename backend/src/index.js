const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const logger = require('./config/logger');
const { startOracleSync } = require('./services/oracleSync');
const orderSyncService = require('./services/orderSyncService');
const nationalAuditReportService = require('./services/reports/nationalAuditReportService');
const centralPlatformReportService = require('./services/reports/centralPlatformReportService');
const ExternalInterfaceService = require('./services/externalInterfaceService');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/organizations', require('./routes/organizations'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/materials', require('./routes/materials'));
app.use('/api/ocr', require('./routes/ocr'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/interface-logs', require('./routes/interfaceLogs'));

app.use((err, req, res, _next) => {
  logger.error(err.stack);
  res.status(err.status || 500).json({
    error: {
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});

const PORT = config.port;

const initMinio = async () => {
  try {
    const Minio = require('minio');
    const minioClient = new Minio.Client({
      endPoint: config.minio.endpoint,
      port: config.minio.port,
      useSSL: config.minio.useSSL,
      accessKey: config.minio.accessKey,
      secretKey: config.minio.secretKey
    });

    const exists = await minioClient.bucketExists(config.minio.bucket);
    if (!exists) {
      await minioClient.makeBucket(config.minio.bucket, 'us-east-1');
      logger.info(`Bucket ${config.minio.bucket} created successfully.`);
      
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${config.minio.bucket}/*`]
          }
        ]
      };
      await minioClient.setBucketPolicy(config.minio.bucket, JSON.stringify(policy));
    }
  } catch (err) {
    logger.error('Error initializing MinIO:', err);
  }
};

if (require.main === module) {
  app.listen(PORT, async () => {
    await initMinio();

    // 启动Oracle同步服务（从Oracle同步到od_order_subsidy_sync表）
    await startOracleSync();

    // 启动订单同步服务（从od_order_subsidy_sync同步到order_sync和orders表）
    const orderSyncInterval = parseInt(process.env.ORDER_SYNC_INTERVAL || '60');
    orderSyncService.start(orderSyncInterval);
    logger.info(`OrderSyncService started with interval: ${orderSyncInterval}s`);

    // 启动国补审核系统上报服务
    nationalAuditReportService.start();
    logger.info('NationalAuditReportService started');

    // 启动中央平台上报服务
    centralPlatformReportService.start();
    logger.info('CentralPlatformReportService started');

    // 启动外部接口重试任务
    ExternalInterfaceService.startRetryJob();

    logger.info(`Server is running on port ${PORT}`);
    logger.info(`Environment: ${config.nodeEnv}`);
  });
}

module.exports = app;
