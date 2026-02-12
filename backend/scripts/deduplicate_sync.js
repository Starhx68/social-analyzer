const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:5434/guobu' });

async function run() {
  await client.connect();

  console.log('Checking for duplicates based on ORDER_NO...');

  // 查找重复的 ORDER_NO
  const res = await client.query(`
    SELECT data->>'ORDER_NO' as order_no, COUNT(*) as count, ARRAY_AGG(oracle_rowid) as rowids
    FROM od_order_subsidy_sync
    WHERE data->>'ORDER_NO' IS NOT NULL
    GROUP BY data->>'ORDER_NO'
    HAVING COUNT(*) > 1
  `);

  if (res.rows.length === 0) {
    console.log('No duplicates found.');
  } else {
    console.log(`Found ${res.rows.length} duplicate groups.`);
    
    for (const row of res.rows) {
      const orderNo = row.order_no;
      const rowids = row.rowids;
      console.log(`Processing duplicate ORDER_NO: ${orderNo}, Count: ${row.count}`);

      // 获取详细信息以决定保留哪条（保留 modify_date 最新的）
      const detailsRes = await client.query(`
        SELECT oracle_rowid, modify_date 
        FROM od_order_subsidy_sync 
        WHERE oracle_rowid = ANY($1)
        ORDER BY modify_date DESC NULLS LAST
      `, [rowids]);

      const keepRowId = detailsRes.rows[0].oracle_rowid;
      const deleteRowIds = detailsRes.rows.slice(1).map(r => r.oracle_rowid);

      console.log(`  Keeping rowid: ${keepRowId} (Modify Date: ${detailsRes.rows[0].modify_date})`);
      console.log(`  Deleting rowids: ${deleteRowIds.join(', ')}`);

      await client.query(`
        DELETE FROM od_order_subsidy_sync
        WHERE oracle_rowid = ANY($1)
      `, [deleteRowIds]);
    }
    console.log('Duplicate cleanup completed.');
  }

  await client.end();
}

run().catch(console.error);
