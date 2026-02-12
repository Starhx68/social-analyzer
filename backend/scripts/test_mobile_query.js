// Mock dependencies to avoid DB connection issues if possible, 
// but ExternalInterfaceService uses them at top level.
// So we must have node_modules installed.

const path = require('path');
// Load .env.example as default config since we might not have .env
require('dotenv').config({ path: path.resolve(__dirname, '../.env.example') });

// Override logger to output to console
const logger = require('../src/config/logger');
logger.add(new (require('winston').transports.Console)({
  format: require('winston').format.simple()
}));

const WebServiceUtils = require('../src/utils/webService');
const ExternalInterfaceService = require('../src/services/externalInterfaceService');

// Mock logInterfaceCall to prevent DB usage if DB is not reachable
// But wait, ExternalInterfaceService imports db which imports pg.
// If DB is reachable (localhost:5434 as per docker ps), we might need to configure DB connection.
// docker ps says postgres is at 0.0.0.0:5434->5432/tcp
// .env.example says DATABASE_URL=postgresql://postgres:postgres@localhost:5432/guobu
// We need to change port to 5434 for local test if running from host.

// Override DATABASE_URL for local testing against Docker Postgres
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5434/guobu';

// Mock logInterfaceCall just in case we don't want to write to DB
ExternalInterfaceService.logInterfaceCall = async (data) => {
    console.log('[MockDB] Log Interface Call:', JSON.stringify(data, null, 2));
};

async function test() {
  const mobile = '13873108111';
  console.log(`\nTesting query for mobile: ${mobile}`);

  try {
    // 1. Test WebServiceUtils directly
    console.log('\n--- Step 1: WebServiceUtils.queryOrder (Raw XML) ---');
    try {
        const response = await WebServiceUtils.queryOrder(mobile);
        console.log('Request XML:', response.requestXml);
        
        // Handle buffer or string response
        let rawContent = response.raw;
        if (Buffer.isBuffer(rawContent)) {
             // Try to decode just to show something
             const iconv = require('iconv-lite');
             // Try utf8 first
             let text = iconv.decode(rawContent, 'utf8');
             if (text.includes('�')) {
                 text = iconv.decode(rawContent, 'GB2312');
             }
             console.log('Response Raw (Decoded Preview):', text.substring(0, 500));
        } else {
             console.log('Response Raw:', rawContent.substring(0, 500));
        }
        
        console.log('Parsed Result:', JSON.stringify(response.parsed, null, 2));

    } catch (e) {
        console.error('WebServiceUtils call failed:', e.message);
        if (e.response) {
            console.error('Response status:', e.response.status);
            console.error('Response data:', e.response.data);
        }
    }

    // 2. Test ExternalInterfaceService
    console.log('\n--- Step 2: ExternalInterfaceService.queryOrderByMobile (Business Logic) ---');
    try {
        const orders = await ExternalInterfaceService.queryOrderByMobile(mobile);
        console.log('Orders Found:', JSON.stringify(orders, null, 2));
    } catch (e) {
        console.error('Service call failed:', e.message);
    }

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
      // Exit process
      process.exit(0);
  }
}

test();
