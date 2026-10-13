import mysql from "mysql2/promise";
import fs from "fs";

const sql = fs.readFileSync("db/migrations/0024_notification_templates_and_enhanced_types.sql", "utf8");

const conn = await mysql.createConnection({
  host: "localhost",
  port: 3306,
  user: "root",
  password: "TSGARMY.FC69",
  database: "tsgdb",
  multipleStatements: true,
});

try {
  await conn.query(sql);
  console.log("Migration 0024 applied OK");
  
  // Verify tables
  const [tables] = await conn.query(
    "SHOW TABLES WHERE Tables_in_tsgdb LIKE 'notification%' OR Tables_in_tsgdb LIKE 'announcement%'",
  );
  console.log("Tables:", tables.map((r) => Object.values(r)[0]).join(", "));
  
  // Check new columns
  const [ntCols] = await conn.query("DESCRIBE notification_types");
  console.log("notification_types columns:", ntCols.map(c => c.Field).join(", "));
  
  const [nCols] = await conn.query("DESCRIBE notifications");
  console.log("notifications columns:", nCols.map(c => c.Field).join(", "));
  
  const [aCols] = await conn.query("DESCRIBE announcements");
  console.log("announcements columns:", aCols.map(c => c.Field).join(", "));
  
  const [alCols] = await conn.query("DESCRIBE announcement_links");
  console.log("announcement_links columns:", alCols.map(c => c.Field).join(", "));
  
  // Check templates
  const [templates] = await conn.query("SELECT id, notificationTypeId, name, isDefault FROM notification_templates");
  console.log("Templates:", JSON.stringify(templates, null, 2));
  
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exit(1);
} finally {
  await conn.end();
}