import mysql from "mysql2/promise";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL missing");
const m = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
if (!m) throw new Error("bad url");

const conn = await mysql.createConnection({
  host: m[3],
  port: Number(m[4]),
  user: m[1],
  password: m[2],
  database: m[5],
});

try {
  const [rows] = await conn.execute("SHOW COLUMNS FROM org_settings LIKE 'xpEnabledRoles'");
  if (Array.isArray(rows) && rows.length > 0) {
    console.log("column already exists");
  } else {
    await conn.execute(
      "ALTER TABLE org_settings ADD COLUMN xpEnabledRoles TEXT NULL AFTER discord",
    );
    console.log("ALTER TABLE ok");
  }
} catch (e) {
  console.error("failed:", e);
} finally {
  await conn.end();
}
