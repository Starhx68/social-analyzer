const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
// 32 bytes key for AES-256
const SECRET_KEY = Buffer.from('5f3b8a9d2e1c4f6b7a8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b', 'hex'); 
const IV_LENGTH = 16;

function encrypt(text) {
  if (!text) return text;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `ENC:${iv.toString('hex')}:${encrypted}`;
}

function decrypt(text) {
  if (!text || !text.startsWith('ENC:')) return text;
  
  const parts = text.split(':');
  if (parts.length !== 3) return text;
  
  const iv = Buffer.from(parts[1], 'hex');
  const encryptedText = parts[2];
  
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error.message);
    return text;
  }
}

module.exports = { encrypt, decrypt };
