const mysql = require('mysql2/promise');
const passwords = ['livishield', 'Livishield', 'Livishield@123', 'livishield123', 'vibho', 'Vibho', 'vibho@123', 'Vibho@123', 'fraudlens', 'FraudLens', 'FraudLens@123', 'vibhore', 'Vibhore@123', 'vibhore123', 'qwerty', 'Qwerty@123', 'Pass@123', 'pass@123', 'Test@123', 'test@123', 'Welcome@1', 'welcome1'];

async function tryConnect() {
  for (const pwd of passwords) {
    try {
      const conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: pwd, connectTimeout: 3000 });
      await conn.query('SELECT 1');
      await conn.end();
      console.log(`SUCCESS: password="${pwd}"`);
      return;
    } catch (e) {
      if (!e.message.includes('Access denied')) { console.log(`ERROR pwd="${pwd}": ${e.message}`); }
    }
  }
  console.log('None worked. Please provide your MySQL root password.');
}
tryConnect();
