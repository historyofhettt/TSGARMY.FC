import { z } from "zod";
import { and, asc, desc, eq, like, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { signKeys } from "./lib/images";
import { storage } from "./lib/storage";
import { extractYouTubeVideoId, youtubeEmbedUrl } from "./lib/youtube";
import { buildZip } from "./lib/zip";
import {
  ALBUM_BULK_UPLOAD_LIMIT,
  ALBUM_STATUSES,
  MEDIA_PAGE_DEFAULT_CONFIG,
  MEDIA_SORT_OPTIONS,
  MEDIA_TAGS,
  MEDIA_TYPES,
  type MediaSortOption,
  type MediaPageConfig,
} from "@contracts/constants";
import {
  mediaItems,
  mediaPageConfig,
  mediaAlbums,
  mediaAlbumLinks,
  teams,
  tournaments,
  playerHighlights,
  players,
} from "@db/schema";

const TITLE_MAX = 255;
const DESC_MAX = 2000;
const CATEGORY_MAX = 128;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const LINK_LABEL_MAX = 128;
const LINK_URL_MAX = 1024;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
]);
const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

function sanitize(text: string, max: number) {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim().slice(0, max);
}

/** Validate a Google Drive share URL and extract the file id. */
function parseDriveUrl(input: string): { fileId: string; url: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // https://drive.google.com/file/d/<fileId>/view?...
  // https://drive.google.com/open?id=<fileId>
  // https://drive.google.com/drive/folders/<folderId>
  let fileId: string | null = null;
  try {
    const url = new URL(trimmed);
    if (!url.hostname.includes("drive.google.com")) return null;
    const pathParts = url.pathname.split("/");
    const fileIdx = pathParts.findIndex((p) => p === "file" || p === "folders" || p === "drive");
    if (fileIdx >= 0 && pathParts[fileIdx + 1]) {
      fileId = pathParts[fileIdx + 1];
    } else {
      fileId = url.searchParams.get("id");
    }
  } catch {
    // not a valid URL
    const m = trimmed.match(/[\w-]{20,}/);
    fileId = m ? m[0] : null;
  }
  if (!fileId) return null;
  return { fileId, url: trimmed };
}

/** Resolve signed URLs for a list of media item rows. */
async function resolveMediaUrls(list: (typeof mediaItems.$inferSelect)[]) {
  const keys = [
    ...list.map((m) => m.fileKey),
    ...list.map((m) => m.thumbnailKey),
  ].filter(Boolean) as string[];
  const urls = keys.length ? await signKeys(keys) : {};
  return urls;
}

/** Load and parse the persisted media page config (with defaults). */
async function loadConfig(): Promise<MediaPageConfig> {
  const db = getDb();
  const [row] = await db.select().from(mediaPageConfig).limit(1);
  if (!row) return { ...MEDIA_PAGE_DEFAULT_CONFIG };
  try {
    const parsed = JSON.parse(row.config);
    return { ...MEDIA_PAGE_DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...MEDIA_PAGE_DEFAULT_CONFIG };
  }
}

async function saveConfig(config: MediaPageConfig) {
  const db = getDb();
  const [row] = await db.select().from(mediaPageConfig).limit(1);
  const blob = JSON.stringify(config);
  if (row) {
    await db.update(mediaPageConfig).set({ config: blob }).where(eq(mediaPageConfig.id, row.id));
  } else {
    await db.insert(mediaPageConfig).values({ config: blob });
  }
}

