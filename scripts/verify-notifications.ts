import { getDb } from "../api/queries/connection";
import {
  deliverNotification,
  getNotificationTypeConfig,
  setNotificationTypeActive,
  publishAnnouncement,
  createAnnouncement,
  resolveAnnouncementTargets,
  countUnread,
  listUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  recordNotificationClick,
  processScheduledAnnouncements,
  notifyPlayerLive,
  notifyClutchHighlight,
  notifyEngagement,
  sendManualNotification,
} from "../api/queries/notifications";
import { eq, sql } from "drizzle-orm";
import { notifications, announcements, announcementLinks, announcementTargets, notificationTypes, users } from "../db/schema";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}`, extra ?? "");
  }
}

async function cleanup() {
  const db = getDb();
  await db.delete(notifications);
  await db.delete(announcementLinks);
  await db.delete(announcementTargets);
  await db.delete(announcements);
  // Reset all types to active
  await db.update(notificationTypes).set({ isActive: true });
}

async function main() {
  console.log("=== Notification System Verification ===\n");
  await cleanup();
  const db = getDb();

  // Get a real user to target
  const [someUser] = await db.select().from(users).limit(1);
  if (!someUser) {
    console.log("No users in DB — cannot run user-targeted tests.");
    process.exit(1);
  }
  const userId = someUser.id;
  console.log(`Using user id=${userId} (${someUser.username}) for tests.\n`);

  // ---- 1. Type config & inactive blocking ----
  console.log("[1] Type config & inactive-type blocking");
  const cfg = await getNotificationTypeConfig("engagement");
  check("engagement type exists", !!cfg);
  check("engagement is active by default", cfg?.isActive === true);

  // Deactivate engagement, then try to deliver
  await setNotificationTypeActive("engagement", false);
  const blocked = await deliverNotification({
    type: "engagement",
    userId,
    title: "Should be blocked",
    sourceType: "test",
    sourceId: "blocked-1",
  });
  check("inactive type blocks delivery (returns null)", blocked === null);
  const [blockedCountRow] = await db
    .select({ c: sql<number>`count(*)`.mapWith(Number) })
    .from(notifications)
    .where(eq(notifications.sourceId, "blocked-1"));
  check("no notification row created for inactive type", blockedCountRow?.c === 0);
  // Reactivate
  await setNotificationTypeActive("engagement", true);

  // ---- 2. Duplicate prevention ----
  console.log("\n[2] Duplicate prevention");
  const first = await deliverNotification({
    type: "engagement",
    userId,
    title: "Like notification",
    sourceType: "engagement",
    sourceId: "dup-test-1",
  });
  check("first delivery succeeds", first !== null);
  const dup = await deliverNotification({
    type: "engagement",
    userId,
    title: "Like notification (different title)",
    sourceType: "engagement",
    sourceId: "dup-test-1",
  });
  check("duplicate (same user+type+source) suppressed", dup === null);
  const [dupCountRow] = await db
    .select({ c: sql<number>`count(*)`.mapWith(Number) })
    .from(notifications)
    .where(eq(notifications.sourceId, "dup-test-1"));
  check("only one row for duplicate source", dupCountRow?.c === 1);

  // ---- 3. Read / unread / click tracking ----
  console.log("\n[3] Read/unread/click tracking");
  const unreadBefore = await countUnread(userId);
  check("unread count >= 1 after delivery", unreadBefore >= 1);
  const marked = await markNotificationRead(first!, userId);
  check("markNotificationRead returns true", marked === true);
  const unreadAfter = await countUnread(userId);
  check("unread count decreased after mark read", unreadAfter === unreadBefore - 1);
  const clicked = await recordNotificationClick(first!, userId);
  check("recordNotificationClick returns true", clicked === true);
  const [clickRow] = await db
    .select({ clickedAt: notifications.clickedAt })
    .from(notifications)
    .where(eq(notifications.id, first!));
  check("clickedAt is set", !!clickRow?.clickedAt);

  // ---- 4. Mark all read ----
  console.log("\n[4] Mark all read");
  await deliverNotification({ type: "engagement", userId, title: "A", sourceType: "t", sourceId: "mar-1" });
  await deliverNotification({ type: "engagement", userId, title: "B", sourceType: "t", sourceId: "mar-2" });
  const unreadMulti = await countUnread(userId);
  check("multiple unread exist", unreadMulti >= 2);
  await markAllNotificationsRead(userId);
  const unreadZero = await countUnread(userId);
  check("mark all read clears unread", unreadZero === 0);

  // ---- 5. Announcement targeting ----
  console.log("\n[5] Announcement targeting");
  const annId = await createAnnouncement({
    title: "Test Announcement",
    message: "This is a test announcement message.",
    priority: "important",
    status: "draft",
    targetType: "everyone",
    links: [{ url: "https://example.com", label: "Example" }],
    createdById: userId,
  });
  check("announcement created", annId > 0);
  const targets = await resolveAnnouncementTargets(annId);
  check("everyone targeting includes the test user", targets.includes(userId));
  check("everyone targeting is non-empty", targets.length > 0);

  // ---- 6. Publish announcement delivers notifications ----
  console.log("\n[6] Publish announcement delivery");
  const delivered = await publishAnnouncement(annId);
  check("publishAnnouncement delivered > 0", delivered > 0);
  const [annNotifRow] = await db
    .select({ c: sql<number>`count(*)`.mapWith(Number) })
    .from(notifications)
    .where(
      sql`${notifications.sourceType} = 'announcement' and ${notifications.sourceId} = ${String(annId)}`,
    );
  check("notification rows created for announcement", annNotifRow?.c === delivered);
  const [annRow] = await db.select().from(announcements).where(eq(announcements.id, annId));
  check("announcement status is published", annRow?.status === "published");
  check("announcement publishedAt set", !!annRow?.publishedAt);

  // ---- 7. Automatic hooks ----
  console.log("\n[7] Automatic hooks (Player Live / Clutch / Engagement)");
  const liveRes = await notifyPlayerLive({ playerName: "TestPlayer", streamUrl: "https://twitch.tv/x" });
  check("notifyPlayerLive delivers to everyone", liveRes.delivered > 0);
  const clutchRes = await notifyClutchHighlight({ title: "Amazing Clutch!" });
  check("notifyClutchHighlight delivers to everyone", clutchRes.delivered > 0);
  const engRes = await notifyEngagement({
    recipientUserId: userId,
    actorName: "Someone",
    action: "like",
    contentDesc: "your comment",
  });
  check("notifyEngagement delivers 1", engRes.delivered === 1);

  // Inactive type blocks automatic hook
  await setNotificationTypeActive("player_live", false);
  const liveBlocked = await notifyPlayerLive({ playerName: "BlockedPlayer" });
  check("inactive player_live hook is skipped", liveBlocked.skipped === true && liveBlocked.delivered === 0);
  await setNotificationTypeActive("player_live", true);

  // ---- 8. Manual send ----
  console.log("\n[8] Manual send");
  const manualRes = await sendManualNotification({
    type: "clutch_highlight",
    title: "Manual Clutch",
    targetType: "everyone",
  });
  check("sendManualNotification delivers", manualRes.delivered > 0);

  // ---- 9. Scheduled announcements ----
  console.log("\n[9] Scheduled announcements");
  const schedId = await createAnnouncement({
    title: "Scheduled Announcement",
    message: "Scheduled message.",
    priority: "normal",
    status: "scheduled",
    scheduledAt: new Date(Date.now() - 60_000), // 1 min in the past => due
    targetType: "everyone",
    links: [],
    createdById: userId,
  });
  const published = await processScheduledAnnouncements();
  check("processScheduledAnnouncements published the due one", published >= 1);
  const [schedRow] = await db.select().from(announcements).where(eq(announcements.id, schedId));
  check("scheduled announcement now published", schedRow?.status === "published");

  // ---- 10. listUserNotifications ----
  console.log("\n[10] listUserNotifications");
  const history = await listUserNotifications(userId, 100);
  check("history is non-empty", history.length > 0);
  check("history includes type slug", history.some((h) => h.typeSlug === "engagement"));
  check("history includes announcement", history.some((h) => h.sourceType === "announcement"));

  // ---- Summary ----
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  await cleanup();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
