const oracledb = require('oracledb');
const config = require('../config');
const logger = require('../config/logger');

let pool = null;
let oracleClientInitialized = false;

const initOracleClient = () => {
  if (config.oracle.tnsAdmin && process.env.TNS_ADMIN !== config.oracle.tnsAdmin) {
    process.env.TNS_ADMIN = config.oracle.tnsAdmin;
  }
  
  console.log('Initializing Oracle Client with libDir:', config.oracle.clientLibDir);
  if (!oracleClientInitialized && config.oracle.clientLibDir) {
    try {
      oracledb.initOracleClient({ libDir: config.oracle.clientLibDir });
      oracleClientInitialized = true;
      console.log('Oracle Client initialized successfully in Thick mode');
    } catch (error) {
      console.error('Oracle client init failed:', error);
      logger.error('Oracle client init failed:', error);
      // Don't throw, maybe it was already initialized
    }
  } else if (!config.oracle.clientLibDir) {
    console.log('Oracle client libDir not configured, using Thin mode');
  }
};

const getPool = async () => {
  if (pool) {
    return pool;
  }

  if (!config.oracle.enabled) {
    throw new Error('Oracle is disabled in configuration');
  }

  if (!config.oracle.user || !config.oracle.password || !config.oracle.connectString) {
    throw new Error('Oracle config missing');
  }

  initOracleClient();

  try {
    pool = await oracledb.createPool({
      user: config.oracle.user,
      password: config.oracle.password,
      connectString: config.oracle.connectString,
      poolMin: config.oracle.poolMin,
      poolMax: config.oracle.poolMax,
      poolIncrement: config.oracle.poolIncrement
    });
    logger.info('Oracle connection pool created');
    return pool;
  } catch (error) {
    logger.error('Failed to create Oracle pool:', error);
    throw error;
  }
};

const execute = async (sql, binds = [], options = {}) => {
  let connection;
  try {
    const pool = await getPool();
    connection = await pool.getConnection();
    const result = await connection.execute(sql, binds, options);
    return result;
  } catch (error) {
    logger.error('Oracle execute failed:', error);
    throw error;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        logger.error('Error closing Oracle connection:', err);
      }
    }
  }
};

const closePool = async () => {
  if (pool) {
    try {
      await pool.close();
      pool = null;
      logger.info('Oracle pool closed');
    } catch (error) {
      logger.error('Error closing Oracle pool:', error);
    }
  }
};

module.exports = {
  oracledb,
  getPool,
  execute,
  closePool,
  initOracleClient
};
