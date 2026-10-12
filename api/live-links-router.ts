import { z } from "zod";
import { and, eq, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery, authedQuery, moderatorQuery } from "./middleware";
import { hasAtLeastRole } from "@contracts/constants";
import { getDb } from "./queries/connection";
import { liveLinks, users, players, teams } from "../db/schema";
import { signKeys } from "./lib/images";
import { checkLiveNotificationRules } from "./queries/notifications";

const URL_MAX = 2048;
const TITLE_MAX = 255;
const DESC_MAX = 2000;

function mapToDbPlatform(platform: string): "youtube" | "instagram" | "twitch" | "discord" | "other" {
  if (platform === "kick" || platform === "facebook" || platform === "other") {
    return "other";
  }
  if (platform === "youtube" || platform === "instagram" || platform === "twitch" || platform === "discord") {
    return platform;
  }
  return "other";
}

function sanitize(text: string, max: number) {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim().slice(0, max);
}

// Explicit select map for live link data with joins
const selectLiveLinkWithUser = {
  id: liveLinks.id,
  userId: liveLinks.userId,
  playerId: liveLinks.playerId,
  teamId: liveLinks.teamId,
  ownershipType: liveLinks.ownershipType,
   platform: liveLinks.platform,
   displayPlatform: liveLinks.displayPlatform,
   liveUrl: liveLinks.liveUrl,
  isLive: liveLinks.isLive,
  isManuallyLive: liveLinks.isManuallyLive,
  title: liveLinks.title,
  description: liveLinks.description,
  viewerCount: liveLinks.viewerCount,
  thumbnailKey: liveLinks.thumbnailKey,
  createdAt: liveLinks.createdAt,
  updatedAt: liveLinks.updatedAt,
  userName: users.name,
  userUsername: users.username,
  userRole: users.role,
  ign: players.ign,
  teamName: teams.name,
};

