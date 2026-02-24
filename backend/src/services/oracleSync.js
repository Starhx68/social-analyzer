const config = require('../config');
const db = require('../config/database');
const logger = require('../config/logger');
const oracle = require('../utils/oracle');

const SYNC_KEY = 'od_order_subsidy';
let running = false;
let timer;

const ensureTables = async () => {
  await db.query(
    `CREATE TABLE IF NOT EXISTS sync_state (
      key VARCHAR(100) PRIMARY KEY,
      last_sync TIMESTAMPTZ NOT NULL
    )`
  );
  await db.query(
    `CREATE TABLE IF NOT EXISTS od_order_subsidy_sync (
      oracle_rowid TEXT PRIMARY KEY,
      modify_date TIMESTAMPTZ,
      data JSONB NOT NULL,
      synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  );
};

const resolveInitialSyncTime = () => {
  if (config.oracleSync.initialSyncTime) {
    const value = new Date(config.oracleSync.initialSyncTime);
    if (!Number.isNaN(value.getTime())) {
      return value;
    }
  }
  return new Date(0);
};

const getLastSync = async () => {
  const result = await db.query('SELECT last_sync FROM sync_state WHERE key = $1', [SYNC_KEY]);
  if (result.rows.length > 0) {
    return result.rows[0].last_sync;
  }
  const initial = resolveInitialSyncTime();
  await db.query('INSERT INTO sync_state (key, last_sync) VALUES ($1, $2)', [SYNC_KEY, initial]);
  return initial;
};

const updateLastSync = async (lastSync) => {
  await db.query(
    `INSERT INTO sync_state (key, last_sync)
     VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET last_sync = EXCLUDED.last_sync`,
    [SYNC_KEY, lastSync]
  );
};

const fetchChanges = async (connection, since, initialTime) => {
  const result = await connection.execute(
    `SELECT ROWID AS ORACLE_ROWID, t.*
     FROM hmall.od_order_subsidy t
     WHERE (t.INSERT_DATE >= :since
        OR t.MODIFY_DATE >= :since)
       AND t.INSERT_DATE > :initialTime
       AND t.MODIFY_DATE > t.INSERT_DATE
     ORDER BY GREATEST(t.INSERT_DATE, t.MODIFY_DATE) ASC`,
    {
      since,
      initialTime
    },
    {
      outFormat: oracle.oracledb.OUT_FORMAT_OBJECT,
      resultSet: true // 使用 ResultSet 以支持流式/分批读取
    }
  );
  return result.resultSet;
};

const upsertRow = async (row) => {
  const rowId = row.ORACLE_ROWID;
  // 优先使用 MODIFY_DATE 作为同步时间，如果没有则使用 INSERT_DATE
  const insertDate = row.INSERT_DATE ? new Date(row.INSERT_DATE) : null;
  const modifyDate = row.MODIFY_DATE ? new Date(row.MODIFY_DATE) : null;
  // 优先使用 MODIFY_DATE，如果不存在则使用 INSERT_DATE
  const syncDate = modifyDate || insertDate;

  await db.query(
    `INSERT INTO od_order_subsidy_sync (oracle_rowid, modify_date, data, synced_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (oracle_rowid) DO UPDATE
     SET modify_date = EXCLUDED.modify_date,
         data = EXCLUDED.data,
         synced_at = NOW()`,
    [rowId, syncDate, JSON.stringify(row)]
  );
  return { insertDate, modifyDate, syncDate };
};

const runSync = async () => {
  if (running) {
    return;
  }
  running = true;
  let connection;
  let resultSet;
  try {
    const pool = await oracle.getPool();
    await ensureTables();
    const lastSync = await getLastSync();
    const lookbackMs = config.oracleSync.lookbackSeconds * 1000;
    let since;
    
    if (lastSync.getTime() === 0 || lastSync.getTime() === resolveInitialSyncTime().getTime()) {
       since = lastSync; // Full sync or initial sync
       logger.info(`Starting Oracle FULL sync since beginning (Timestamp: ${since.toISOString()})...`);
    } else {
       since = new Date(lastSync.getTime() - lookbackMs);
       logger.info(`Starting Oracle INCREMENTAL sync since ${since.toISOString()} (lookback ${config.oracleSync.lookbackSeconds}s)...`);
    }

    connection = await pool.getConnection();
    const initialTime = resolveInitialSyncTime();
    resultSet = await fetchChanges(connection, since, initialTime);

    let maxSyncDate = lastSync;
    let totalSynced = 0;
    let batch;
    const BATCH_SIZE = 1000;

    // 分批读取和处理
    while ((batch = await resultSet.getRows(BATCH_SIZE)) && batch.length > 0) {
      for (const row of batch) {
        if (!row.ORACLE_ROWID) {
          continue;
        }
        const dates = await upsertRow(row);
        // 同时考虑 INSERT_DATE 和 MODIFY_DATE，取最大值作为同步进度
        if (dates.syncDate && !Number.isNaN(dates.syncDate.getTime())) {
          if (dates.syncDate > maxSyncDate) {
            maxSyncDate = dates.syncDate;
          }
        }
      }
      totalSynced += batch.length;
      logger.info(`Synced ${batch.length} rows (Total: ${totalSynced})`);
    }

    if (totalSynced > 0 && maxSyncDate > lastSync) {
      await updateLastSync(maxSyncDate);
      logger.info(`Oracle sync completed. Total synced: ${totalSynced}, New LastSync: ${maxSyncDate.toISOString()}`);
    } else {
      logger.info('Oracle sync completed. No new data.');
    }
  } catch (error) {
    logger.error('Oracle sync failed:', error);
  } finally {
    if (resultSet) {
      try {
        await resultSet.close();
      } catch (error) {
        logger.error('Oracle resultSet close failed:', error);
      }
    }
    if (connection) {
      try {
        await connection.close();
      } catch (error) {
        logger.error('Oracle connection close failed:', error);
      }
    }
    running = false;
  }
};

const startOracleSync = async () => {
  if (!config.oracle.enabled) {
    logger.info('Oracle sync disabled');
    return;
  }
  if (!config.oracle.user || !config.oracle.password || !config.oracle.connectString) {
    logger.error('Oracle sync config missing');
    return;
  }

  try {
    await oracle.getPool(); // Ensure pool is initialized
    const intervalMs = config.oracleSync.intervalSeconds * 1000;
    if (timer) {
      clearInterval(timer);
    }
    await runSync();
    timer = setInterval(runSync, intervalMs);
  } catch (error) {
    logger.error('Oracle Service Failed to Start:', error.message);
    // Do not rethrow, allowing the app to continue without Oracle
  }
};

module.exports = {
  startOracleSync
};