export const mediaRouter = createRouter({
  // ------------------------------------------------------------- public list
  list: publicQuery
    .input(
      z.object({
        teamId: z.number().optional(),
        tournamentId: z.number().optional(),
        category: z.string().max(CATEGORY_MAX).optional(),
        tag: z.string().max(64).optional(),
        type: z.enum(MEDIA_TYPES).optional(),
        search: z.string().max(128).optional(),
        sort: z.enum(MEDIA_SORT_OPTIONS).optional(),
        includeHighlights: z.boolean().optional(),
        limit: z.number().int().min(1).max(100).optional(),
        cursor: z.number().optional(),
      }),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const config = await loadConfig();
      const limit = input.limit ?? 60;
      const cursor = input.cursor ?? 0;

      // Build the where clause from the enabled filters.
      const conditions = [eq(mediaItems.isActive, true)];
      if (input.teamId) conditions.push(eq(mediaItems.teamId, input.teamId));
      if (input.tournamentId) conditions.push(eq(mediaItems.tournamentId, input.tournamentId));
      if (input.category) conditions.push(eq(mediaItems.category, input.category));
      if (input.type) conditions.push(eq(mediaItems.type, input.type));
      if (input.tag) {
        conditions.push(sql`JSON_CONTAINS(${mediaItems.tags}, JSON_QUOTE(${input.tag}))`);
      }
      if (input.search) {
        const term = `%${input.search}%`;
        const searchCond = or(
          like(mediaItems.title, term),
          like(mediaItems.description, term),
          like(mediaItems.category, term),
        );
        if (searchCond) conditions.push(searchCond);
      }

      const where = and(...conditions);

      // Sorting.
      const sort = input.sort ?? "newest";
      let orderBy;
      switch (sort) {
        case "oldest":
          orderBy = [asc(mediaItems.uploadDate), asc(mediaItems.id)];
          break;
        case "featured":
          orderBy = [desc(mediaItems.featured), desc(mediaItems.uploadDate), desc(mediaItems.id)];
          break;
        case "title":
          orderBy = [asc(mediaItems.title)];
          break;
        case "newest":
        default:
          orderBy = [desc(mediaItems.uploadDate), desc(mediaItems.id)];
          break;
      }

      const list = await db
        .select()
        .from(mediaItems)
        .where(where)
        .orderBy(...orderBy)
        .limit(limit + 1)
        .offset(cursor);

      const hasMore = list.length > limit;
      const page = list.slice(0, limit);

      const urls = await resolveMediaUrls(page);

      // Resolve team / tournament names for display.
      const teamIds = [...new Set(page.map((m) => m.teamId).filter((t): t is number => !!t))];
      const tournamentIds = [...new Set(page.map((m) => m.tournamentId).filter((t): t is number => !!t))];
      const teamList = teamIds.length
        ? await db.select().from(teams).where(sql`${teams.id} in (${sql.join(teamIds.map((id) => sql`${id}`), sql`, `)})`)
        : [];
      const tournamentList = tournamentIds.length
        ? await db.select().from(tournaments).where(sql`${tournaments.id} in (${sql.join(tournamentIds.map((id) => sql`${id}`), sql`, `)})`)
        : [];

      const items = page.map((m) => ({
        ...m,
        fileUrl: m.fileKey ? (urls[m.fileKey] ?? null) : null,
        thumbnailUrl: m.thumbnailKey ? (urls[m.thumbnailKey] ?? null) : null,
        embedUrl: m.youtubeVideoId ? youtubeEmbedUrl(m.youtubeVideoId) : null,
        watchUrl: m.youtubeVideoId ? `https://www.youtube.com/watch?v=${m.youtubeVideoId}` : null,
        driveFileId: m.driveUrl ? parseDriveUrl(m.driveUrl)?.fileId ?? null : null,
        tags: parseTags(m.tags),
        team: teamList.find((t) => t.id === m.teamId) ?? null,
        tournament: tournamentList.find((t) => t.id === m.tournamentId) ?? null,
      }));

      // Optionally include existing player highlights (reused, not duplicated).
      let highlights: unknown[] = [];
      if (input.includeHighlights && config.includeHighlights) {
        const hl = await db
          .select({
            id: playerHighlights.id,
            title: playerHighlights.title,
            description: playerHighlights.description,
            videoType: playerHighlights.videoType,
            youtubeVideoId: playerHighlights.youtubeVideoId,
            videoKey: playerHighlights.videoKey,
            thumbnailKey: playerHighlights.thumbnailKey,
            createdAt: playerHighlights.createdAt,
            playerId: playerHighlights.playerId,
          })
          .from(playerHighlights)
          .where(eq(playerHighlights.isActive, true))
          .orderBy(desc(playerHighlights.createdAt))
          .limit(limit);
        const hlKeys = [...hl.map((h) => h.videoKey), ...hl.map((h) => h.thumbnailKey)].filter(Boolean) as string[];
        const hlUrls = hlKeys.length ? await signKeys(hlKeys) : {};
        const playerIds = [...new Set(hl.map((h) => h.playerId))];
        const playerList = playerIds.length
          ? await db.select().from(players).where(sql`${players.id} in (${sql.join(playerIds.map((id) => sql`${id}`), sql`, `)})`)
          : [];
        highlights = hl.map((h) => {
          const player = playerList.find((p) => p.id === h.playerId);
          return {
            id: `hl-${h.id}`,
            title: h.title,
            description: h.description,
            type: "video" as const,
            source: "highlight" as const,
            fileUrl: h.videoKey ? (hlUrls[h.videoKey] ?? null) : null,
            thumbnailUrl: h.thumbnailKey ? (hlUrls[h.thumbnailKey] ?? null) : null,
            embedUrl: h.youtubeVideoId ? youtubeEmbedUrl(h.youtubeVideoId) : null,
            watchUrl: h.youtubeVideoId ? `https://www.youtube.com/watch?v=${h.youtubeVideoId}` : null,
            createdAt: h.createdAt,
            player: player ? { id: player.id, ign: player.ign, slug: player.slug } : null,
            // Normalized fields so highlights render like media items.
            tags: [] as string[],
            uploadDate: h.createdAt,
            driveUrl: null,
            featured: false,
            team: null,
            tournament: null,
            category: null,
            displayOrder: 0,
            isActive: true,
            teamId: null,
            tournamentId: null,
            fileKey: h.videoKey,
            thumbnailKey: h.thumbnailKey,
            youtubeVideoId: h.youtubeVideoId,
            driveFileId: null,
          };
        });
      }

      return { items, highlights, hasMore, nextCursor: hasMore ? cursor + limit : null, config };
    }),

  // -------------------------------------------------------------- public get
  get: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const item = await db.query.mediaItems.findFirst({
        where: and(eq(mediaItems.id, input.id), eq(mediaItems.isActive, true)),
      });
      if (!item) return null;
      const urls = await resolveMediaUrls([item]);
      const team = item.teamId
        ? await db.query.teams.findFirst({ where: eq(teams.id, item.teamId) })
        : null;
      const tournament = item.tournamentId
        ? await db.query.tournaments.findFirst({ where: eq(tournaments.id, item.tournamentId) })
        : null;
      return {
        ...item,
        fileUrl: item.fileKey ? (urls[item.fileKey] ?? null) : null,
        thumbnailUrl: item.thumbnailKey ? (urls[item.thumbnailKey] ?? null) : null,
        embedUrl: item.youtubeVideoId ? youtubeEmbedUrl(item.youtubeVideoId) : null,
        watchUrl: item.youtubeVideoId ? `https://www.youtube.com/watch?v=${item.youtubeVideoId}` : null,
        driveFileId: item.driveUrl ? parseDriveUrl(item.driveUrl)?.fileId ?? null : null,
        tags: parseTags(item.tags),
        team,
        tournament,
      };
    }),

  // ------------------------------------------------------- public config
  config: publicQuery.query(async () => {
    return await loadConfig();
  }),

  // ------------------------------------------------------------- admin list
  listAll: adminQuery
    .input(
      z.object({
        search: z.string().max(128).optional(),
        type: z.enum(MEDIA_TYPES).optional(),
        active: z.boolean().optional(),
      }),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input.active !== undefined) conditions.push(eq(mediaItems.isActive, input.active));
      if (input.type) conditions.push(eq(mediaItems.type, input.type));
      if (input.search) {
        const term = `%${input.search}%`;
        const searchCond = or(
          like(mediaItems.title, term),
          like(mediaItems.description, term),
          like(mediaItems.category, term),
        );
        if (searchCond) conditions.push(searchCond);
      }
      const list = await db
        .select()
        .from(mediaItems)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(mediaItems.createdAt));

      const urls = await resolveMediaUrls(list);
      const teamIds = [...new Set(list.map((m) => m.teamId).filter((t): t is number => !!t))];
      const tournamentIds = [...new Set(list.map((m) => m.tournamentId).filter((t): t is number => !!t))];
      const teamList = teamIds.length
        ? await db.select().from(teams).where(sql`${teams.id} in (${sql.join(teamIds.map((id) => sql`${id}`), sql`, `)})`)
        : [];
      const tournamentList = tournamentIds.length
        ? await db.select().from(tournaments).where(sql`${tournaments.id} in (${sql.join(tournamentIds.map((id) => sql`${id}`), sql`, `)})`)
        : [];

      return list.map((m) => ({
        ...m,
        fileUrl: m.fileKey ? (urls[m.fileKey] ?? null) : null,
        thumbnailUrl: m.thumbnailKey ? (urls[m.thumbnailKey] ?? null) : null,
        embedUrl: m.youtubeVideoId ? youtubeEmbedUrl(m.youtubeVideoId) : null,
        tags: parseTags(m.tags),
        team: teamList.find((t) => t.id === m.teamId) ?? null,
        tournament: tournamentList.find((t) => t.id === m.tournamentId) ?? null,
      }));
    }),

  // --------------------------------------------------------- admin create
  create: adminQuery
    .input(
      z.object({
        title: z.string().min(1).max(TITLE_MAX),
        description: z.string().max(DESC_MAX).nullish(),
        type: z.enum(MEDIA_TYPES),
        // Uploaded file (photo/video) — either inline base64 or a pre-uploaded key.
        fileBase64: z.string().nullish(),
        fileName: z.string().max(512).nullish(),
        fileContentType: z.string().max(128).nullish(),
        fileKey: z.string().max(512).nullish(),
        // YouTube
        youtubeUrl: z.string().max(1024).nullish(),
        // Google Drive
        driveUrl: z.string().max(1024).nullish(),
        // Optional thumbnail for video uploads
        thumbnailKey: z.string().max(512).nullish(),
        // Categorization
        category: z.string().max(CATEGORY_MAX).nullish(),
        teamId: z.number().optional(),
        tournamentId: z.number().optional(),
        tags: z.array(z.string().max(64)).max(8).nullish(),
        featured: z.boolean().optional(),
        displayOrder: z.number().int().optional(),
        uploadDate: z.string().datetime().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const title = sanitize(input.title, TITLE_MAX);
      if (!title) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Title is required." });
      }

      const type = input.type;
      let fileKey: string | null = input.fileKey ?? null;
      let youtubeVideoId: string | null = null;
      let driveUrl: string | null = null;
      const thumbnailKey: string | null = input.thumbnailKey ?? null;

      if (type === "photo" || type === "video") {
        // Accept either an inline base64 upload or a pre-uploaded storage key.
        if (input.fileBase64 && input.fileName) {
          const bytes = Uint8Array.from(Buffer.from(input.fileBase64, "base64"));
          const contentType = input.fileContentType ?? "application/octet-stream";
          const isVideo = ALLOWED_VIDEO_TYPES.has(contentType);
          const isImage = ALLOWED_IMAGE_TYPES.has(contentType);
          if (type === "video" && !isVideo) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Only video files (MP4, WebM, MOV) are allowed." });
          }
          if (type === "photo" && !isImage) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Only image files (PNG, JPG, WebP, GIF, AVIF, SVG) are allowed." });
          }
          const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
          if (bytes.byteLength > maxBytes) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `File is too large. Maximum size is ${maxBytes / 1024 / 1024} MB.`,
            });
          }
          const safeName = input.fileName.replace(/[\\/]/g, "_").slice(0, 200);
          const saved = await storage.uploadMediaFile({
            fileContent: bytes,
            fileName: safeName,
            contentType,
          });
          fileKey = saved.key;
        } else if (!fileKey) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "A file is required." });
        }
      } else if (type === "youtube") {
        if (!input.youtubeUrl) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "YouTube URL is required." });
        }
        youtubeVideoId = extractYouTubeVideoId(input.youtubeUrl);
        if (!youtubeVideoId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid YouTube URL or video ID." });
        }
      } else if (type === "drive") {
        if (!input.driveUrl) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Google Drive URL is required." });
        }
        const parsed = parseDriveUrl(input.driveUrl);
        if (!parsed) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid Google Drive share URL." });
        }
        driveUrl = parsed.url;
      }

      // Validate tags against the allowed set.
      const tags = (input.tags ?? []).filter((t) => (MEDIA_TAGS as readonly string[]).includes(t));

      // Validate associations exist.
      if (input.teamId) {
        const team = await db.query.teams.findFirst({ where: eq(teams.id, input.teamId) });
        if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found." });
      }
      if (input.tournamentId) {
        const tournament = await db.query.tournaments.findFirst({ where: eq(tournaments.id, input.tournamentId) });
        if (!tournament) throw new TRPCError({ code: "NOT_FOUND", message: "Tournament not found." });
      }

      const [{ id }] = await db
        .insert(mediaItems)
        .values({
          title,
          description: input.description ? sanitize(input.description, DESC_MAX) : null,
          type,
          fileKey,
          thumbnailKey,
          youtubeVideoId,
          driveUrl,
          category: input.category ? sanitize(input.category, CATEGORY_MAX) : null,
          teamId: input.teamId ?? null,
          tournamentId: input.tournamentId ?? null,
          tags: tags.length ? JSON.stringify(tags) : null,
          featured: input.featured ?? false,
          displayOrder: input.displayOrder ?? 0,
          isActive: true,
          uploadDate: input.uploadDate ? new Date(input.uploadDate) : new Date(),
        })
        .$returningId();

      return { id };
    }),

  // ---------------------------------------------------------- admin update
  update: adminQuery
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).max(TITLE_MAX).optional(),
        description: z.string().max(DESC_MAX).nullish().optional(),
        category: z.string().max(CATEGORY_MAX).nullish().optional(),
        teamId: z.number().nullish().optional(),
        tournamentId: z.number().nullish().optional(),
         tags: z.array(z.string().max(64)).max(8).nullish().optional(),
         featured: z.boolean().optional(),
         displayOrder: z.number().int().optional(),
         isActive: z.boolean().optional(),
         uploadDate: z.string().datetime().optional(),
         driveUrl: z.string().max(1024).nullish().optional(),
         youtubeUrl: z.string().max(1024).nullish().optional(),
         albumId: z.number().nullish().optional(),
       }),
     )
     .mutation(async ({ input }) => {
      const db = getDb();
      const existing = await db.query.mediaItems.findFirst({ where: eq(mediaItems.id, input.id) });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Media item not found." });
      }

      const updateData: Record<string, unknown> = {};
      if (input.title !== undefined) {
        const title = sanitize(input.title, TITLE_MAX);
        if (!title) throw new TRPCError({ code: "BAD_REQUEST", message: "Title is required." });
        updateData.title = title;
      }
      if (input.description !== undefined) {
        updateData.description = input.description ? sanitize(input.description, DESC_MAX) : null;
      }
      if (input.category !== undefined) {
        updateData.category = input.category ? sanitize(input.category, CATEGORY_MAX) : null;
      }
      if (input.teamId !== undefined) updateData.teamId = input.teamId ?? null;
      if (input.tournamentId !== undefined) updateData.tournamentId = input.tournamentId ?? null;
      if (input.tags !== undefined) {
        const tags = (input.tags ?? []).filter((t) => (MEDIA_TAGS as readonly string[]).includes(t));
        updateData.tags = tags.length ? JSON.stringify(tags) : null;
      }
      if (input.featured !== undefined) updateData.featured = input.featured;
      if (input.displayOrder !== undefined) updateData.displayOrder = input.displayOrder;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;
      if (input.uploadDate !== undefined) updateData.uploadDate = new Date(input.uploadDate);
      if (input.driveUrl !== undefined) {
        if (input.driveUrl) {
          const parsed = parseDriveUrl(input.driveUrl);
          if (!parsed) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid Google Drive share URL." });
          updateData.driveUrl = parsed.url;
        } else {
          updateData.driveUrl = null;
        }
      }
       if (input.youtubeUrl !== undefined) {
        if (input.youtubeUrl) {
          const videoId = extractYouTubeVideoId(input.youtubeUrl);
          if (!videoId) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid YouTube URL or video ID." });
          updateData.youtubeVideoId = videoId;
        } else {
          updateData.youtubeVideoId = null;
        }
      }
      if (input.albumId !== undefined) {
        if (input.albumId) {
          const album = await db.query.mediaAlbums.findFirst({ where: eq(mediaAlbums.id, input.albumId) });
          if (!album) throw new TRPCError({ code: "NOT_FOUND", message: "Album not found." });
        }
        updateData.albumId = input.albumId ?? null;
      }

      if (Object.keys(updateData).length > 0) {
        await db.update(mediaItems).set(updateData).where(eq(mediaItems.id, input.id));
      }
      return { ok: true };
    }),

  // ---------------------------------------------------------- admin delete
  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const existing = await db.query.mediaItems.findFirst({ where: eq(mediaItems.id, input.id) });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Media item not found." });
      }
      // Delete the uploaded file (if any).
      if (existing.fileKey) {
        try {
          await storage.deleteFile({ fileKey: existing.fileKey });
        } catch {
          // object may already be gone
        }
      }
      if (existing.thumbnailKey) {
        try {
          await storage.deleteFile({ fileKey: existing.thumbnailKey });
        } catch {
          // ignore
        }
      }
      await db.delete(mediaItems).where(eq(mediaItems.id, input.id));
      return { ok: true };
    }),

  // ------------------------------------------------- admin feature/unfeature
  setFeatured: adminQuery
    .input(z.object({ id: z.number(), featured: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const existing = await db.query.mediaItems.findFirst({ where: eq(mediaItems.id, input.id) });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Media item not found." });
      }
      await db.update(mediaItems).set({ featured: input.featured }).where(eq(mediaItems.id, input.id));
      return { ok: true };
    }),

  // =========================================================
  // ALBUMS
  // =========================================================

  // --------------------------------------------------- public album list
  albumList: publicQuery
    .input(
      z.object({
        teamId: z.number().optional(),
        tournamentId: z.number().optional(),
        category: z.string().max(CATEGORY_MAX).optional(),
        tag: z.string().max(64).optional(),
        search: z.string().max(128).optional(),
        sort: z.enum(MEDIA_SORT_OPTIONS).optional(),
        limit: z.number().int().min(1).max(50).optional(),
        cursor: z.number().optional(),
      }),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const limit = input.limit ?? 36;
      const cursor = input.cursor ?? 0;

      const conditions = [eq(mediaAlbums.status, "published")];
      if (input.teamId) conditions.push(eq(mediaAlbums.teamId, input.teamId));
      if (input.tournamentId) conditions.push(eq(mediaAlbums.tournamentId, input.tournamentId));
      if (input.category) conditions.push(eq(mediaAlbums.category, input.category));
      if (input.tag) {
        conditions.push(sql`JSON_CONTAINS(${mediaAlbums.tags}, JSON_QUOTE(${input.tag}))`);
      }
      if (input.search) {
        const term = `%${input.search}%`;
        const searchCond = or(
          like(mediaAlbums.title, term),
          like(mediaAlbums.description, term),
          like(mediaAlbums.category, term),
        );
        if (searchCond) conditions.push(searchCond);
      }

      const orderByMap: Record<MediaSortOption, ReturnType<typeof desc>[]> = {
        newest: [desc(mediaAlbums.eventDate), desc(mediaAlbums.displayOrder), desc(mediaAlbums.id)],
        oldest: [asc(mediaAlbums.eventDate), asc(mediaAlbums.displayOrder), asc(mediaAlbums.id)],
        featured: [desc(mediaAlbums.displayOrder), desc(mediaAlbums.eventDate), desc(mediaAlbums.id)],
        title: [asc(mediaAlbums.title)],
      };
      const sort = input.sort ?? "newest";

      const list = await db
        .select()
        .from(mediaAlbums)
        .where(and(...conditions))
        .orderBy(...orderByMap[sort])
        .limit(limit + 1)
        .offset(cursor);

      const hasMore = list.length > limit;
      const page = list.slice(0, limit);

      const coverKeys = [...new Set(page.map((a) => a.coverKey).filter((k): k is string => !!k))];
      const urls = coverKeys.length ? await signKeys(coverKeys) : {};

      // Resolve item counts + team/tournament names.
      const albumIds = page.map((a) => a.id);
      const counts = albumIds.length
        ? await db
            .select({ albumId: mediaItems.albumId, count: sql<number>`count(*)` })
            .from(mediaItems)
            .where(
              and(
                sql`${mediaItems.albumId} in (${sql.join(albumIds.map((id) => sql`${id}`), sql`, `)})`,
                eq(mediaItems.isActive, true),
              ),
            )
            .groupBy(mediaItems.albumId)
        : [];

      const teamIds = [...new Set(page.map((a) => a.teamId).filter((t): t is number => !!t))];
      const tournamentIds = [...new Set(page.map((a) => a.tournamentId).filter((t): t is number => !!t))];
      const teamList = teamIds.length
        ? await db.select().from(teams).where(sql`${teams.id} in (${sql.join(teamIds.map((id) => sql`${id}`), sql`, `)})`)
        : [];
      const tournamentList = tournamentIds.length
        ? await db.select().from(tournaments).where(sql`${tournaments.id} in (${sql.join(tournamentIds.map((id) => sql`${id}`), sql`, `)})`)
        : [];

      const countMap = new Map(counts.map((c) => [Number(c.albumId), Number(c.count)]));

      return {
        albums: page.map((a) => ({
          ...a,
          coverUrl: a.coverKey ? (urls[a.coverKey] ?? null) : null,
          mediaCount: countMap.get(a.id) ?? 0,
          tags: parseTags(a.tags),
          team: teamList.find((t) => t.id === a.teamId) ?? null,
          tournament: tournamentList.find((t) => t.id === a.tournamentId) ?? null,
        })),
        hasMore,
        nextCursor: hasMore ? cursor + limit : null,
      };
    }),

  // --------------------------------------------------- public album detail
  albumGet: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const album = await db.query.mediaAlbums.findFirst({
        where: and(eq(mediaAlbums.id, input.id), eq(mediaAlbums.status, "published")),
      });
      if (!album) return null;

      const items = await db
        .select()
        .from(mediaItems)
        .where(and(eq(mediaItems.albumId, album.id), eq(mediaItems.isActive, true)))
        .orderBy(asc(mediaItems.displayOrder), desc(mediaItems.uploadDate), asc(mediaItems.id));

      const links = await db
        .select()
        .from(mediaAlbumLinks)
        .where(eq(mediaAlbumLinks.albumId, album.id))
        .orderBy(asc(mediaAlbumLinks.displayOrder));

      const coverKeys = [
        ...new Set(
          items
            .flatMap((i) => [i.thumbnailKey, i.fileKey])
            .filter((k): k is string => !!k),
        ),
      ];
      if (album.coverKey) coverKeys.push(album.coverKey);
      const urls = coverKeys.length ? await signKeys(coverKeys) : {};

      const team = album.teamId
        ? await db.query.teams.findFirst({ where: eq(teams.id, album.teamId) })
        : null;
      const tournament = album.tournamentId
        ? await db.query.tournaments.findFirst({ where: eq(tournaments.id, album.tournamentId) })
        : null;

      return {
        ...album,
        coverUrl: album.coverKey ? (urls[album.coverKey] ?? null) : null,
        tags: parseTags(album.tags),
        team,
        tournament,
        links,
        mediaCount: items.length,
        items: items.map((m) => ({
          ...m,
          fileUrl: m.fileKey ? (urls[m.fileKey] ?? null) : null,
          thumbnailUrl: m.thumbnailKey ? (urls[m.thumbnailKey] ?? null) : null,
          embedUrl: m.youtubeVideoId ? youtubeEmbedUrl(m.youtubeVideoId) : null,
          watchUrl: m.youtubeVideoId ? `https://www.youtube.com/watch?v=${m.youtubeVideoId}` : null,
          driveFileId: m.driveUrl ? parseDriveUrl(m.driveUrl)?.fileId ?? null : null,
          tags: parseTags(m.tags),
        })),
      };
    }),

  // ------------------------------------------------- admin album list
  albumListAll: adminQuery.query(async () => {
    const db = getDb();
    const list = await db.select().from(mediaAlbums).orderBy(desc(mediaAlbums.createdAt));

    if (list.length === 0) return list;

    const coverKeys = [...new Set(list.map((a) => a.coverKey).filter((k): k is string => !!k))];
    const urls = coverKeys.length ? await signKeys(coverKeys) : {};

    const albumIds = list.map((a) => a.id);
    const counts = await db
      .select({ albumId: mediaItems.albumId, count: sql<number>`count(*)` })
      .from(mediaItems)
      .where(
        and(
          sql`${mediaItems.albumId} in (${sql.join(albumIds.map((id) => sql`${id}`), sql`, `)})`,
          eq(mediaItems.isActive, true),
        ),
      )
      .groupBy(mediaItems.albumId);
    const countMap = new Map(counts.map((c) => [Number(c.albumId), Number(c.count)]));

    const teamIds = [...new Set(list.map((a) => a.teamId).filter((t): t is number => !!t))];
    const tournamentIds = [...new Set(list.map((a) => a.tournamentId).filter((t): t is number => !!t))];
    const teamList = teamIds.length
      ? await db.select().from(teams).where(sql`${teams.id} in (${sql.join(teamIds.map((id) => sql`${id}`), sql`, `)})`)
      : [];
    const tournamentList = tournamentIds.length
      ? await db.select().from(tournaments).where(sql`${tournaments.id} in (${sql.join(tournamentIds.map((id) => sql`${id}`), sql`, `)})`)
      : [];

    return list.map((a) => ({
      ...a,
      coverUrl: a.coverKey ? (urls[a.coverKey] ?? null) : null,
      tags: parseTags(a.tags),
      mediaCount: countMap.get(a.id) ?? 0,
      team: teamList.find((t) => t.id === a.teamId) ?? null,
      tournament: tournamentList.find((t) => t.id === a.tournamentId) ?? null,
    }));
  }),

  // --------------------------------------------------- admin create album
  albumCreate: adminQuery
    .input(
      z.object({
        title: z.string().min(1).max(TITLE_MAX),
        description: z.string().max(DESC_MAX).nullish(),
        eventDate: z.string().datetime().nullish(),
        category: z.string().max(CATEGORY_MAX).nullish(),
        teamId: z.number().nullish(),
        tournamentId: z.number().nullish(),
        tags: z.array(z.string().max(64)).max(8).nullish(),
        coverKey: z.string().max(512).nullish(),
        status: z.enum(ALBUM_STATUSES).default("draft"),
        displayOrder: z.number().int().default(0),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const title = sanitize(input.title, TITLE_MAX);
      if (!title) throw new TRPCError({ code: "BAD_REQUEST", message: "Title is required." });

      // Validate associations.
      if (input.teamId) {
        const team = await db.query.teams.findFirst({ where: eq(teams.id, input.teamId) });
        if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found." });
      }
      if (input.tournamentId) {
        const t = await db.query.tournaments.findFirst({ where: eq(tournaments.id, input.tournamentId) });
        if (!t) throw new TRPCError({ code: "NOT_FOUND", message: "Tournament not found." });
      }

      const validTags = (input.tags ?? []).filter((t) => (MEDIA_TAGS as readonly string[]).includes(t));
      const [{ id }] = await db
        .insert(mediaAlbums)
        .values({
          title,
          description: input.description ? sanitize(input.description, DESC_MAX) : null,
          eventDate: input.eventDate ? new Date(input.eventDate) : null,
          category: input.category ? sanitize(input.category, CATEGORY_MAX) : null,
          teamId: input.teamId ?? null,
          tournamentId: input.tournamentId ?? null,
          tags: validTags.length ? JSON.stringify(validTags) : null,
          coverKey: input.coverKey ?? null,
          status: input.status,
          displayOrder: input.displayOrder,
        })
        .$returningId();
      return { id };
    }),

  // --------------------------------------------------- admin update album
  albumUpdate: adminQuery
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).max(TITLE_MAX).optional(),
        description: z.string().max(DESC_MAX).nullish().optional(),
        eventDate: z.string().datetime().nullish().optional(),
        category: z.string().max(CATEGORY_MAX).nullish().optional(),
        teamId: z.number().nullish().optional(),
        tournamentId: z.number().nullish().optional(),
        tags: z.array(z.string().max(64)).max(8).nullish().optional(),
        coverKey: z.string().max(512).nullish().optional(),
        status: z.enum(ALBUM_STATUSES).optional(),
        displayOrder: z.number().int().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const album = await db.query.mediaAlbums.findFirst({ where: eq(mediaAlbums.id, input.id) });
      if (!album) throw new TRPCError({ code: "NOT_FOUND", message: "Album not found." });

      const updateData: Record<string, unknown> = {};
      if (input.title !== undefined) {
        const title = sanitize(input.title, TITLE_MAX);
        if (!title) throw new TRPCError({ code: "BAD_REQUEST", message: "Title is required." });
        updateData.title = title;
      }
      if (input.description !== undefined) {
        updateData.description = input.description ? sanitize(input.description, DESC_MAX) : null;
      }
      if (input.eventDate !== undefined) {
        updateData.eventDate = input.eventDate ? new Date(input.eventDate) : null;
      }
      if (input.category !== undefined) {
        updateData.category = input.category ? sanitize(input.category, CATEGORY_MAX) : null;
      }
      if (input.teamId !== undefined) updateData.teamId = input.teamId ?? null;
      if (input.tournamentId !== undefined) updateData.tournamentId = input.tournamentId ?? null;
      if (input.tags !== undefined) {
        const tags = (input.tags ?? []).filter((t) => (MEDIA_TAGS as readonly string[]).includes(t));
        updateData.tags = tags.length ? JSON.stringify(tags) : null;
      }
      if (input.coverKey !== undefined) updateData.coverKey = input.coverKey ?? null;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.displayOrder !== undefined) updateData.displayOrder = input.displayOrder;

      if (Object.keys(updateData).length > 0) {
        await db.update(mediaAlbums).set(updateData).where(eq(mediaAlbums.id, input.id));
      }
      return { ok: true };
    }),

  // --------------------------------------------------- admin delete album
  albumDelete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const album = await db.query.mediaAlbums.findFirst({ where: eq(mediaAlbums.id, input.id) });
      if (!album) throw new TRPCError({ code: "NOT_FOUND", message: "Album not found." });

      // Delete the cover file.
      if (album.coverKey) {
        try { await storage.deleteFile({ fileKey: album.coverKey }); } catch {
          /* best-effort delete */
        }
      }
      // Disassociate items (set albumId NULL).
      await db.update(mediaItems).set({ albumId: null }).where(eq(mediaItems.albumId, album.id));
      // Delete album links.
      await db.delete(mediaAlbumLinks).where(eq(mediaAlbumLinks.albumId, album.id));
      await db.delete(mediaAlbums).where(eq(mediaAlbums.id, album.id));
      return { ok: true };
    }),

  // ----------------------------------------------- admin bulk-upload items
  albumBulkUpload: adminQuery
    .input(
      z.object({
        albumId: z.number(),
        items: z.array(
          z.object({
            title: z.string().min(1).max(TITLE_MAX),
            description: z.string().max(DESC_MAX).nullish(),
            type: z.enum(MEDIA_TYPES),
            fileBase64: z.string().optional(),
            fileName: z.string().max(512).optional(),
            fileContentType: z.string().max(128).optional(),
            fileKey: z.string().max(512).optional(),
            youtubeUrl: z.string().max(1024).nullish(),
            driveUrl: z.string().max(1024).nullish(),
            caption: z.string().max(DESC_MAX).nullish(),
            displayOrder: z.number().int().optional(),
          }),
        ).max(ALBUM_BULK_UPLOAD_LIMIT),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const album = await db.query.mediaAlbums.findFirst({ where: eq(mediaAlbums.id, input.albumId) });
      if (!album) throw new TRPCError({ code: "NOT_FOUND", message: "Album not found." });

      const created: { id: number }[] = [];
      for (let i = 0; i < input.items.length; i++) {
        const item = input.items[i];
        const title = sanitize(item.title, TITLE_MAX);
        if (!title) throw new TRPCError({ code: "BAD_REQUEST", message: `Item ${i + 1}: title is required.` });

        let fileKey: string | null = item.fileKey ?? null;
        let youtubeVideoId: string | null = null;
        let driveUrlVal: string | null = null;

        if (item.type === "photo" || item.type === "video") {
          if (item.fileBase64 && item.fileName) {
            const bytes = Uint8Array.from(Buffer.from(item.fileBase64, "base64"));
            const ct = item.fileContentType ?? "application/octet-stream";
            const isVideo = ALLOWED_VIDEO_TYPES.has(ct);
            const isImage = ALLOWED_IMAGE_TYPES.has(ct);
            if (item.type === "video" && !isVideo) {
              throw new TRPCError({ code: "BAD_REQUEST", message: `Item ${i + 1}: only video files allowed.` });
            }
            if (item.type === "photo" && !isImage) {
              throw new TRPCError({ code: "BAD_REQUEST", message: `Item ${i + 1}: only image files allowed.` });
            }
            const max = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
            if (bytes.byteLength > max) {
              throw new TRPCError({ code: "BAD_REQUEST", message: `Item ${i + 1}: file too large.` });
            }
            const safeName = item.fileName.replace(/[\\/]/g, "_").slice(0, 200);
            const saved = await storage.uploadMediaFile({ fileContent: bytes, fileName: safeName, contentType: ct });
            fileKey = saved.key;
          } else if (!fileKey) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `Item ${i + 1}: a file is required.` });
          }
        } else if (item.type === "youtube") {
          if (!item.youtubeUrl) throw new TRPCError({ code: "BAD_REQUEST", message: `Item ${i + 1}: YouTube URL required.` });
          youtubeVideoId = extractYouTubeVideoId(item.youtubeUrl);
          if (!youtubeVideoId) throw new TRPCError({ code: "BAD_REQUEST", message: `Item ${i + 1}: invalid YouTube URL.` });
        } else if (item.type === "drive") {
          if (!item.driveUrl) throw new TRPCError({ code: "BAD_REQUEST", message: `Item ${i + 1}: Drive URL required.` });
          const parsed = parseDriveUrl(item.driveUrl);
          if (!parsed) throw new TRPCError({ code: "BAD_REQUEST", message: `Item ${i + 1}: invalid Drive URL.` });
          driveUrlVal = parsed.url;
        }

        // Store caption in the description field (frontloaded for reuse).
        const desc = item.caption ? sanitize(item.caption, DESC_MAX) : null;

        const [{ id }] = await db
          .insert(mediaItems)
          .values({
            title,
            description: desc,
            type: item.type,
            fileKey,
            youtubeVideoId,
            driveUrl: driveUrlVal,
            albumId: album.id,
            isActive: true,
            uploadDate: new Date(),
            displayOrder: item.displayOrder ?? i,
          })
          .$returningId();
        created.push({ id });
      }

      // Set the album cover to the first item's file if no cover set.
      if (!album.coverKey && created.length > 0) {
        const first = await db.query.mediaItems.findFirst({ where: eq(mediaItems.id, created[0].id) });
        if (first?.fileKey) {
          await db.update(mediaAlbums).set({ coverKey: first.fileKey }).where(eq(mediaAlbums.id, album.id));
        }
      }

      return { count: created.length, ids: created };
    }),

  // ------------------------------------------- admin reorder album items
  albumReorderItems: adminQuery
    .input(
      z.object({
        albumId: z.number(),
        order: z.array(z.object({ id: z.number(), displayOrder: z.number().int() })),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      for (const { id, displayOrder } of input.order) {
        await db.update(mediaItems).set({ displayOrder }).where(eq(mediaItems.id, id));
      }
      return { ok: true };
    }),

  // ----------------------------------------------- admin album links CRUD
  albumLinks: adminQuery
    .input(z.object({ albumId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return await db
        .select()
        .from(mediaAlbumLinks)
        .where(eq(mediaAlbumLinks.albumId, input.albumId))
        .orderBy(asc(mediaAlbumLinks.displayOrder));
    }),

  albumLinkUpsert: adminQuery
    .input(
      z.object({
        id: z.number().optional(),
        albumId: z.number(),
        label: z.string().min(1).max(LINK_LABEL_MAX),
        url: z.string().min(1).max(LINK_URL_MAX),
        displayOrder: z.number().int().default(0),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      if (input.id) {
        await db
          .update(mediaAlbumLinks)
          .set({ label: sanitize(input.label, LINK_LABEL_MAX), url: sanitizeUrl(input.url), displayOrder: input.displayOrder })
          .where(eq(mediaAlbumLinks.id, input.id));
      } else {
        await db.insert(mediaAlbumLinks).values({
          albumId: input.albumId,
          label: sanitize(input.label, LINK_LABEL_MAX),
          url: sanitizeUrl(input.url),
          displayOrder: input.displayOrder,
        });
      }
      return { ok: true };
    }),

  albumLinkDelete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(mediaAlbumLinks).where(eq(mediaAlbumLinks.id, input.id));
      return { ok: true };
    }),

  // ----------------------------- admin: bulk-delete album items
  albumBulkDeleteItems: adminQuery
    .input(z.object({ albumId: z.number(), ids: z.array(z.number()).min(1).max(100) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      for (const id of input.ids) {
        const item = await db.query.mediaItems.findFirst({
          where: and(eq(mediaItems.id, id), eq(mediaItems.albumId, input.albumId)),
        });
        if (item?.fileKey) {
          try { await storage.deleteFile({ fileKey: item.fileKey }); } catch {
            /* best-effort delete */
          }
        }
      }
      await db
        .update(mediaItems)
        .set({ isActive: false })
        .where(
          and(
            sql`${mediaItems.id} in (${sql.join(input.ids.map((id) => sql`${id}`), sql`, `)})`,
            eq(mediaItems.albumId, input.albumId),
          ),
        );
      return { ok: true };
    }),

  // ----------------------------------- public: download album photos ZIP
  albumDownloadPhotos: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const album = await db.query.mediaAlbums.findFirst({
        where: and(eq(mediaAlbums.id, input.id), eq(mediaAlbums.status, "published")),
      });
      if (!album) throw new TRPCError({ code: "NOT_FOUND", message: "Album not found." });

      const photoItems = await db
        .select()
        .from(mediaItems)
        .where(
          and(
            eq(mediaItems.albumId, album.id),
            eq(mediaItems.isActive, true),
            eq(mediaItems.type, "photo"),
          ),
        )
        .orderBy(asc(mediaItems.displayOrder));

      if (photoItems.length === 0) {
        return { entries: 0, note: "This album has no downloadable photos." };
      }

      const files: { name: string; data: Uint8Array }[] = [];
      for (const m of photoItems) {
        if (m.fileKey) {
          const bytes = await resolveFileBytes(m.fileKey);
          if (bytes) {
            files.push({ name: m.fileKey.split("/").pop() ?? `photo_${m.id}.jpg`, data: bytes });
          }
        }
      }

       if (files.length === 0) {
         return {
           entries: 0,
           note: "Photos could not be downloaded directly. Please open each photo and save it manually.",
         };
       }

      const zipBuffer = buildZip(files);
      return {
        entries: files.length,
        zip: Buffer.from(zipBuffer).toString("base64"),
        contentType: "application/zip",
      };
    }),

  // ------------------------------------------------------- admin config
  getConfig: adminQuery.query(async () => {
    return await loadConfig();
  }),

  updateConfig: adminQuery
    .input(z.object({ config: z.record(z.string(), z.boolean()) }))
    .mutation(async ({ input }) => {
      // Only accept known keys; ignore anything else.
      const known = Object.keys(MEDIA_PAGE_DEFAULT_CONFIG) as (keyof MediaPageConfig)[];
      const clean: MediaPageConfig = {};
      for (const key of known) {
        const value = input.config[key];
        if (typeof value === "boolean") {
          clean[key] = value;
        }
      }
      await saveConfig(clean);
      return { ok: true, config: await loadConfig() };
    }),
});

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((t): t is string => typeof t === "string");
    }
  } catch {
    // fall through
  }
  return [];
}

function sanitizeUrl(input: string): string {
  const trimmed = input.trim();
  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid URL." });
  }
}

/** Read file bytes from local storage for ZIP generation. */
async function downloadFileBytes(fileKey: string): Promise<Uint8Array | null> {
  return storage.readBytes(fileKey);
}

/** Resolve a storage key to a local file path and read its bytes for ZIP. */
function resolveFileBytes(key: string): Promise<Uint8Array | null> {
  return downloadFileBytes(key);
}
