import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { hasAtLeastRole } from "@contracts/constants";
import { getDb } from "./queries/connection";
import { signKeys } from "./lib/images";
import {
  playerHighlights,
  highlightComments,
  highlightCommentReactions,
  highlightLikes,
  players,
  teams,
  users,
} from "../db/schema";
import {
  extractYouTubeVideoId,
  resolveYouTubeVideo,
  youtubeEmbedUrl,
} from "./lib/youtube";
import { storage } from "./lib/storage";
import { media } from "../db/schema";

const TITLE_MAX = 255;
const DESC_MAX = 2000;
const COMMENT_MAX = 2000;

function sanitize(text: string, max: number) {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim().slice(0, max);
}

async function resolveHighlightUrls(highlight: typeof playerHighlights.$inferSelect) {
  const keys = [
    highlight.videoKey,
    highlight.thumbnailKey,
  ].filter(Boolean) as string[];
  const urls = keys.length ? await signKeys(keys) : {};
  return {
    videoUrl: highlight.videoKey ? (urls[highlight.videoKey] ?? null) : null,
    thumbnailUrl: highlight.thumbnailKey
      ? (urls[highlight.thumbnailKey] ?? null)
      : null,
  };
}

export const highlightsRouter = createRouter({
  // ------------------------------------------------------------------ list
  listByPlayer: publicQuery
    .input(z.object({ playerId: z.number().optional(), playerSlug: z.string().optional() }))
    .query(async ({ input }) => {
      const db = getDb();
      let player;
      if (input.playerId) {
        player = await db.query.players.findFirst({ where: eq(players.id, input.playerId) });
      } else if (input.playerSlug) {
        player = await db.query.players.findFirst({ where: eq(players.slug, input.playerSlug) });
      }
      if (!player) return [];

      const list = await db
        .select()
        .from(playerHighlights)
        .where(and(eq(playerHighlights.playerId, player.id), eq(playerHighlights.isActive, true)))
        .orderBy(desc(playerHighlights.createdAt));

      const team = player.teamId
        ? await db.query.teams.findFirst({ where: eq(teams.id, player.teamId) })
        : null;

      const allKeys = [
        ...list.map((h) => h.thumbnailKey),
        ...list.map((h) => h.videoKey),
      ].filter(Boolean) as string[];
      const urls = allKeys.length ? await signKeys(allKeys) : {};

      return list.map((h) => ({
        ...h,
        thumbnailUrl: h.thumbnailKey ? (urls[h.thumbnailKey] ?? null) : null,
        videoUrl: h.videoKey ? (urls[h.videoKey] ?? null) : null,
        embedUrl: h.youtubeVideoId ? youtubeEmbedUrl(h.youtubeVideoId) : null,
        player: { id: player.id, ign: player.ign, slug: player.slug, userId: player.userId ?? null },
        team,
      }));
    }),

  // ------------------------------------------------------------------ get
  get: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const highlight = await db.query.playerHighlights.findFirst({
        where: and(eq(playerHighlights.id, input.id), eq(playerHighlights.isActive, true)),
      });
      if (!highlight) return null;

      const player = await db.query.players.findFirst({
        where: eq(players.id, highlight.playerId),
      });
      if (!player) return null;

      const team = player.teamId
        ? await db.query.teams.findFirst({ where: eq(teams.id, player.teamId) })
        : null;

      const { videoUrl, thumbnailUrl } = await resolveHighlightUrls(highlight);

      let playerPhotoUrl: string | null = null;
      if (player.photoKey) {
        const playerUrls = await signKeys([player.photoKey]);
        playerPhotoUrl = playerUrls[player.photoKey] ?? null;
      }

      return {
        ...highlight,
        videoUrl,
        thumbnailUrl,
        embedUrl: highlight.youtubeVideoId ? youtubeEmbedUrl(highlight.youtubeVideoId) : null,
        watchUrl: highlight.youtubeVideoId
          ? `https://www.youtube.com/watch?v=${highlight.youtubeVideoId}`
          : null,
        player: {
          id: player.id,
          ign: player.ign,
          slug: player.slug,
          userId: player.userId ?? null,
          photoUrl: playerPhotoUrl,
        },
        team,
        hasLiked: ctx.user
          ? await db.query.highlightLikes.findFirst({
              where: and(
                eq(highlightLikes.highlightId, highlight.id),
                eq(highlightLikes.userId, ctx.user.id),
              ),
            }).then((r) => !!r)
          : false,
      };
    }),

  // ------------------------------------------------------------------ create
  create: authedQuery
    .input(
      z.object({
        playerId: z.number(),
        title: z.string().min(1).max(TITLE_MAX),
        description: z.string().max(DESC_MAX).nullish(),
        videoType: z.enum(["youtube", "upload"]),
        youtubeUrl: z.string().url().max(1024).nullish(),
        fileBase64: z.string().nullish(),
        fileName: z.string().max(512).nullish(),
        fileContentType: z.string().max(128).nullish(),
        thumbnailKey: z.string().max(512).nullish(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.banned) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Your account has been restricted." });
      }

      const db = getDb();
      const player = await db.query.players.findFirst({
        where: eq(players.id, input.playerId),
      });
      if (!player) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Player not found." });
      }

      const isPlayerOwner = player.userId === ctx.user.id;
      const isAdmin = hasAtLeastRole(ctx.user.role, "admin");
      if (!isPlayerOwner && !isAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the player or an admin can upload highlights for this player.",
        });
      }

      const title = sanitize(input.title, TITLE_MAX);
      if (!title) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Title is required." });
      }

      const description = input.description ? sanitize(input.description, DESC_MAX) : null;

      let youtubeVideoId: string | null = null;
      let videoKey: string | null = null;

      if (input.videoType === "youtube") {
        if (!input.youtubeUrl) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "YouTube URL is required." });
        }
        youtubeVideoId = extractYouTubeVideoId(input.youtubeUrl);
        if (!youtubeVideoId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid YouTube URL or video ID." });
        }
      } else {
        if (!input.fileBase64 || !input.fileName) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Video file is required." });
        }
        const bytes = Uint8Array.from(Buffer.from(input.fileBase64, "base64"));
        if (bytes.byteLength > 100 * 1024 * 1024) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Video is too large. Maximum size is 100 MB.",
          });
        }
        const safeName = input.fileName.replace(/[\\/]/g, "_").slice(0, 200);
        const saved = await storage.uploadFile({
          fileContent: bytes,
          fileName: `tsg/highlights/${Date.now()}-${safeName}`,
          contentType: input.fileContentType ?? "video/mp4",
        });
        await db.insert(media).values({
          fileKey: saved.key,
          fileName: safeName,
          category: "other",
          size: saved.size,
          contentType: input.fileContentType ?? "video/mp4",
        });
        videoKey = saved.key;
      }

      let resolvedThumbnailKey: string | null = input.thumbnailKey ?? null;
      if (input.videoType === "youtube") {
        const yt = await resolveYouTubeVideo(input.youtubeUrl!);
        if (yt) {
          resolvedThumbnailKey = input.thumbnailKey ?? null;
        }
      }

      const [{ id }] = await db
        .insert(playerHighlights)
        .values({
          playerId: input.playerId,
          userId: ctx.user.id,
          title,
          description,
          videoType: input.videoType,
          youtubeVideoId,
          videoKey,
          thumbnailKey: resolvedThumbnailKey,
          isActive: true,
          views: 0,
          likes: 0,
        })
        .$returningId();

      return { id };
    }),

  // ------------------------------------------------------------------ update
  update: authedQuery
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).max(TITLE_MAX).optional(),
        description: z.string().max(DESC_MAX).nullish().optional(),
        thumbnailKey: z.string().max(512).nullish().optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const highlight = await db.query.playerHighlights.findFirst({
        where: eq(playerHighlights.id, input.id),
      });
      if (!highlight) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Highlight not found." });
      }
      if (highlight.userId !== ctx.user.id && !hasAtLeastRole(ctx.user.role, "moderator")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const updateData: Record<string, unknown> = {};
      if (input.title !== undefined) updateData.title = sanitize(input.title, TITLE_MAX);
      if (input.description !== undefined)
        updateData.description = input.description ? sanitize(input.description, DESC_MAX) : null;
      if (input.thumbnailKey !== undefined) updateData.thumbnailKey = input.thumbnailKey ?? null;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;

      if (Object.keys(updateData).length > 0) {
        await db.update(playerHighlights).set(updateData).where(eq(playerHighlights.id, input.id));
      }
      return { ok: true };
    }),

  // ------------------------------------------------------------------ delete
  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const highlight = await db.query.playerHighlights.findFirst({
        where: eq(playerHighlights.id, input.id),
      });
      if (!highlight) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Highlight not found." });
      }
      if (highlight.userId !== ctx.user.id && !hasAtLeastRole(ctx.user.role, "moderator")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await db.delete(highlightCommentReactions).where(
        sql`${highlightCommentReactions.commentId} in (select id from ${highlightComments} where ${highlightComments.highlightId} = ${highlight.id})`,
      );
      await db.delete(highlightComments).where(eq(highlightComments.highlightId, highlight.id));
      await db.delete(highlightLikes).where(eq(highlightLikes.highlightId, highlight.id));

      if (highlight.videoKey) {
        await storage.deleteFile({ fileKey: highlight.videoKey });
      }
      await db.delete(playerHighlights).where(eq(playerHighlights.id, highlight.id));
      return { ok: true };
    }),

  // -------------------------------------------------------- view increment
  incrementView: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(playerHighlights)
        .set({ views: sql`${playerHighlights.views} + 1` })
        .where(eq(playerHighlights.id, input.id));
      return { ok: true };
    }),

  // -------------------------------------------------------------- like toggle
  toggleLike: authedQuery
    .input(z.object({ highlightId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.banned) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Your account has been restricted." });
      }
      const db = getDb();
      const highlight = await db.query.playerHighlights.findFirst({
        where: eq(playerHighlights.id, input.highlightId),
      });
      if (!highlight) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Highlight not found." });
      }

      const existing = await db.query.highlightLikes.findFirst({
        where: and(
          eq(highlightLikes.highlightId, input.highlightId),
          eq(highlightLikes.userId, ctx.user.id),
        ),
      });

      if (existing) {
        await db
          .delete(highlightLikes)
          .where(eq(highlightLikes.id, existing.id));
        await db
          .update(playerHighlights)
          .set({ likes: sql`${playerHighlights.likes} - 1` })
          .where(eq(playerHighlights.id, input.highlightId));
        return { liked: false };
      }

      await db
        .insert(highlightLikes)
        .values({ highlightId: input.highlightId, userId: ctx.user.id });
      await db
        .update(playerHighlights)
        .set({ likes: sql`${playerHighlights.likes} + 1` })
        .where(eq(playerHighlights.id, input.highlightId));
      return { liked: true };
    }),

  // ------------------------------------------------------------------ comments
  listComments: publicQuery
    .input(z.object({ highlightId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const list = await db
        .select({
          id: highlightComments.id,
          content: highlightComments.content,
          parentId: highlightComments.parentId,
          pinned: highlightComments.pinned,
          createdAt: highlightComments.createdAt,
          updatedAt: highlightComments.updatedAt,
          userId: users.id,
          userName: users.name,
          userUsername: users.username,
          userAvatar: users.avatar,
          userRole: users.role,
        })
        .from(highlightComments)
        .innerJoin(users, eq(highlightComments.userId, users.id))
        .where(
          and(
            eq(highlightComments.highlightId, input.highlightId),
            eq(highlightComments.hidden, false),
          ),
        )
        .orderBy(desc(highlightComments.pinned), desc(highlightComments.createdAt))
        .limit(300);

      const ids = list.map((c) => c.id);
      const reactionCounts = new Map<number, number>();
      const myReactions = new Set<number>();
      if (ids.length > 0) {
        const rows = await db
          .select()
          .from(highlightCommentReactions)
          .where(
            sql`${highlightCommentReactions.commentId} in (${sql.join(
              ids.map((i) => sql`${i}`),
              sql`, `,
            )})`,
          );
        for (const r of rows) {
          reactionCounts.set(r.commentId, (reactionCounts.get(r.commentId) ?? 0) + 1);
          if (ctx.user && r.userId === ctx.user.id) myReactions.add(r.commentId);
        }
      }

      return list.map((c) => ({
        ...c,
        reactions: reactionCounts.get(c.id) ?? 0,
        reactedByMe: myReactions.has(c.id),
        mine: ctx.user?.id === c.userId,
      }));
    }),

  createComment: authedQuery
    .input(
      z.object({
        highlightId: z.number(),
        parentId: z.number().nullish(),
        content: z.string().min(1).max(COMMENT_MAX),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.banned) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Your account has been restricted from commenting.",
        });
      }
      const now = Date.now();
      const last = lastCommentAt.get(ctx.user.id) ?? 0;
      if (now - last < 3000) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Please wait a few seconds before commenting again.",
        });
      }

      const db = getDb();
      const highlight = await db.query.playerHighlights.findFirst({
        where: eq(playerHighlights.id, input.highlightId),
      });
      if (!highlight) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Highlight not found." });
      }

      const content = sanitize(input.content, COMMENT_MAX);
      if (!content) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Comment cannot be empty." });
      }
      lastCommentAt.set(ctx.user.id, now);

      const [{ id }] = await db
        .insert(highlightComments)
        .values({
          highlightId: input.highlightId,
          userId: ctx.user.id,
          parentId: input.parentId ?? null,
          content,
        })
        .$returningId();

      return { id };
    }),

  updateComment: authedQuery
    .input(z.object({ id: z.number(), content: z.string().min(1).max(COMMENT_MAX) }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.banned) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Your account has been restricted.",
        });
      }
      const db = getDb();
      const comment = await db.query.highlightComments.findFirst({
        where: eq(highlightComments.id, input.id),
      });
      if (!comment || comment.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const content = sanitize(input.content, COMMENT_MAX);
      await db.update(highlightComments).set({ content }).where(eq(highlightComments.id, input.id));
      return { ok: true };
    }),

  deleteComment: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const comment = await db.query.highlightComments.findFirst({
        where: eq(highlightComments.id, input.id),
      });
      const canModerate = hasAtLeastRole(ctx.user.role, "moderator");
      if (!comment || (comment.userId !== ctx.user.id && !canModerate)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await db.delete(highlightCommentReactions).where(eq(highlightCommentReactions.commentId, input.id));
      await db.delete(highlightComments).where(eq(highlightComments.id, input.id));
      return { ok: true };
    }),

  reactComment: authedQuery
    .input(z.object({ commentId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.banned) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Your account has been restricted.",
        });
      }
      const db = getDb();
      const existing = await db.query.highlightCommentReactions.findFirst({
        where: and(
          eq(highlightCommentReactions.commentId, input.commentId),
          eq(highlightCommentReactions.userId, ctx.user.id),
        ),
      });
      if (existing) {
        await db
          .delete(highlightCommentReactions)
          .where(eq(highlightCommentReactions.id, existing.id));
        return { reacted: false };
      }
      await db
        .insert(highlightCommentReactions)
        .values({ commentId: input.commentId, userId: ctx.user.id });
      return { reacted: true };
    }),
});

const lastCommentAt = new Map<number, number>();
