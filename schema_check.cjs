const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({host:'localhost', user:'root', password:'TSGARMY.FC69', database:'tsgdb'});
  const [rows] = await conn.query('DESCRIBE users');
  console.log(rows.map(r => r.Field + ' ' + r.Type));
  await conn.end();
})().catch(e => console.error(e.message));
