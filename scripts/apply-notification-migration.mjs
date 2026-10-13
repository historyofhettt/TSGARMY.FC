import mysql from "mysql2/promise";
import fs from "fs";

const sql = fs.readFileSync("db/migrations/0023_notification_system.sql", "utf8");
const conn = await mysql.createConnection({
  host: "localhost",
  port: 3306,
  user: "root",
  password: "TSGARMY.FC69",
  database: "tsgdb",
  multipleStatements: true,
});
await conn.query(sql);
console.log("Migration applied OK");
const [tables] = await conn.query(
  "SHOW TABLES WHERE Tables_in_tsgdb LIKE 'notification%' OR Tables_in_tsgdb LIKE 'announcement%'",
);
console.log(
  "Tables:",
  tables.map((r) => Object.values(r)[0]).join(", "),
);
await conn.end();
