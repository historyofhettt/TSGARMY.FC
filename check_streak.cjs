const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: 'TSGARMY.FC69', database: 'tsgdb', connectTimeout: 5000 });
  // Check recent streak records
  const [streaks] = await conn.execute('SELECT userId, currentStreak, longestStreak, lastLoginDate, createdAt FROM user_streaks ORDER BY id DESC LIMIT 10');
  console.log("Recent streaks:");
  streaks.forEach(s => console.log(`  userId=${s.userId} current=${s.currentStreak} longest=${s.longestStreak} lastLogin=${s.lastLoginDate} created=${s.createdAt}`));
  // Check recent XP history
  const [hist] = await conn.execute('SELECT userId, amount, reason, createdAt FROM xp_history ORDER BY id DESC LIMIT 10');
  console.log("\nRecent XP history:");
  hist.forEach(h => console.log(`  userId=${h.userId} amount=${h.amount} reason=${h.reason} created=${h.createdAt}`));
  await conn.end();
})().catch(console.error);