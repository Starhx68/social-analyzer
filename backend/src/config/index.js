require('dotenv').config();
const { decrypt } = require('../utils/crypto');

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT) || 3000,
  
  database: {
    url: process.env.DATABASE_URL
  },
  
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD
  },
  
  ocr: {
    serviceProvider: process.env.OCR_SERVICE_PROVIDER || 'paddleocr',
    paddleocrUrl: process.env.PADDLEOCR_URL || 'http://localhost:8868',
    siliconFlow: {
      apiKey: process.env.SILICONFLOW_API_KEY,
      baseUrl: process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1',
      model: process.env.SILICONFLOW_MODEL || 'deepseek-ai/DeepSeek-Janus', // Vision Model
      textModel: process.env.SILICONFLOW_TEXT_MODEL || 'deepseek-ai/DeepSeek-V3' // Text Model
    }
  },
  
  minio: {
    endpoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT) || 9000,
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    bucket: process.env.MINIO_BUCKET || 'guobu-files',
    useSSL: process.env.MINIO_USE_SSL === 'true'
  },
  
  sms: {
    serviceProvider: process.env.SMS_SERVICE_PROVIDER || 'tencent',
    tencent: {
      secretId: process.env.TENCENT_SMS_SECRET_ID,
      secretKey: process.env.TENCENT_SMS_SECRET_KEY,
      appId: process.env.TENCENT_SMS_APP_ID,
      signName: process.env.TENCENT_SMS_SIGN_NAME || '国补订单',
      templateCode: process.env.TENCENT_SMS_TEMPLATE_CODE
    }
  },
  
  auditSystem: {
    apiUrl: process.env.AUDIT_SYSTEM_API_URL,
    apiKey: process.env.AUDIT_SYSTEM_API_KEY
  },
  
  centralPlatform: {
    apiUrl: process.env.CENTRAL_PLATFORM_API_URL,
    apiKey: process.env.CENTRAL_PLATFORM_API_KEY
  },
  
  oracle: {
    enabled: process.env.ORACLE_ENABLED === 'true',
    user: process.env.ORACLE_USER,
    password: decrypt(process.env.ORACLE_PASSWORD),
    connectString: process.env.ORACLE_CONNECT_STRING,
    clientLibDir: process.env.ORACLE_CLIENT_LIB_DIR,
    tnsAdmin: process.env.ORACLE_TNS_ADMIN,
    poolMin: parseInt(process.env.ORACLE_POOL_MIN) || 1,
    poolMax: parseInt(process.env.ORACLE_POOL_MAX) || 5,
    poolIncrement: parseInt(process.env.ORACLE_POOL_INCREMENT) || 1
  },
  
  oracleSync: {
    intervalSeconds: parseInt(process.env.ORACLE_SYNC_INTERVAL_SECONDS) || 10,
    lookbackSeconds: parseInt(process.env.ORACLE_SYNC_LOOKBACK_SECONDS) || 5,
    initialSyncTime: process.env.ORACLE_SYNC_INITIAL_TIME
  },
  
  image: {
    maxSize: parseInt(process.env.IMAGE_MAX_SIZE) || 52428800, // 50MB
    quality: parseInt(process.env.IMAGE_QUALITY) || 85,
    formats: (process.env.IMAGE_FORMATS || 'png,jpg,jpeg').split(',')
  },

  privilegedOrgs: (process.env.PRIVILEGED_ORG_CODES || 'demo001')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
};
