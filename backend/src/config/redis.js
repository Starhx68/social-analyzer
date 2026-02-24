const redis = require('redis');

const client = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379
  },
  password: process.env.REDIS_PASSWORD || undefined
});

// 连接成功事件
client.on('connect', () => {
  console.log('✅ Redis Client: 连接成功');
});

// 就绪事件（可以执行命令）
client.on('ready', () => {
  console.log('✅ Redis Client: 就绪，可以执行命令');
});

// 错误事件
client.on('error', (err) => {
  console.error('❌ Redis Client Error:', err);
});

// 断开连接事件
client.on('end', () => {
  console.log('⚠️  Redis Client: 连接已断开');
});

// 重新连接事件
client.on('reconnecting', () => {
  console.log('🔄 Redis Client: 正在重新连接...');
});

client.connect().catch(console.error);

module.exports = client;
