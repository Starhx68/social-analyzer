const { encrypt } = require('./src/utils/crypto');

const password = process.argv[2];

if (!password) {
  console.log('Usage: node encrypt_password.js <your_password>');
  process.exit(1);
}

const encrypted = encrypt(password);
console.log('\n--- Encrypted Password ---');
console.log(encrypted);
console.log('--------------------------\n');
console.log('Please copy the above string (starting with ENC:) to your .env file as ORACLE_PASSWORD');
