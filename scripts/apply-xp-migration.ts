import mysql from "mysql2/promise";
import "dotenv/config";

const url = process.env.DATABASE_URL!;
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
  await conn.execute(
    "ALTER TABLE org_settings ADD COLUMN IF NOT EXISTS xpEnabledRoles TEXT NULL AFTER discord",
  );
  console.log("ALTER TABLE ok");
} catch (e) {
  console.error("ALTER TABLE failed:", e);
} finally {
  await conn.end();
}
