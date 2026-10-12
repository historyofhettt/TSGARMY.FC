import { z } from "zod";
import type { SQL } from "drizzle-orm";
import { and, asc, desc, eq, isNull, inArray, like, isNotNull, gt, gte, lte, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { hasAtLeastRole } from "@contracts/constants";
import {
  orgSettings,
  people,
  teams,
  teamStaff,
  teamMedia,
  players,
  tournaments,
  matches,
  matchPlayers,
  comments,
  maps,
  achievements,
  playerAchievements,
  teamAchievements,
  users,
  predictions,
  predictionOptions,
  quizQuestions,
  quizOptions,
  xpTasks,
  weeklyTopFan,
  cards,
  userCards,
  xpHistory,
  adCampaigns,
  adCreatives,
  adMetrics,
  fanRewards,
  rewardRedemptions,
  rewardRedemptionHistory,
   contentComments,
   contentCommentReports,
   mediaAlbums,
   fanSpotlight,
} from "../db/schema";
import { signKeys } from "./lib/images";
import { getOrgSettings, getXpEnabledRoles, getLiveSectionEnabledRoles } from "./queries/orgSettings";

async function getOrg() {
  const db = getDb();
  let [org] = await db.select().from(orgSettings).limit(1);
  if (!org) {
    await db.insert(orgSettings).values({});
    [org] = await db.select().from(orgSettings).limit(1);
  }
  return org;
}

const VALID_REF_TABLES = ["media_album", "tournaments", "highlights", "fan_spotlight"] as const;

export const publicRouter = createRouter({
  // ------------------------------------------------------------- organization
  org: publicQuery.query(async () => {
    const org = await getOrg();
    const urls = await signKeys([org.logoKey]);
    return { ...org, logoUrl: org.logoKey ? (urls[org.logoKey] ?? null) : null };
  }),

  getLiveSectionEnabledRoles: publicQuery.query(async () => {
    const org = await getOrg();
    return { enabledRoles: getLiveSectionEnabledRoles(org) };
  }),

  // ------------------------------------------------------------- developer info
  developerInfo: publicQuery.query(async () => {
    const db = getDb();
    const info = await db.query.developerInfo.findFirst();
    if (!info || !info.showOnHomePage) return null;
    const urls = await signKeys([info.developerPhotoKey].filter(Boolean) as string[]);
    return {
      ...info,
      photoUrl: info.developerPhotoKey ? (urls[info.developerPhotoKey] ?? null) : null,
    };
  }),

  // ---------------------------------------- Sponsored ads: serve active ads
  activeAds: publicQuery
    .input(
      z.object({
        placement: z.enum(["sidebar", "header", "between_media_items", "feed_top", "feed_bottom"]).optional(),
        page: z.string().optional(),
        limit: z.number().min(1).max(20).default(5),
      }),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const now = new Date();

      // Only serve ads in active/scheduled state, within date range, under impression limit
      let whereClause = and(
        eq(adCampaigns.isActive, true),
        inArray(adCampaigns.status, ["active", "scheduled"]),
        or(
          isNull(adCampaigns.impressionLimit),
          sql`${adCampaigns.impressions} < ${adCampaigns.impressionLimit}`,
        ),
        or(
          and(
            isNotNull(adCampaigns.startDate),
            lte(adCampaigns.startDate, now),
          ),
          isNull(adCampaigns.startDate),
        ),
        or(
          and(
            isNotNull(adCampaigns.endDate),
            gte(adCampaigns.endDate, now),
          ),
          isNull(adCampaigns.endDate),
        ),
      );

      if (input.placement) {
        whereClause = and(whereClause, eq(adCampaigns.placement, input.placement));
      }
      if (input.page) {
        // Check if page matches targetPages (stored as JSON array of page names)
        // Use JSON_VALID to avoid errors on any malformed data
        whereClause = and(
          whereClause,
          sql`(${adCampaigns.targetPages} IS NULL OR ${adCampaigns.targetPages} = '' OR JSON_CONTAINS(${adCampaigns.targetPages}, JSON_QUOTE(${input.page}), '$'))`,
        );
      }

      const campList = await db
        .select()
        .from(adCampaigns)
        .where(whereClause)
        .orderBy(desc(adCampaigns.createdAt))
        .limit(input.limit);

      if (campList.length === 0) return [];

      const creatives = await db
        .select()
        .from(adCreatives)
        .where(inArray(adCreatives.campaignId, campList.map((c) => c.id)));

      const creativeMap = new Map<number, typeof creatives>();
      for (const c of creatives) {
        if (!creativeMap.has(c.campaignId)) creativeMap.set(c.campaignId, []);
        creativeMap.get(c.campaignId)!.push(c);
      }

      // Sign image keys — collect mediaKey, logoKey, previewImageKey, and secondaryLinkUrl
      const mediaKeys = [
        ...new Set(
          creatives
            .map((c) => [c.mediaKey, c.logoKey, c.previewImageKey].filter(Boolean) as string[])
            .flat(),
        ),
      ];
      const urls = mediaKeys.length ? await signKeys(mediaKeys) : {};

      return campList.map((c) => {
        const campaignCreatives = creativeMap.get(c.id) ?? [];
        return {
          id: c.id,
          name: c.name,
          advertiser: c.advertiser,
          description: c.description,
          placement: c.placement,
          frequencyCap: c.frequencyCap,
          creatives: campaignCreatives.map((cr) => ({
            id: cr.id,
            title: cr.title,
            mediaUrl: cr.mediaKey ? (urls[cr.mediaKey] ?? null) : null,
            mediaType: cr.mediaType,
            destinationUrl: cr.destinationUrl,
            buttonText: cr.buttonText,
            linkLabel: cr.linkLabel,
            bodyText: cr.bodyText,
            advertiser: cr.advertiser,
            logoUrl: cr.logoKey ? (urls[cr.logoKey] ?? null) : null,
            secondaryLinkUrl: cr.secondaryLinkUrl,
            secondaryLinkLabel: cr.secondaryLinkLabel,
            layout: cr.layout,
            targetPages: cr.targetPages,
            desktopVisible: cr.desktopVisible,
            mobileVisible: cr.mobileVisible,
            width: cr.width,
            height: cr.height,
            aspectRatio: cr.aspectRatio,
            alignment: cr.alignment,
            backgroundColor: cr.backgroundColor,
            borderColor: cr.borderColor,
            textColor: cr.textColor,
            showBorder: cr.showBorder,
            showShadow: cr.showShadow,
            textPosition: cr.textPosition,
            ctaStyle: cr.ctaStyle,
            previewImageUrl: cr.previewImageKey ? (urls[cr.previewImageKey] ?? null) : null,
          })),
        };
      });
    }),

  // ---------------------------------------- Sponsored ads: track events
  trackAdEvent: publicQuery
    .input(
      z.object({
        campaignId: z.number().int().positive(),
        creativeId: z.number().int().positive().optional(),
        eventType: z.enum(["impression", "click", "dismissal"]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      // Verify campaign exists and is active
      const campaign = await db.query.adCampaigns.findFirst({
        where: eq(adCampaigns.id, input.campaignId),
      });
      if (!campaign || !campaign.isActive) return { ok: false };

      await db.insert(adMetrics).values({
        campaignId: input.campaignId,
        creativeId: input.creativeId ?? null,
        eventType: input.eventType,
        userId: ctx.user?.id ?? null,
      });

      // Update aggregate counters
      if (input.eventType === "impression") {
        await db
          .update(adCampaigns)
          .set({ impressions: sql`${adCampaigns.impressions} + 1` })
          .where(eq(adCampaigns.id, input.campaignId));
      } else if (input.eventType === "click") {
        await db
          .update(adCampaigns)
          .set({ clicks: sql`${adCampaigns.clicks} + 1` })
          .where(eq(adCampaigns.id, input.campaignId));
      } else if (input.eventType === "dismissal") {
        await db
          .update(adCampaigns)
          .set({ dismissals: sql`${adCampaigns.dismissals} + 1` })
          .where(eq(adCampaigns.id, input.campaignId));
      }

      return { ok: true };
    }),

  // ---------------------------------------- Generic comments
   listComments: publicQuery
    .input(
      z.object({
        refTable: z.enum(VALID_REF_TABLES),
        refId: z.number().int().positive(),
        offset: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const list = await db
        .select({
          id: contentComments.id,
          refTable: contentComments.refTable,
          refId: contentComments.refId,
          parentId: contentComments.parentId,
          content: contentComments.content,
          pinned: contentComments.pinned,
          likes: contentComments.likes,
          createdAt: contentComments.createdAt,
          updatedAt: contentComments.updatedAt,
          userId: users.id,
          userName: users.name,
          userUsername: users.username,
          userAvatar: users.avatar,
          userRole: users.role,
        })
        .from(contentComments)
        .innerJoin(users, eq(contentComments.userId, users.id))
        .where(
          and(
            eq(contentComments.refTable, input.refTable),
            eq(contentComments.refId, input.refId),
            eq(contentComments.hidden, false),
          ),
        )
        .orderBy(desc(contentComments.pinned), desc(contentComments.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const ids = list.map((c) => c.id);
      const likedByUser = new Set<number>();
      if (ctx.user && ids.length > 0) {
        const likedRows = await db
          .select({ id: contentComments.id })
          .from(contentComments)
          .where(
            and(
              inArray(contentComments.id, ids),
              sql`JSON_CONTAINS(${contentComments.likedByUserIds}, CAST(${ctx.user.id} AS JSON))`,
            ),
          );
        for (const r of likedRows) likedByUser.add(r.id);
      }

      return list.map((c) => ({
        ...c,
        likedByMe: likedByUser.has(c.id),
        mine: ctx.user?.id === c.userId,
      }));
    }),

   createComment: authedQuery
    .input(
      z.object({
        refTable: z.enum(VALID_REF_TABLES),
        refId: z.number().int().positive(),
        parentId: z.number().int().positive().nullish(),
        content: z.string().min(1).max(2000),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.banned) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Your account has been restricted." });
      }
      // eslint-disable-next-line no-control-regex
      const cleanContent = input.content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim().slice(0, 2000);
      if (!cleanContent) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Comment cannot be empty." });
      }
      if (input.parentId) {
        const parent = await getDb().query.contentComments.findFirst({
          where: eq(contentComments.id, input.parentId),
          columns: { refTable: true, refId: true, hidden: true },
        });
        if (
          !parent ||
          parent.hidden ||
          parent.refTable !== input.refTable ||
          parent.refId !== input.refId
        ) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Parent comment not found." });
        }
      }
      const [{ id }] = await getDb()
        .insert(contentComments)
        .values({
          refTable: input.refTable,
          refId: input.refId,
          userId: ctx.user.id,
          parentId: input.parentId ?? null,
          content: cleanContent,
        })
        .$returningId();
      return { id };
    }),

  updateComment: authedQuery
    .input(z.object({ id: z.number(), content: z.string().min(1).max(2000) }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.banned) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Your account has been restricted." });
      }
      const db = getDb();
      const comment = await db.query.contentComments.findFirst({
        where: eq(contentComments.id, input.id),
      });
      if (!comment || comment.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      // eslint-disable-next-line no-control-regex
      const cleanContent = input.content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim().slice(0, 2000);
      await db
        .update(contentComments)
        .set({ content: cleanContent })
        .where(eq(contentComments.id, input.id));
      return { ok: true };
    }),

  deleteComment: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const comment = await db.query.contentComments.findFirst({
        where: eq(contentComments.id, input.id),
      });
      const canModerate = hasAtLeastRole(ctx.user.role, "moderator");
      if (!comment || (comment.userId !== ctx.user.id && !canModerate)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await db.update(contentComments).set({ hidden: true }).where(eq(contentComments.id, input.id));
      return { ok: true };
    }),

  likeComment: authedQuery
    .input(z.object({ commentId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const comment = await db.query.contentComments.findFirst({
        where: eq(contentComments.id, input.commentId),
      });
      if (!comment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found." });
      }
      const likedBy = comment.likedByUserIds ? JSON.parse(comment.likedByUserIds) : [];
      const userId = ctx.user.id;
      let reactivated = false;
      if (likedBy.includes(userId)) {
        likedBy.splice(likedBy.indexOf(userId), 1);
      } else {
        likedBy.push(userId);
        reactivated = true;
      }
      await db
        .update(contentComments)
        .set({
          likes: likedBy.length,
          likedByUserIds: JSON.stringify(likedBy),
        })
        .where(eq(contentComments.id, input.commentId));
      return { liked: reactivated };
    }),

  reportContentComment: authedQuery
    .input(
      z.object({
        commentId: z.number().int().positive(),
        reason: z.enum(["spam", "harassment", "inappropriate", "offtopic", "other"]).default("other"),
        customReason: z.string().max(500).nullish(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.banned) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Your account has been restricted." });
      }
      const db = getDb();
      const comment = await db.query.contentComments.findFirst({
        where: eq(contentComments.id, input.commentId),
        columns: { id: true },
      });
      if (!comment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found." });
      }
      const customReason = input.customReason
        ? input.customReason.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim().slice(0, 500) // eslint-disable-line no-control-regex
        : null;
      try {
        const [{ id }] = await db
          .insert(contentCommentReports)
          .values({
            commentId: input.commentId,
            reporterId: ctx.user.id,
            reason: input.reason,
            customReason,
          })
          .$returningId();
        return { id };
      } catch (e: unknown) {
        if (typeof e === "object" && e !== null && "errno" in e && (e as { errno: number }).errno === 1062) {
          throw new TRPCError({ code: "CONFLICT", message: "You have already reported this comment." });
        }
        throw e;
      }
    }),

  people: publicQuery.query(async () => {
    const db = getDb();
    const list = await db.select().from(people).orderBy(asc(people.displayOrder));
    const urls = await signKeys(list.map((p) => p.photoKey));
    return list.map((p) => ({
      ...p,
      photoUrl: p.photoKey ? (urls[p.photoKey] ?? null) : null,
    }));
  }),

  // ------------------------------------------------------------------- maps
  listMaps: publicQuery.query(async () => {
    const db = getDb();
    const list = await db
      .select()
      .from(maps)
      .where(eq(maps.isActive, true))
      .orderBy(asc(maps.displayOrder));
    const urls = await signKeys(list.map((m) => m.imageKey));
    return list.map((m) => ({
      ...m,
      imageUrl: m.imageKey ? (urls[m.imageKey] ?? null) : null,
    }));
  }),

  // ------------------------------------------------------------------- teams
  teams: publicQuery.query(async () => {
    const db = getDb();
    const teamList = await db.select().from(teams).orderBy(asc(teams.displayOrder));
    const allPlayers = await db.select().from(players);
    const allTournaments = await db
      .select()
      .from(tournaments)
      .orderBy(desc(tournaments.startDate));
    const urls = await signKeys(teamList.map((t) => t.logoKey));

    return teamList.map((t) => {
      const roster = allPlayers.filter(
        (p) => p.teamId === t.id && p.status !== "former",
      );
      const teamTournaments = allTournaments.filter((x) => x.teamId === t.id);
      const latest =
        teamTournaments.find((x) => x.status === "completed") ?? null;
      const next = teamTournaments.find((x) => x.status === "upcoming") ?? null;
      const ongoing = teamTournaments.find((x) => x.status === "ongoing") ?? null;
      return {
        ...t,
        logoUrl: t.logoKey ? (urls[t.logoKey] ?? null) : null,
        rosterCount: roster.length,
        latestTournament: latest ? { name: latest.name, slug: latest.slug } : null,
        nextTournament: next
          ? { name: next.name, slug: next.slug, startDate: next.startDate }
          : null,
        ongoingTournament: ongoing
          ? { name: ongoing.name, slug: ongoing.slug }
          : null,
      };
    });
  }),

  teamBySlug: publicQuery
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const team = await db.query.teams.findFirst({
        where: eq(teams.slug, input.slug),
      });
      if (!team) return null;

      const roster = await db
        .select()
        .from(players)
        .where(eq(players.teamId, team.id))
        .orderBy(asc(players.displayOrder));
      const staff = await db
        .select()
        .from(teamStaff)
        .where(eq(teamStaff.teamId, team.id))
        .orderBy(asc(teamStaff.displayOrder));
      const media = await db
        .select()
        .from(teamMedia)
        .where(eq(teamMedia.teamId, team.id))
        .orderBy(asc(teamMedia.displayOrder));
      const teamTournaments = await db
        .select()
        .from(tournaments)
        .where(eq(tournaments.teamId, team.id))
        .orderBy(desc(tournaments.startDate));

      const urls = await signKeys([
        team.logoKey,
        ...roster.map((p) => p.photoKey),
        ...staff.map((s) => s.photoKey),
        ...media.map((m) => m.photos ? JSON.parse(m.photos) : []).flat(),
        ...teamTournaments.map((t) => t.logoKey),
      ]);

      return {
        ...team,
        logoUrl: team.logoKey ? (urls[team.logoKey] ?? null) : null,
        roster: roster.map((p) => ({
          ...p,
          photoUrl: p.photoKey ? (urls[p.photoKey] ?? null) : null,
        })),
        staff: staff.map((s) => ({
          ...s,
          photoUrl: s.photoKey ? (urls[s.photoKey] ?? null) : null,
        })),
        media: media.map((m) => ({
          ...m,
          photos: m.photos ? JSON.parse(m.photos) : [],
          photoUrls: m.photos
            ? JSON.parse(m.photos).map((k: string) => urls[k] ?? `/uploads/${k}`)
            : [],
        })),
        tournaments: teamTournaments.map((t) => ({
          ...t,
          logoUrl: t.logoKey ? (urls[t.logoKey] ?? null) : null,
        })),
      };
    }),

  teamLeaderboard: publicQuery
    .input(z.object({ teamId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const roster = await db
        .select()
        .from(players)
        .where(
          and(
            eq(players.teamId, input.teamId),
            or(eq(players.status, "active"), eq(players.status, "substitute")),
          ),
        )
        .orderBy(asc(players.displayOrder));
      const team = await db.query.teams.findFirst({ where: eq(teams.id, input.teamId) });
      const playerIds = roster.map((p) => p.id);
      const lineup = playerIds.length
        ? await db
            .select()
            .from(matchPlayers)
            .where(
              and(
                inArray(matchPlayers.playerId, playerIds),
                eq(matchPlayers.lineupStatus, "played"),
              ),
            )
        : [];
      const totals = playerIds.map((pid) => {
        const rows = lineup.filter((r) => r.playerId === pid);
        const totalKills = rows.reduce((s, r) => s + r.kills, 0);
        const matchesPlayed = rows.length;
        const avgKills = matchesPlayed > 0 ? totalKills / matchesPlayed : 0;
        return { playerId: pid, totalKills, matchesPlayed, avgKills };
      });
      totals.sort((a, b) => {
        if (b.totalKills !== a.totalKills) return b.totalKills - a.totalKills;
        return b.avgKills - a.avgKills;
      });
      const urls = await signKeys(roster.map((p) => p.photoKey));
      return {
        team: team
          ? {
              ...team,
              logoUrl: team.logoKey ? (urls[team.logoKey] ?? null) : null,
            }
          : null,
        entries: totals.map((t) => {
          const pl = roster.find((p) => p.id === t.playerId)!;
          return {
            ...pl,
            photoUrl: pl.photoKey ? (urls[pl.photoKey] ?? null) : null,
            totalKills: t.totalKills,
            matchesPlayed: t.matchesPlayed,
            avgKills: t.avgKills,
          };
        }),
      };
    }),

  // ----------------------------------------------------------------- players
  players: publicQuery
    .input(z.object({ teamId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const where = input?.teamId ? eq(players.teamId, input.teamId) : undefined;
      const list = await db
        .select()
        .from(players)
        .where(where)
        .orderBy(asc(players.displayOrder));
      const teamList = await db.select().from(teams);
      const urls = await signKeys(list.map((p) => p.photoKey));
      return list.map((p) => ({
        ...p,
        photoUrl: p.photoKey ? (urls[p.photoKey] ?? null) : null,
        team: teamList.find((t) => t.id === p.teamId) ?? null,
      }));
    }),

  playerBySlug: publicQuery
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const player = await db.query.players.findFirst({
        where: eq(players.slug, input.slug),
      });
      if (!player) return null;
      const team = player.teamId
        ? await db.query.teams.findFirst({
            where: eq(teams.id, player.teamId),
          })
        : null;

      const allPerfs = await db
        .select({
          matchId: matchPlayers.matchId,
          kills: matchPlayers.kills,
          placement: matchPlayers.placement,
          mapName: matches.mapName,
          matchNumber: matches.matchNumber,
          tournamentName: tournaments.name,
          lineupStatus: matchPlayers.lineupStatus,
        })
        .from(matchPlayers)
        .innerJoin(matches, eq(matchPlayers.matchId, matches.id))
        .innerJoin(tournaments, eq(matches.tournamentId, tournaments.id))
        .where(eq(matchPlayers.playerId, player.id));

      const playedPerfs = allPerfs.filter((p) => p.lineupStatus === "played");
      const matchesPlayed = new Set(playedPerfs.map((p) => p.matchId)).size;
      const totalKills = playedPerfs.reduce((s, p) => s + p.kills, 0);
      const best = playedPerfs.reduce<(typeof playedPerfs)[number] | null>(
        (acc, p) => (acc === null || p.kills > acc.kills ? p : acc),
        null,
      );

      const stats = {
        matchesPlayed,
        totalKills,
        averageKills: matchesPlayed > 0 ? totalKills / matchesPlayed : 0,
        bestMatch: best
          ? {
              tournamentName: best.tournamentName,
              matchNumber: best.matchNumber,
              mapName: best.mapName,
              kills: best.kills,
            }
          : null,
      };

      const urls = await signKeys([player.photoKey]);
      return {
        ...player,
        photoUrl: player.photoKey ? (urls[player.photoKey] ?? null) : null,
        team,
        stats,
        recentPerformances: allPerfs.slice(-10).reverse(),
      };
    }),

  // ------------------------------------------------------------- tournaments
  tournaments: publicQuery
    .input(
      z
        .object({
          teamId: z.number().optional(),
          status: z.enum(["upcoming", "ongoing", "completed"]).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input?.teamId) conditions.push(eq(tournaments.teamId, input.teamId));
      if (input?.status) conditions.push(eq(tournaments.status, input.status));
      const list = await db
        .select()
        .from(tournaments)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(tournaments.startDate));
      const teamList = await db.select().from(teams);
      const allMatches = await db.select().from(matches);
      const urls = await signKeys(list.map((t) => t.logoKey));
      return list.map((t) => {
        const tMatches = allMatches.filter((m) => m.tournamentId === t.id);
        return {
          ...t,
          logoUrl: t.logoKey ? (urls[t.logoKey] ?? null) : null,
          team: teamList.find((x) => x.id === t.teamId) ?? null,
          matchesPlayed: tMatches.length,
        };
      });
    }),

  tournamentBySlug: publicQuery
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const tournament = await db.query.tournaments.findFirst({
        where: eq(tournaments.slug, input.slug),
      });
      if (!tournament) return null;
      const team = tournament.teamId
        ? await db.query.teams.findFirst({
            where: eq(teams.id, tournament.teamId),
          })
        : null;
      const mvpPlayer = tournament.mvpPlayerId
        ? await db.query.players.findFirst({
            where: eq(players.id, tournament.mvpPlayerId),
          })
        : null;
      const matchList = await db
        .select()
        .from(matches)
        .where(eq(matches.tournamentId, tournament.id))
        .orderBy(asc(matches.matchNumber));

      const matchIds = matchList.map((m) => m.id);
      const lineup = matchIds.length
        ? await db
            .select()
            .from(matchPlayers)
            .where(inArray(matchPlayers.matchId, matchIds))
        : [];
      const playerIds = [...new Set(lineup.map((p) => p.playerId))];
      const perfPlayers = playerIds.length
        ? await db.select().from(players).where(inArray(players.id, playerIds))
        : [];

      const [commentCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(comments)
        .where(and(eq(comments.tournamentId, tournament.id), eq(comments.hidden, false)));

      const mapList = await db.select().from(maps);
      const mapById = new Map(mapList.map((m) => [m.id, m]));

      const urls = await signKeys([
        tournament.logoKey,
        tournament.pointTableKey,
        ...perfPlayers.map((p) => p.photoKey),
        ...mapList.map((m) => m.imageKey),
        ...(mvpPlayer?.photoKey ? [mvpPlayer.photoKey] : []),
      ]);

      const playerTotals = playerIds.map((pid) => {
        const rows = lineup.filter((p) => p.playerId === pid);
        const pl = perfPlayers.find((p) => p.id === pid)!;
        return {
          player: {
            ...pl,
            photoUrl: pl.photoKey ? (urls[pl.photoKey] ?? null) : null,
          },
          matches: rows.length,
          kills: rows.reduce((s, r) => s + r.kills, 0),
        };
      });

      return {
        ...tournament,
        logoUrl: tournament.logoKey ? (urls[tournament.logoKey] ?? null) : null,
        pointTableUrl: tournament.pointTableKey
          ? (urls[tournament.pointTableKey] ?? null)
          : null,
        team,
        mvpPlayer: mvpPlayer
          ? {
              ...mvpPlayer,
              photoUrl: mvpPlayer.photoKey ? (urls[mvpPlayer.photoKey] ?? null) : null,
            }
          : null,
        matches: matchList.map((m) => {
          const map = m.mapId ? mapById.get(m.mapId) : undefined;
          const matchLineup = lineup
            .filter((p) => p.matchId === m.id)
            .map((p) => {
              const pl = perfPlayers.find((x) => x.id === p.playerId)!;
              return {
                id: p.id,
                player: {
                  ...pl,
                  photoUrl: pl.photoKey ? (urls[pl.photoKey] ?? null) : null,
                },
                kills: p.kills,
                placementPoints: p.placementPoints,
                finishPoints: p.finishPoints,
                totalPoints: p.totalPoints,
                officialTotalPoints: p.officialTotalPoints,
                lineupStatus: p.lineupStatus,
                specialMoment: p.specialMoment,
              };
            });
          return {
            ...m,
            mapUrl: map?.imageKey ? (urls[map.imageKey] ?? null) : null,
            matchPlayers: matchLineup,
          };
        }),
        playerTotals,
        commentCount: Number(commentCount?.count ?? 0),
      };
    }),

  // ------------------------------------------------------------------ live
  live: publicQuery.query(async () => {
    const db = getDb();
    const list = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.status, "ongoing"))
      .orderBy(desc(tournaments.startDate));
    const teamList = await db.select().from(teams);
    const allMatches = await db.select().from(matches);
    const mapList = await db.select().from(maps);
    const mapById = new Map(mapList.map((m) => [m.id, m]));
    const urls = await signKeys([
      ...list.map((t) => t.logoKey),
      ...mapList.map((m) => m.imageKey),
    ]);
    return list.map((t) => {
      const tMatches = allMatches
        .filter((m) => m.tournamentId === t.id)
        .sort((a, b) => a.matchNumber - b.matchNumber);
      const current = tMatches[tMatches.length - 1] ?? null;
      const currentMap = current?.mapId ? mapById.get(current.mapId) : undefined;
      return {
        ...t,
        logoUrl: t.logoKey ? (urls[t.logoKey] ?? null) : null,
        team: teamList.find((x) => x.id === t.teamId) ?? null,
        currentMatch: current
          ? {
              matchNumber: current.matchNumber,
              mapName: current.mapName,
              mapUrl: currentMap?.imageKey ? (urls[currentMap.imageKey] ?? null) : null,
            }
          : null,
        matchesPlayed: tMatches.length,
      };
    });
  }),

   // ------------------------------------------------------------------ search
   latestComments: publicQuery.query(async () => {
    const db = getDb();
    const { users } = await import("../db/schema");
    const list = await db
      .      select({
        id: comments.id,
        content: comments.content,
        createdAt: comments.createdAt,
        userName: users.name,
        userUsername: users.username,
        userAvatar: users.avatar,
        tournamentName: tournaments.name,
        tournamentSlug: tournaments.slug,
      })
      .from(comments)
      .innerJoin(users, eq(comments.userId, users.id))
      .innerJoin(tournaments, eq(comments.tournamentId, tournaments.id))
      .where(eq(comments.hidden, false))
      .orderBy(desc(comments.createdAt))
      .limit(30);
    return list;
  }),

  search: publicQuery
    .input(z.object({ q: z.string().min(1).max(100) }))
    .query(async ({ input }) => {
      const db = getDb();
      const q = `%${input.q.trim()}%`;
      const [foundPlayers, foundTeams, foundTournaments, foundAlbums, foundSpotlight] = await Promise.all([
        db
          .select()
          .from(players)
          .where(or(like(players.ign, q), like(players.realName, q)))
          .limit(10),
        db.select().from(teams).where(like(teams.name, q)).limit(5),
        db.select().from(tournaments).where(like(tournaments.name, q)).limit(10),
        db
          .select()
          .from(mediaAlbums)
          .where(
            and(
              eq(mediaAlbums.status, "published"),
              or(like(mediaAlbums.title, q), like(mediaAlbums.description ?? "", q), like(mediaAlbums.tags ?? "", q)),
            ),
          )
          .orderBy(desc(mediaAlbums.displayOrder), desc(mediaAlbums.createdAt))
          .limit(10),
        db
          .select()
          .from(fanSpotlight)
          .where(
            and(
              eq(fanSpotlight.isApproved, true),
              or(
                like(fanSpotlight.title, q),
                like(fanSpotlight.description ?? "", q),
                like(fanSpotlight.fanName ?? "", q),
                like(fanSpotlight.category ?? "", q),
                like(fanSpotlight.tags ?? "", q),
              ),
            ),
          )
          .orderBy(desc(fanSpotlight.isFeatured), desc(fanSpotlight.displayOrder), desc(fanSpotlight.createdAt))
          .limit(10),
      ]);
      const teamList = await db.select().from(teams);
      const urls = await signKeys([
        ...foundPlayers.map((p) => p.photoKey),
        ...foundTeams.map((t) => t.logoKey),
        ...foundTournaments.map((t) => t.logoKey),
        ...foundAlbums.map((a) => a.coverKey),
        ...foundSpotlight.map((s) => s.thumbnailKey),
      ]);
      return {
        players: foundPlayers.map((p) => ({
          ...p,
          photoUrl: p.photoKey ? (urls[p.photoKey] ?? null) : null,
          team: teamList.find((t) => t.id === p.teamId) ?? null,
        })),
        teams: foundTeams.map((t) => ({
          ...t,
          logoUrl: t.logoKey ? (urls[t.logoKey] ?? null) : null,
        })),
        tournaments: foundTournaments.map((t) => ({
          ...t,
          logoUrl: t.logoKey ? (urls[t.logoKey] ?? null) : null,
          team: teamList.find((x) => x.id === t.teamId) ?? null,
        })),
        albums: foundAlbums.map((a) => ({
          ...a,
          coverUrl: a.coverKey ? (urls[a.coverKey] ?? null) : null,
        })),
        spotlight: foundSpotlight.map((s) => ({
          ...s,
          thumbnailUrl: s.thumbnailKey ? (urls[s.thumbnailKey] ?? null) : s.thumbnailUrl,
        })),
      };
    }),

  // --------------------------------------------------------------- achievements
  achievements: publicQuery.query(async () => {
    const db = getDb();
    const list = await db
      .select()
      .from(achievements)
      .where(eq(achievements.isActive, true))
      .orderBy(asc(achievements.category), asc(achievements.name));
    const iconKeys = [...new Set(list.map((a) => a.iconKey).filter(Boolean) as string[])];
    const iconUrls = iconKeys.length ? await signKeys(iconKeys) : {};
    return list.map((a) => ({ ...a, iconUrl: a.iconKey ? (iconUrls[a.iconKey] ?? null) : null }));
  }),

  playerAchievements: publicQuery
    .input(
      z.object({
        playerId: z.number().optional(),
        playerSlug: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const db = getDb();
      let player;
      if (input.playerId) {
        player = await db.query.players.findFirst({ where: eq(players.id, input.playerId) });
      } else if (input.playerSlug) {
        player = await db.query.players.findFirst({ where: eq(players.slug, input.playerSlug) });
      }
      if (!player) return [];
      const rows = await db
        .select({
          id: playerAchievements.id,
          earnedAt: playerAchievements.earnedAt,
          tournamentId: playerAchievements.tournamentId,
          matchId: playerAchievements.matchId,
          metadata: playerAchievements.metadata,
          achievement: achievements,
        })
        .from(playerAchievements)
        .innerJoin(achievements, eq(playerAchievements.achievementId, achievements.id))
        .where(eq(playerAchievements.playerId, player.id))
        .orderBy(desc(playerAchievements.earnedAt));
      const tournamentIds = rows.map((r) => r.tournamentId).filter(Boolean) as number[];
      const matchIds = rows.map((r) => r.matchId).filter(Boolean) as number[];
      const [tournamentsList, matchesList] = await Promise.all([
        tournamentIds.length
          ? db.select().from(tournaments).where(inArray(tournaments.id, tournamentIds))
          : [],
        matchIds.length
          ? db.select().from(matches).where(inArray(matches.id, matchIds))
          : [],
      ]);
      const tournamentById = new Map(tournamentsList.map((t) => [t.id, t]));
      const matchById = new Map(matchesList.map((m) => [m.id, m]));
      return rows.map((r) => ({
        ...r,
        tournament: r.tournamentId ? tournamentById.get(r.tournamentId) ?? null : null,
        match: r.matchId ? matchById.get(r.matchId) ?? null : null,
      }));
    }),

  teamAchievements: publicQuery
    .input(
      z.object({
        teamId: z.number().optional(),
        teamSlug: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const db = getDb();
      let team;
      if (input.teamId) {
        team = await db.query.teams.findFirst({ where: eq(teams.id, input.teamId) });
      } else if (input.teamSlug) {
        team = await db.query.teams.findFirst({ where: eq(teams.slug, input.teamSlug) });
      }
      if (!team) return [];
      const rows = await db
        .select({
          id: teamAchievements.id,
          earnedAt: teamAchievements.earnedAt,
          tournamentId: teamAchievements.tournamentId,
          metadata: teamAchievements.metadata,
          placement: teamAchievements.placement,
          achievement: achievements,
        })
        .from(teamAchievements)
        .innerJoin(achievements, eq(teamAchievements.achievementId, achievements.id))
        .where(eq(teamAchievements.teamId, team.id))
        .orderBy(desc(teamAchievements.earnedAt));
      const tournamentIds = rows.map((r) => r.tournamentId).filter(Boolean) as number[];
      const tournamentsList = tournamentIds.length
        ? await db.select().from(tournaments).where(inArray(tournaments.id, tournamentIds))
        : [];
      const tournamentById = new Map(tournamentsList.map((t) => [t.id, t]));
      return rows.map((r) => ({
        ...r,
        tournament: r.tournamentId ? tournamentById.get(r.tournamentId) ?? null : null,
      }));
    }),

  leaderboard: publicQuery.query(async () => {
    const db = getDb();
    const settings = await getOrgSettings();
    const enabledRoles = getXpEnabledRoles(settings) as ("fan" | "player" | "moderator" | "admin")[];
    const list = await db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        avatar: users.avatar,
        xp: users.xp,
      })
      .from(users)
      .where(and(isNotNull(users.username), gt(users.xp, 0), inArray(users.role, enabledRoles)))
      .orderBy(desc(users.xp))
      .limit(100);
    const urls = await signKeys(list.map((u) => u.avatar));
    return list.map((u) => ({
      ...u,
      rank: 0,
      avatarUrl: u.avatar ? (urls[u.avatar] ?? null) : null,
    }));
  }),

  listPredictionsByTournamentSlug: publicQuery
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const tournament = await db.query.tournaments.findFirst({ where: eq(tournaments.slug, input.slug) });
      if (!tournament) return [];
      const list = await db
        .select({
          id: predictions.id,
          tournamentId: predictions.tournamentId,
          question: predictions.question,
          xpReward: predictions.xpReward,
          status: predictions.status,
          closesAt: predictions.closesAt,
          timerSeconds: predictions.timerSeconds,
          correctOptionId: predictions.correctOptionId,
          createdAt: predictions.createdAt,
        })
        .from(predictions)
        .where(eq(predictions.tournamentId, tournament.id))
        .orderBy(desc(predictions.createdAt));
      const predictionIds = list.map((p) => p.id);
      let optionsMap: Record<number, typeof predictionOptions.$inferSelect[]> = {};
      if (predictionIds.length > 0) {
        const options = await db
          .select()
          .from(predictionOptions)
          .where(inArray(predictionOptions.predictionId, predictionIds))
          .orderBy(asc(predictionOptions.displayOrder));
        for (const opt of options) {
          if (!optionsMap[opt.predictionId]) optionsMap[opt.predictionId] = [];
          optionsMap[opt.predictionId].push(opt);
        }
      }
      return list.map((p) => ({ ...p, options: optionsMap[p.id] ?? [] }));
    }),

  listPredictions: publicQuery
    .input(z.object({ tournamentId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const where = input?.tournamentId ? eq(predictions.tournamentId, input.tournamentId) : undefined;
      const list = await db
        .select({
          id: predictions.id,
          tournamentId: predictions.tournamentId,
          tournamentName: tournaments.name,
          question: predictions.question,
          xpReward: predictions.xpReward,
          status: predictions.status,
          closesAt: predictions.closesAt,
          createdAt: predictions.createdAt,
        })
        .from(predictions)
        .leftJoin(tournaments, eq(predictions.tournamentId, tournaments.id))
        .where(where)
        .orderBy(desc(predictions.createdAt));
      const predictionIds = list.map((p) => p.id);
      let optionsMap: Record<number, typeof predictionOptions.$inferSelect[]> = {};
      if (predictionIds.length > 0) {
        const options = await db
          .select()
          .from(predictionOptions)
          .where(inArray(predictionOptions.predictionId, predictionIds))
          .orderBy(asc(predictionOptions.displayOrder));
        for (const opt of options) {
          if (!optionsMap[opt.predictionId]) optionsMap[opt.predictionId] = [];
          optionsMap[opt.predictionId].push(opt);
        }
      }
      return list.map((p) => ({ ...p, options: optionsMap[p.id] ?? [] }));
    }),

  getPrediction: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const prediction = await db.query.predictions.findFirst({ where: eq(predictions.id, input.id) });
      if (!prediction) return null;
      const options = await db
        .select()
        .from(predictionOptions)
        .where(eq(predictionOptions.predictionId, input.id))
        .orderBy(asc(predictionOptions.displayOrder));
      return { ...prediction, options };
    }),

  listQuizQuestions: publicQuery.query(async () => {
    const db = getDb();
    const questions = await db
      .select()
      .from(quizQuestions)
      .where(eq(quizQuestions.isActive, true))
      .orderBy(desc(quizQuestions.createdAt));
    const questionIds = questions.map((q) => q.id);
    let optionsMap: Record<number, typeof quizOptions.$inferSelect[]> = {};
    if (questionIds.length > 0) {
      const options = await db
        .select()
        .from(quizOptions)
        .where(inArray(quizOptions.questionId, questionIds))
        .orderBy(asc(quizOptions.displayOrder));
      for (const opt of options) {
        if (!optionsMap[opt.questionId]) optionsMap[opt.questionId] = [];
        optionsMap[opt.questionId].push(opt);
      }
    }

    const imageKeys = [...new Set(
      questions
        .filter((q) => q.imageKey)
        .map((q) => q.imageKey!),
    )];
    const urls = imageKeys.length ? await signKeys(imageKeys) : {};

    let cardImageUrlMap: Record<number, string | null> = {};
    let cardNameMap: Record<number, string> = {};
    const cardRewardIds = [...new Set(questions.filter((q) => q.cardRewardId).map((q) => q.cardRewardId!) as number[])];
    if (cardRewardIds.length > 0) {
      const cardRows = await db.select({ id: cards.id, name: cards.name, imageKey: cards.imageKey }).from(cards).where(inArray(cards.id, cardRewardIds));
      const cardKeys = [...new Set(cardRows.map((c) => c.imageKey).filter(Boolean) as string[])];
      const cardUrls = cardKeys.length ? await signKeys(cardKeys) : {};
      for (const c of cardRows) {
        cardNameMap[c.id] = c.name;
        cardImageUrlMap[c.id] = c.imageKey ? (cardUrls[c.imageKey] ?? null) : null;
      }
    }

    return questions.map((q) => ({
      ...q,
      imageUrl: q.imageKey ? (urls[q.imageKey] ?? null) : null,
      options: optionsMap[q.id] ?? [],
      cardRewardId: q.cardRewardId,
      cardRewardName: q.cardRewardId ? (cardNameMap[q.cardRewardId] ?? null) : null,
      cardRewardImageUrl: q.cardRewardId ? (cardImageUrlMap[q.cardRewardId] ?? null) : null,
    }));
  }),


  listXpTasks: publicQuery.query(async () => {
    const db = getDb();
    return db
      .select()
      .from(xpTasks)
      .where(eq(xpTasks.isActive, true))
      .orderBy(asc(xpTasks.displayOrder), desc(xpTasks.createdAt));
  }),

  weeklyTopFan: publicQuery.query(async () => {
    const db = getDb();
    const settings = await getOrgSettings();
    const enabledRoles = getXpEnabledRoles(settings) as ("fan" | "player" | "moderator" | "admin")[];
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    let record = await db.query.weeklyTopFan.findFirst({ where: eq(weeklyTopFan.weekStart, weekStart) });
    if (!record) {
      const topUser = await db
        .select({ id: users.id, xp: users.xp })
        .from(users)
        .where(and(inArray(users.role, enabledRoles), gt(users.xp, 0)))
        .orderBy(desc(users.xp))
        .limit(1);
      if (topUser.length > 0) {
        const [{ id }] = await db.insert(weeklyTopFan).values({ weekStart, weekEnd, userId: topUser[0].id, userXp: topUser[0].xp }).$returningId();
        record = await db.query.weeklyTopFan.findFirst({ where: eq(weeklyTopFan.id, id) });
      }
    }
    if (!record) return null;
    const user = await db.query.users.findFirst({ where: eq(users.id, record.userId) });
    const urls = await signKeys([user?.avatar].filter(Boolean) as string[]);
    return {
      ...record,
      user: user
        ? {
            ...user,
            avatarUrl: user.avatar ? (urls[user.avatar] ?? null) : null,
          }
        : null,
    };
  }),

  weeklyTopFanHistory: publicQuery.query(async () => {
    const db = getDb();
    const list = await db
      .select({
        id: weeklyTopFan.id,
        weekStart: weeklyTopFan.weekStart,
        weekEnd: weeklyTopFan.weekEnd,
        userId: weeklyTopFan.userId,
        userName: users.name,
        userUsername: users.username,
        userAvatar: users.avatar,
        userXp: weeklyTopFan.userXp,
        createdAt: weeklyTopFan.createdAt,
      })
      .from(weeklyTopFan)
      .leftJoin(users, eq(weeklyTopFan.userId, users.id))
      .orderBy(desc(weeklyTopFan.weekStart))
      .limit(52);
    const urls = await signKeys(list.map((r) => r.userAvatar).filter(Boolean) as string[]);
    return list.map((r) => ({
      ...r,
      userAvatarUrl: r.userAvatar ? (urls[r.userAvatar] ?? null) : null,
    }));
  }),

  // --------------------------------------------------------------- cards
  listActiveCards: publicQuery.query(async () => {
    const db = getDb();
    const list = await db
      .select()
      .from(cards)
      .where(eq(cards.isActive, true))
      .orderBy(asc(cards.category), desc(cards.createdAt));
    const urls = await signKeys(list.map((c) => c.imageKey).filter(Boolean) as string[]);
    const userCounts = await db
      .select({ cardId: userCards.cardId, count: sql<number>`count(*)` })
      .from(userCards)
      .groupBy(userCards.cardId);
    const holderCountByCard = new Map(userCounts.map((u) => [u.cardId, Number(u.count)]));
    return list.map((c) => ({
      ...c,
      imageUrl: c.imageKey ? (urls[c.imageKey] ?? null) : null,
      holderCount: holderCountByCard.get(c.id) ?? 0,
      remainingSupply: c.totalSupply - c.claimedSupply,
    }));
  }),

   // --------------------------------------------------------------- fan rewards
   activeRewards: publicQuery
    .input(z.object({ category: z.string().optional() }))
    .query(async ({ input }) => {
      const db = getDb();
      let whereClause: SQL<unknown> = eq(fanRewards.isActive, true);
      if (input.category) {
        whereClause = and(eq(fanRewards.isActive, true), eq(fanRewards.category, input.category))!;
      }
      const list = await db
        .select()
        .from(fanRewards)
        .where(whereClause)
        .orderBy(asc(fanRewards.category), desc(fanRewards.createdAt));
      const photoKeys = list.map((r) => r.photoKey).filter(Boolean) as string[];
      const urls = photoKeys.length ? await signKeys(photoKeys) : {};
      return list.map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        description: r.description,
        photoUrl: r.photoKey ? (urls[r.photoKey] ?? null) : null,
        xpCost: r.xpCost,
        stock: r.stock,
        claimedCount: r.claimedCount,
        availableStock: r.stock - r.claimedCount,
        isActive: r.isActive,
        details: r.details,
      }));
    }),

   // --------------------------------------------------------------- reward redemption (authenticated)
   redeemReward: authedQuery
    .input(
      z.object({
        rewardId: z.number().int().positive(),
        instagramUsername: z.string().max(255).nullish(),
        discordUsername: z.string().max(255).nullish(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const user = await db.query.users.findFirst({ where: eq(users.id, ctx.user.id) });
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });

      const instagram = input.instagramUsername?.trim().replace(/^@/, "") || null;
      const discord = input.discordUsername?.trim().replace(/^@/, "") || null;
      if (!instagram && !discord) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Please provide at least an Instagram or Discord username.",
        });
      }

      await db.transaction(async (tx) => {
         const reward = await tx.query.fanRewards.findFirst({
           where: eq(fanRewards.id, input.rewardId),
         });
         if (!reward) throw new TRPCError({ code: "NOT_FOUND", message: "Reward not found." });
         if (!reward.isActive) throw new TRPCError({ code: "CONFLICT", message: "This reward is no longer available." });
         if (reward.stock - reward.claimedCount <= 0) {
           throw new TRPCError({ code: "CONFLICT", message: "This reward is out of stock." });
         }
         const userXp = user.xp ?? 0;
         if (userXp < reward.xpCost) {
           throw new TRPCError({
             code: "PAYMENT_REQUIRED",
             message: `Insufficient XP. You need ${reward.xpCost} but have ${userXp}.`,
           });
         }

         // Check for pending redemptions to prevent duplicates
         const existing = await tx
           .select()
           .from(rewardRedemptions)
           .where(
             and(
               eq(rewardRedemptions.rewardId, input.rewardId),
               eq(rewardRedemptions.userId, ctx.user.id),
               eq(rewardRedemptions.status, "pending"),
             ),
           )
           .limit(1);
         if (existing.length > 0) {
           throw new TRPCError({ code: "CONFLICT", message: "You already have a pending redemption for this reward." });
         }

         await tx
           .update(users)
           .set({ xp: sql`${users.xp} - ${reward.xpCost}` })
           .where(eq(users.id, ctx.user.id));

         await tx.insert(xpHistory).values({
           userId: ctx.user.id,
           amount: -reward.xpCost,
           reason: `Redeemed reward "${reward.name}" (id ${reward.id})`,
         });

         await tx
           .update(fanRewards)
           .set({ claimedCount: sql`${fanRewards.claimedCount} + 1` })
           .where(eq(fanRewards.id, input.rewardId));

         const [{ id: redemptionId }] = await tx
           .insert(rewardRedemptions)
           .values({
             rewardId: input.rewardId,
             userId: ctx.user.id,
             instagramUsername: instagram,
             discordUsername: discord,
             xpSpent: reward.xpCost,
             status: "pending",
           })
           .$returningId();

         await tx.insert(rewardRedemptionHistory).values({
           redemptionId,
           status: "pending",
           changedById: ctx.user.id,
           adminNotes: null,
         });
      });

      await db.query.users.findFirst({ where: eq(users.id, ctx.user.id) });
      const updated = await db.query.users.findFirst({ where: eq(users.id, ctx.user.id) });
      return { ok: true, remainingXp: updated?.xp ?? 0 };
    }),
});
