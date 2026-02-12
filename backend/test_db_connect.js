const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:postgres@localhost:5433/guobu',
});
console.log('Attempting to connect to postgresql://postgres:postgres@localhost:5433/guobu');
client.connect()
  .then(() => { console.log('Connected successfully'); client.end(); })
  .catch(e => { console.error('Connection error:', e.message); client.end(); });
