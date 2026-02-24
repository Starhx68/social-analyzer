/**
 * 验证码服务 - 使用Redis存储
 * 功能：生成和验证图形验证码
 */

const sharp = require('sharp');
const redisClient = require('../config/redis');

const CAPTCHA_EXPIRY = 5 * 60; // 5分钟（秒）

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
 * 生成随机数字
 */
function generateRandomCode(length = 4) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += Math.floor(Math.random() * 10);
  }
  return code;
}

/**
 * 生成图形验证码
 * @param {string} key 验证码唯一标识（如sessionId或IP）
 * @returns {Object} { image: Buffer, code: string, key: string }
 */
async function generateCaptcha(key) {
  try {
    const code = generateRandomCode(4);
    const width = 120;
    const height = 40;

    // 创建SVG验证码背景
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f0f0f5"/>
        <text x="50%" y="50%" font-family="Arial" font-size="28" font-weight="bold" fill="#333" text-anchor="middle" dominant-baseline="middle">
          ${code.split('').join(' ')}
        </text>
        ${generateNoiseLines(width, height)}
      </svg>
    `;

    // 转换为PNG Buffer
    const image = sharp(Buffer.from(svg));
    const pngBuffer = await image.png().toBuffer();

    // 存储验证码到Redis（5分钟有效期）
    const redisKey = `captcha:${key}`;
    const expiresAt = Date.now() + CAPTCHA_EXPIRY * 1000;

    await redisSet(redisKey, CAPTCHA_EXPIRY, code);

    return {
      image: pngBuffer,
      code: code,
      key: redisKey,
      expiresAt
    };
  } catch (error) {
    console.error('生成验证码失败:', error);
    throw error;
  }
}

/**
 * 生成干扰线
 */
function generateNoiseLines(width, height) {
  let lines = '';
  for (let i = 0; i < 3; i++) {
    const x1 = Math.random() * width;
    const y1 = Math.random() * height;
    const x2 = Math.random() * width;
    const y2 = Math.random() * height;
    lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(0,0,0,0.1)" stroke-width="1"/>`;
  }
  return lines;
}

/**
 * 验证验证码
 * @param {string} key 验证码唯一标识
 * @param {string} code 用户输入的验证码
 * @returns {boolean} 是否验证成功
 */
async function verifyCaptcha(key, code) {
  try {
    const redisKey = `captcha:${key}`;
    const storedCode = await redisGet(redisKey);

    if (!storedCode) {
      return false;
    }

    // 验证码正确后删除（一次性使用）
    const isValid = storedCode === code;
    if (isValid) {
      await redisDel(redisKey);
    }

    return isValid;
  } catch (error) {
    console.error('验证验证码失败:', error);
    return false;
  }
}

module.exports = {
  generateCaptcha,
  verifyCaptcha,
  CAPTCHA_EXPIRY
};
