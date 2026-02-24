/**
 * 登录限制服务 - 使用Redis存储
 * 功能：记录登录失败次数，检查锁定状态
 */

const crypto = require('crypto');
const redisClient = require('../config/redis');

const MAX_ATTEMPTS = 8;
const CAPTCHA_THRESHOLD = 5;
const LOCKOUT_DURATION = 10 * 60; // 10分钟（秒）

const REDIS_KEYS = {
  ATTEMPTS: 'login:attempts:',
  LOCKOUT: 'login:lockout:',
  CAPTCHA_FLAG: 'login:captcha:'
};

/**
 * 生成唯一标识符（用户名 + IP组合）
 */
function getIdentifier(username, ip) {
  return crypto
    .createHash('md5')
    .update(`${username.toLowerCase()}_${ip}`)
    .digest('hex');
}

/**
 * Redis操作封装（使用 Redis v4+ Promise API）
 */
async function redisSet(key, seconds, value) {
  await redisClient.set(key, value, { EX: seconds });
}

async function redisGet(key) {
  return await redisClient.get(key);
}

async function redisDel(key) {
  await redisClient.del(key);
}

/**
 * 记录登录失败
 * @param {string} username 用户名
 * @param {string} ip IP地址
 * @returns {Object} 登录状态信息
 */
async function recordFailedAttempt(username, ip) {
  const identifier = getIdentifier(username, ip);
  const attemptsKey = REDIS_KEYS.ATTEMPTS + identifier;
  const lockoutKey = REDIS_KEYS.LOCKOUT + identifier;
  const captchaKey = REDIS_KEYS.CAPTCHA_FLAG + identifier;

  try {
    // 获取当前失败次数
    let attemptsStr = await redisGet(attemptsKey);
    let attempts = attemptsStr ? parseInt(attemptsStr) : 0;
    attempts += 1;

    // 设置失败次数（24小时过期）
    await redisSet(attemptsKey, 24 * 60 * 60, attempts);

    // 检查是否需要验证码（5次失败后）
    if (attempts >= CAPTCHA_THRESHOLD) {
      await redisSet(captchaKey, 24 * 60 * 60, '1');
    }

    // 如果达到最大尝试次数，设置锁定
    let lockUntil = null;
    if (attempts >= MAX_ATTEMPTS) {
      lockUntil = Date.now() + LOCKOUT_DURATION * 1000;
      await redisSet(lockoutKey, LOCKOUT_DURATION, lockUntil.toString());
    }

    return await getStatus(username, ip);
  } catch (error) {
    console.error('Redis recordFailedAttempt error:', error);
    // 返回基本状态，即使Redis失败也不阻断登录
    return {
      attempts,
      remainingAttempts: Math.max(0, MAX_ATTEMPTS - attempts),
      isLocked: false,
      needsCaptcha: false,
      lockUntil: null,
      canRetry: true
    };
  }
}

/**
 * 记录登录成功（清除失败记录）
 * @param {string} username 用户名
 * @param {string} ip IP地址
 */
async function recordSuccessfulAttempt(username, ip) {
  const identifier = getIdentifier(username, ip);
  const attemptsKey = REDIS_KEYS.ATTEMPTS + identifier;
  const lockoutKey = REDIS_KEYS.LOCKOUT + identifier;
  const captchaKey = REDIS_KEYS.CAPTCHA_FLAG + identifier;

  try {
    // 删除所有相关记录
    await redisDel(attemptsKey);
    await redisDel(lockoutKey);
    await redisDel(captchaKey);
  } catch (error) {
    console.error('Redis recordSuccessfulAttempt error:', error);
  }
}

/**
 * 清除验证码标记（登录成功时调用）
 * @param {string} username 用户名
 * @param {string} ip IP地址
 */
async function clearCaptchaFlag(username, ip) {
  const identifier = getIdentifier(username, ip);
  const captchaKey = REDIS_KEYS.CAPTCHA_FLAG + identifier;

  try {
    await redisDel(captchaKey);
  } catch (error) {
    console.error('Redis clearCaptchaFlag error:', error);
  }
}

/**
 * 获取登录状态
 * @param {string} username 用户名
 * @param {string} ip IP地址
 * @returns {Object} 登录状态信息
 */
async function getStatus(username, ip) {
  const identifier = getIdentifier(username, ip);
  const attemptsKey = REDIS_KEYS.ATTEMPTS + identifier;
  const lockoutKey = REDIS_KEYS.LOCKOUT + identifier;
  const captchaKey = REDIS_KEYS.CAPTCHA_FLAG + identifier;

  try {
    // 获取失败次数
    let attemptsStr = await redisGet(attemptsKey);
    const attempts = attemptsStr ? parseInt(attemptsStr) : 0;

    // 获取锁定时间
    let lockoutStr = await redisGet(lockoutKey);
    const lockUntil = lockoutStr ? parseInt(lockoutStr) : null;

    // 获取是否需要验证码
    let needsCaptcha = await redisGet(captchaKey);
    needsCaptcha = needsCaptcha === '1';

    const now = Date.now();
    const isLocked = lockUntil && now < lockUntil;
    const lockRemainingSeconds = isLocked ? Math.ceil((lockUntil - now) / 1000) : 0;
    const remainingAttempts = Math.max(0, MAX_ATTEMPTS - attempts);

    return {
      attempts,
      remainingAttempts,
      isLocked,
      needsCaptcha: needsCaptcha || attempts >= CAPTCHA_THRESHOLD,
      lockUntil,
      canRetry: !isLocked,
      lockRemainingSeconds,
      MAX_ATTEMPTS,
      CAPTCHA_THRESHOLD,
      LOCKOUT_DURATION
    };
  } catch (error) {
    console.error('Redis getStatus error:', error);
    // Redis失败时返回默认状态
    return {
      attempts: 0,
      remainingAttempts: MAX_ATTEMPTS,
      isLocked: false,
      needsCaptcha: false,
      lockUntil: null,
      canRetry: true,
      lockRemainingSeconds: 0,
      MAX_ATTEMPTS,
      CAPTCHA_THRESHOLD,
      LOCKOUT_DURATION
    };
  }
}

/**
 * 清除验证码标记（登录成功时调用）
 * @param {string} username 用户名
 * @param {string} ip IP地址
 */
async function clearCaptchaFlag(username, ip) {
  const identifier = getIdentifier(username, ip);
  const captchaKey = REDIS_KEYS.CAPTCHA_FLAG + identifier;

  try {
    await redisDel(captchaKey);
  } catch (error) {
    console.error('Redis clearCaptchaFlag error:', error);
  }
}

module.exports = {
  MAX_ATTEMPTS,
  CAPTCHA_THRESHOLD,
  LOCKOUT_DURATION,
  recordFailedAttempt,
  recordSuccessfulAttempt,
  clearCaptchaFlag,
  getStatus
};
