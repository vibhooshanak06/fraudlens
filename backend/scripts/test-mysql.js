const mysql = require('mysql2/promise');
const passwords = ['', 'root', 'mysql', 'admin', 'password', '1234', '123456', 'Admin@123', 'Root@123', 'Vibho@123', 'vibho123'];

async function tryConnect() {
  for (const pwd of passwords) {
    try {
      const conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: pwd, connectTimeout: 3000 });
      await conn.query('SELECT 1');
      await conn.end();
      console.log(`SUCCESS: password="${pwd}"`);
      return pwd;
    } catch (e) {
      console.log(`FAIL pwd="${pwd}": ${e.message.slice(0, 60)}`);
    }
  }
  console.log('No password worked');
}
tryConnect();