export const liveLinksRouter = createRouter({
  // -------------------------------------------------------------- list live
  listLive: publicQuery.query(async () => {
    const db = getDb();
    const list = await db
      .select({
        id: liveLinks.id,
        userId: liveLinks.userId,
        playerId: liveLinks.playerId,
        teamId: liveLinks.teamId,
        ownershipType: liveLinks.ownershipType,
        platform: liveLinks.platform,
        displayPlatform: liveLinks.displayPlatform,
        liveUrl: liveLinks.liveUrl,
        isLive: liveLinks.isLive,
        isManuallyLive: liveLinks.isManuallyLive,
        title: liveLinks.title,
        description: liveLinks.description,
        viewerCount: liveLinks.viewerCount,
        thumbnailKey: liveLinks.thumbnailKey,
        createdAt: liveLinks.createdAt,
        updatedAt: liveLinks.updatedAt,
        userName: users.name,
        userUsername: users.username,
        ign: players.ign,
        teamName: teams.name,
      })
      .from(liveLinks)
      .leftJoin(users, eq(liveLinks.userId, users.id))
      .leftJoin(players, eq(liveLinks.playerId, players.id))
      .leftJoin(teams, eq(liveLinks.teamId, teams.id))
      .where(eq(liveLinks.isLive, true))
      .orderBy(desc(liveLinks.updatedAt))
      .limit(100);

    const imageKeys = [...new Set(list.map((l) => l.thumbnailKey).filter(Boolean) as string[])];
    const urls = imageKeys.length ? await signKeys(imageKeys) : {};

    return list.map((l) => ({
      ...l,
      thumbnailUrl: l.thumbnailKey ? (urls[l.thumbnailKey] ?? null) : null,
    }));
  }),

  // ---------------------------------------------------------- get my links
  getMyLinks: authedQuery.query(async ({ ctx }) => {
    const db = getDb();

    // For team channels, the user needs a player on that team or be admin/mod
    // Personal channels are directly owned by the user
    const userId = ctx.user.id;
    const canManageTeam = hasAtLeastRole(ctx.user.role, "moderator");

    // Fetch personal channels owned directly by this user
    const personalLinks = await db
      .select({
        id: liveLinks.id,
        userId: liveLinks.userId,
        playerId: liveLinks.playerId,
        teamId: liveLinks.teamId,
        ownershipType: liveLinks.ownershipType,
        platform: liveLinks.platform,
        displayPlatform: liveLinks.displayPlatform,
        liveUrl: liveLinks.liveUrl,
        isLive: liveLinks.isLive,
        isManuallyLive: liveLinks.isManuallyLive,
        title: liveLinks.title,
        description: liveLinks.description,
        viewerCount: liveLinks.viewerCount,
        thumbnailKey: liveLinks.thumbnailKey,
        createdAt: liveLinks.createdAt,
        updatedAt: liveLinks.updatedAt,
        ign: players.ign,
        teamName: teams.name,
      })
      .from(liveLinks)
      .leftJoin(users, eq(liveLinks.userId, users.id))
      .leftJoin(players, eq(liveLinks.playerId, players.id))
      .leftJoin(teams, eq(liveLinks.teamId, teams.id))
      .where(eq(liveLinks.userId, userId))
      .orderBy(desc(liveLinks.createdAt));

    // For team channels, find channels where the user has a player on that team.
    // A team channel may be owned by any player on the team.
    let teamLinks: typeof personalLinks = [];
    if (canManageTeam) {
      teamLinks = await db
        .select({
          id: liveLinks.id,
          userId: liveLinks.userId,
          playerId: liveLinks.playerId,
          teamId: liveLinks.teamId,
          ownershipType: liveLinks.ownershipType,
        platform: liveLinks.platform,
        displayPlatform: liveLinks.displayPlatform,
        liveUrl: liveLinks.liveUrl,
        isLive: liveLinks.isLive,
        isManuallyLive: liveLinks.isManuallyLive,
        title: liveLinks.title,
        description: liveLinks.description,
        viewerCount: liveLinks.viewerCount,
        thumbnailKey: liveLinks.thumbnailKey,
        createdAt: liveLinks.createdAt,
        updatedAt: liveLinks.updatedAt,
        ign: players.ign,
        teamName: teams.name,
      })
      .from(liveLinks)
      .innerJoin(players, eq(liveLinks.teamId, players.teamId))
        .leftJoin(teams, eq(liveLinks.teamId, teams.id))
        .where(
          and(
            eq(liveLinks.ownershipType, "team"),
            eq(players.userId, userId),
          ),
        )
        .orderBy(desc(liveLinks.createdAt));
    } else {
      // Non-moderators: can only see team channels they own (player linked to the channel)
      teamLinks = await db
        .select({
          id: liveLinks.id,
          userId: liveLinks.userId,
          playerId: liveLinks.playerId,
          teamId: liveLinks.teamId,
          ownershipType: liveLinks.ownershipType,
        platform: liveLinks.platform,
        displayPlatform: liveLinks.displayPlatform,
        liveUrl: liveLinks.liveUrl,
        isLive: liveLinks.isLive,
        isManuallyLive: liveLinks.isManuallyLive,
        title: liveLinks.title,
        description: liveLinks.description,
        viewerCount: liveLinks.viewerCount,
        thumbnailKey: liveLinks.thumbnailKey,
        createdAt: liveLinks.createdAt,
        updatedAt: liveLinks.updatedAt,
        ign: players.ign,
        teamName: teams.name,
      })
      .from(liveLinks)
      .leftJoin(players, eq(liveLinks.playerId, players.id))
      .leftJoin(teams, eq(liveLinks.teamId, teams.id))
        .where(
          and(
            eq(liveLinks.ownershipType, "team"),
            eq(liveLinks.userId, userId),
          ),
        )
        .orderBy(desc(liveLinks.createdAt));
    }

    // Merge and deduplicate by id
    const seen = new Set<number>();
    const list: typeof personalLinks = [];
    for (const l of [...personalLinks, ...teamLinks]) {
      if (!seen.has(l.id)) {
        seen.add(l.id);
        list.push(l);
      }
    }

    const imageKeys = [...new Set(list.map((l) => l.thumbnailKey).filter(Boolean) as string[])];
    const urls = imageKeys.length ? await signKeys(imageKeys) : {};

    return list.map((l) => ({
      ...l,
      thumbnailUrl: l.thumbnailKey ? (urls[l.thumbnailKey] ?? null) : null,
    }));
  }),

  // ------------------------------------------------------------ get my link
  getMyLink: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const link = await db
        .select()
        .from(liveLinks)
        .where(eq(liveLinks.id, input.id))
        .limit(1);
      if (!link[0]) return null;

      // Verify ownership
      const canManageTeam = hasAtLeastRole(ctx.user.role, "moderator");
      let isOwner = false;
      if (link[0].ownershipType === "personal") {
        isOwner = link[0].userId === ctx.user.id;
      } else {
        // Team channel: owner if moderator+, or has a player on that team
        if (canManageTeam) {
          isOwner = true;
        } else if (link[0].teamId !== null) {
          isOwner = await isUserOnTeam(db, link[0].teamId, ctx.user.id);
        }
      }
      if (!isOwner) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your live link." });
      }

      return link[0];
    }),

  // ------------------------------------------------------------ create link
  create: authedQuery
    .input(
      z.object({
        playerId: z.number().int().positive().nullish(),
        teamId: z.number().int().positive().nullish(),
        ownershipType: z.enum(["personal", "team"]).default("personal"),
         platform: z.enum(["youtube", "instagram", "twitch", "discord", "kick", "facebook", "other"]).default("youtube"),
         displayPlatform: z.string().max(64).nullish(),
        liveUrl: z.string().min(1).max(URL_MAX),
        title: z.string().max(TITLE_MAX).nullish(),
        description: z.string().max(DESC_MAX).nullish(),
        isLive: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.banned) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Your account has been restricted.",
        });
      }

      const db = getDb();
      const userId = ctx.user.id;

      // For team channels, verify the user has access (admin, mod, or player on that team)
      if (input.ownershipType === "team") {
        if (!input.teamId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "teamId is required for team channels." });
        }
        const canManageTeam = hasAtLeastRole(ctx.user.role, "moderator");
        if (!canManageTeam) {
          const userPlayer = await db.query.players.findFirst({
            where: and(eq(players.teamId, input.teamId), eq(players.userId, userId)),
            columns: { id: true },
          });
          if (!userPlayer) {
            throw new TRPCError({ code: "FORBIDDEN", message: "You don't manage this team." });
          }
        }
      } else if (input.teamId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "teamId can only be set for team channels." });
      }

      // Verify player belongs to this user (only for personal channels)
      const playerId: number | null = input.playerId ?? null;
      if (playerId && input.ownershipType === "personal") {
        const player = await db.query.players.findFirst({
          where: and(eq(players.id, playerId), eq(players.userId, userId)),
          columns: { id: true },
        });
        if (!player) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only link your own player profiles.",
          });
        }
      }

      // Multiple channels per user/platform — no unique constraint anymore
      // Just insert a new channel
      const cleanTitle = input.title ? sanitize(input.title, TITLE_MAX) : null;
      const cleanDesc = input.description ? sanitize(input.description, DESC_MAX) : null;
      const goingLive = input.isLive;
      const dbPlatform = mapToDbPlatform(input.platform);

      const [{ id }] = await db
        .insert(liveLinks)
        .values({
          userId: userId,
          playerId: playerId,
          teamId: input.ownershipType === "team" ? input.teamId! : null,
          ownershipType: input.ownershipType,
          platform: dbPlatform,
          displayPlatform: input.displayPlatform ?? input.platform,
          liveUrl: input.liveUrl,
          title: cleanTitle,
          description: cleanDesc,
          isLive: goingLive,
          isManuallyLive: goingLive,
        })
        .$returningId();

      // Trigger notifications for new live channel
      if (goingLive) {
        const delivered = await triggerLiveNotifications(db, id);
        return { id, updated: false, notificationsDelivered: delivered };
      }
      return { id, updated: false, notificationsDelivered: 0 };
    }),

  // ------------------------------------------------------------ update link
  update: authedQuery
    .input(
      z.object({
        id: z.number().int().positive(),
        playerId: z.number().int().positive().nullish(),
        liveUrl: z.string().min(1).max(URL_MAX).optional(),
        title: z.string().max(TITLE_MAX).nullish(),
        description: z.string().max(DESC_MAX).nullish(),
        isLive: z.boolean().optional(),
        viewerCount: z.number().int().min(0).optional(),
        thumbnailKey: z.string().max(512).nullish(),
         isManuallyLive: z.boolean().optional(),
         platform: z.enum(["youtube", "instagram", "twitch", "discord", "kick", "facebook", "other"]).optional(),
         displayPlatform: z.string().max(64).nullish(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.banned) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Your account has been restricted.",
        });
      }

      const db = getDb();

      // Fetch current link with ownership info
      const currentLink = await db
        .select({
          id: liveLinks.id,
          userId: liveLinks.userId,
          teamId: liveLinks.teamId,
          ownershipType: liveLinks.ownershipType,
          isLive: liveLinks.isLive,
          isManuallyLive: liveLinks.isManuallyLive,
        })
        .from(liveLinks)
        .where(eq(liveLinks.id, input.id))
        .limit(1);

      if (!currentLink[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Live link not found." });
      }

      const link = currentLink[0];

      // Verify ownership
      const canManageTeam = hasAtLeastRole(ctx.user.role, "moderator");
      const isOwner =
        link.ownershipType === "personal"
          ? link.userId === ctx.user.id
          : canManageTeam || (link.teamId !== null && await isUserOnTeam(db, link.teamId, ctx.user.id));
      if (!isOwner) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your live link." });
      }

      // Verify player belongs to this user (only for personal channels)
      if (input.playerId !== undefined && input.playerId !== null && link.ownershipType === "personal") {
        const player = await db.query.players.findFirst({
          where: and(eq(players.id, input.playerId), eq(players.userId, ctx.user.id)),
          columns: { id: true },
        });
        if (!player) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only link your own player profiles.",
          });
        }
      }

      const wasLive = link.isLive;
      const isGoingLive = input.isLive === true && !wasLive;

      const cleanUpdates: Record<string, unknown> = { updatedAt: new Date() };
      if (input.playerId !== undefined) cleanUpdates.playerId = input.playerId ?? null;
      if (input.liveUrl !== undefined) cleanUpdates.liveUrl = input.liveUrl;
      if (input.title !== undefined) cleanUpdates.title = input.title ? sanitize(input.title, TITLE_MAX) : null;
      if (input.description !== undefined) cleanUpdates.description = input.description ? sanitize(input.description, DESC_MAX) : null;
      if (input.isLive !== undefined) {
        cleanUpdates.isLive = input.isLive;
        cleanUpdates.isManuallyLive = input.isLive;
      }
      if (input.isManuallyLive !== undefined) cleanUpdates.isManuallyLive = input.isManuallyLive;
      if (input.platform !== undefined) {
        cleanUpdates.platform = mapToDbPlatform(input.platform);
        cleanUpdates.displayPlatform = input.displayPlatform ?? input.platform;
      }
      if (input.viewerCount !== undefined) cleanUpdates.viewerCount = input.viewerCount;
      if (input.thumbnailKey !== undefined) cleanUpdates.thumbnailKey = input.thumbnailKey ?? null;

      await db.update(liveLinks).set(cleanUpdates).where(eq(liveLinks.id, input.id));

      // Trigger auto-notifications if going live
      let notificationsDelivered = 0;
      if (isGoingLive) {
        notificationsDelivered = await triggerLiveNotifications(db, input.id);
      }

      return { ok: true, notificationsDelivered };
    }),

  // ------------------------------------------------------------ delete link
  delete: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.banned) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Your account has been restricted.",
        });
      }

      const db = getDb();
      const link = await db
        .select({ userId: liveLinks.userId, teamId: liveLinks.teamId, ownershipType: liveLinks.ownershipType })
        .from(liveLinks)
        .where(eq(liveLinks.id, input.id))
        .limit(1);

      if (!link[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Live link not found." });
      }

      const canManageTeam = hasAtLeastRole(ctx.user.role, "moderator");
      let canDelete = false;
      if (link[0].ownershipType === "personal") {
        canDelete = link[0].userId === ctx.user.id;
      } else {
        canDelete = canManageTeam || (link[0].teamId !== null && await isUserOnTeam(db, link[0].teamId, ctx.user.id));
      }
      if (!canDelete) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your live link." });
      }

      await db.delete(liveLinks).where(eq(liveLinks.id, input.id));
      return { ok: true };
    }),

  // ------------------------------------------------------- admin: get link
  adminGet: moderatorQuery
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = getDb();
      const link = await db
        .select(selectLiveLinkWithUser)
        .from(liveLinks)
        .leftJoin(users, eq(liveLinks.userId, users.id))
        .leftJoin(players, eq(liveLinks.playerId, players.id))
        .leftJoin(teams, eq(liveLinks.teamId, teams.id))
        .where(eq(liveLinks.id, input.id))
        .limit(1);

      if (!link[0]) return null;

      const l = link[0];
      const urls = l.thumbnailKey ? await signKeys([l.thumbnailKey]) : {};
      return {
        ...l,
        thumbnailUrl: l.thumbnailKey ? (urls[l.thumbnailKey] ?? null) : null,
      };
    }),

  // ----------------------------------------------- admin: list all links
  adminList: moderatorQuery
    .input(
      z.object({
        isLive: z.boolean().nullish(),
        ownershipType: z.enum(["personal", "team"]).nullish(),
        teamId: z.number().int().positive().nullish(),
      }),
    )
    .query(async ({ input }) => {
      const db = getDb();

      // Build WHERE conditions inline
      let whereClause;
      if (input.isLive !== undefined && input.isLive !== null) {
        whereClause = eq(liveLinks.isLive, input.isLive);
      }
      if (input.ownershipType !== undefined && input.ownershipType !== null) {
        const condition = eq(liveLinks.ownershipType, input.ownershipType as "personal" | "team");
        whereClause = whereClause ? and(whereClause, condition) : condition;
      }
      if (input.teamId !== undefined && input.teamId !== null) {
        const condition = eq(liveLinks.teamId, input.teamId as number);
        whereClause = whereClause ? and(whereClause, condition) : condition;
      }

      const list = await db
        .select(selectLiveLinkWithUser)
        .from(liveLinks)
        .leftJoin(users, eq(liveLinks.userId, users.id))
        .leftJoin(players, eq(liveLinks.playerId, players.id))
        .leftJoin(teams, eq(liveLinks.teamId, teams.id))
        .where(whereClause)
        .orderBy(desc(liveLinks.isLive), desc(liveLinks.createdAt))
        .limit(500);

      const imageKeys = [...new Set(list.map((l) => l.thumbnailKey).filter(Boolean) as string[])];
      const urls = imageKeys.length ? await signKeys(imageKeys) : {};

      return list.map((l) => ({
        ...l,
        thumbnailUrl: l.thumbnailKey ? (urls[l.thumbnailKey] ?? null) : null,
      }));
    }),

  // ----------------------------------------------- admin: set channel live
   adminSetLive: moderatorQuery
     .input(
       z.object({
         id: z.number().int().positive(),
         isLive: z.boolean(),
         viewerCount: z.number().int().min(0).optional(),
       }),
     )
     .mutation(async ({ input }) => {
       const db = getDb();

       // Fetch current live status to detect transition
       const current = await db
         .select({ isLive: liveLinks.isLive })
         .from(liveLinks)
         .where(eq(liveLinks.id, input.id))
         .limit(1);

       if (!current[0]) {
         throw new TRPCError({ code: "NOT_FOUND", message: "Live link not found." });
       }

       const wasLive = current[0].isLive;
       const result = await db
         .update(liveLinks)
         .set({
           isLive: input.isLive,
           isManuallyLive: input.isLive,
           viewerCount: input.viewerCount ?? 0,
           updatedAt: new Date(),
         })
         .where(eq(liveLinks.id, input.id));

       // Trigger notifications when transitioning from OFF to LIVE
       let notificationsDelivered = 0;
       if (input.isLive && !wasLive) {
         notificationsDelivered = await triggerLiveNotifications(db, input.id);
       }

       return {
         ok: (result[0]?.affectedRows ?? 0) > 0,
         notificationsDelivered,
       };
     }),

  // ------------------------------------------------------- admin: test notification
  adminTestNotification: moderatorQuery
    .input(
      z.object({
        liveLinkId: z.number().int().positive(),
        ruleId: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      const delivered = await triggerLiveNotifications(db, input.liveLinkId);
      return { delivered };
    }),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check if a user has a player on the given team.
 */
async function isUserOnTeam(db: ReturnType<typeof getDb>, teamId: number, userId: number): Promise<boolean> {
  const p = await db.query.players.findFirst({
    where: and(eq(players.teamId, teamId), eq(players.userId, userId)),
    columns: { id: true },
  });
  return !!p;
}

/**
 * Fetch a live link with all join data for notification triggering.
 */
async function fetchLiveLinkForNotifications(db: ReturnType<typeof getDb>, linkId: number) {
  const rows = await db
    .select({
      ...selectLiveLinkWithUser,
      userRole: users.role,
    })
    .from(liveLinks)
    .leftJoin(users, eq(liveLinks.userId, users.id))
    .leftJoin(players, eq(liveLinks.playerId, players.id))
    .leftJoin(teams, eq(liveLinks.teamId, teams.id))
    .where(eq(liveLinks.id, linkId))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Trigger live notifications when a link goes live.
 */
async function triggerLiveNotifications(db: ReturnType<typeof getDb>, linkId: number): Promise<number> {
  const row = await fetchLiveLinkForNotifications(db, linkId);
  if (!row) return 0;

  return checkLiveNotificationRules({
    id: row.id,
    userId: row.userId,
    playerId: row.playerId,
    teamId: row.teamId,
    ownershipType: row.ownershipType,
     platform: row.platform,
     displayPlatform: row.displayPlatform ?? null,
     liveUrl: row.liveUrl,
    isLive: row.isLive,
    isManuallyLive: row.isManuallyLive,
    title: row.title,
    description: row.description,
    viewerCount: row.viewerCount,
    thumbnailKey: row.thumbnailKey,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    user: {
      id: row.userId,
      username: row.userUsername ?? "",
      role: row.userRole ?? "",
    },
    teamName: row.teamName ?? null,
  });
}
