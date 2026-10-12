import { z } from "zod";
import { and, desc, eq, like, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { signKeys } from "./lib/images";
import { extractYouTubeVideoId, youtubeEmbedUrl } from "./lib/youtube";
import { fanSpotlight, users, mediaItems, media } from "../db/schema";

const TITLE_MAX = 255;
const DESC_MAX = 2000;
const ADMIN_NOTES_MAX = 2000;
const URL_MAX = 1024;
const THUMBNAIL_URL_MAX = 512;
const BUTTON_TEXT_MAX = 128;
const TAG_MAX = 64;
const TAGS_MAX = 10;

const SPOTLIGHT_CATEGORIES = [
  "edit_reel",
  "fan_art",
  "montage",
  "highlight",
  "posters",
  "thumbnail",
  "other",
] as const;

export type SpotlightCategory = (typeof SPOTLIGHT_CATEGORIES)[number];

const SPOTLIGHT_STATUS = ["draft", "pending", "approved", "rejected"] as const;
export type SpotlightStatus = (typeof SPOTLIGHT_STATUS)[number];

function sanitize(text: string | null | undefined, max: number): string | null {
  if (!text) return null;
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim().slice(0, max);
}

function isValidUrl(input: string): boolean {
  try {
    const url = new URL(input);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isYouTubeUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return h.includes("youtube.com") || h.includes("youtu.be");
  } catch {
    return false;
  }
}

function parseTags(input: string | string[] | null | undefined): string[] {
  if (!input) return [];
  let arr: string[];
  if (Array.isArray(input)) {
    arr = input;
  } else if (typeof input === "string") {
    arr = input.split(",").map((t) => t.trim());
  } else {
    return [];
  }
  return arr.filter((t) => t.length > 0).slice(0, TAGS_MAX);
}

function joinTags(tags: string[]): string | null {
  const trimmed = tags.map((t) => t.trim()).filter((t) => t.length > 0).slice(0, TAGS_MAX);
  return trimmed.length > 0 ? trimmed.join(",") : null;
}

async function resolveThumbnailUrl(
  entry: typeof fanSpotlight.$inferSelect,
  db: ReturnType<typeof getDb>,
): Promise<string | null> {
  if (entry.thumbnailUrl) return entry.thumbnailUrl;

  if (entry.thumbnailKey) {
    const urls = await signKeys([entry.thumbnailKey]);
    return urls[entry.thumbnailKey] ?? null;
  }

  if (entry.mediaItemId) {
    const item = await db.query.mediaItems.findFirst({
      where: eq(mediaItems.id, entry.mediaItemId),
    });
    if (item?.fileKey) {
      const urls = await signKeys([item.fileKey]);
      return urls[item.fileKey] ?? null;
    }
    if (item?.thumbnailKey) {
      const urls = await signKeys([item.thumbnailKey]);
      return urls[item.thumbnailKey] ?? null;
    }
  }

  if (entry.youtubeVideoId) {
    return `https://i.ytimg.com/vi/${entry.youtubeVideoId}/hqdefault.jpg`;
  }

  return null;
}

async function resolveAdditionalImageUrls(
  entry: typeof fanSpotlight.$inferSelect,
): Promise<string[]> {
  if (!entry.additionalImageKeys) return [];
  const keys = entry.additionalImageKeys
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
  if (keys.length === 0) return [];
  const urls = await signKeys(keys);
  return keys.map((k) => urls[k]).filter((u): u is string => !!u);
}

async function resolveEmbedUrl(entry: typeof fanSpotlight.$inferSelect): Promise<string | null> {
  if (entry.embedUrl) return entry.embedUrl;

  if (entry.youtubeVideoId) {
    return youtubeEmbedUrl(entry.youtubeVideoId);
  }
  if (entry.contentUrl && isYouTubeUrl(entry.contentUrl)) {
    const videoId = extractYouTubeVideoId(entry.contentUrl);
    if (videoId) return youtubeEmbedUrl(videoId);
  }
  return null;
}

async function resolveCreator(entry: typeof fanSpotlight.$inferSelect, db: ReturnType<typeof getDb>) {
  if (!entry.userId) return null;
  const dbEntry = await db.query.users.findFirst({
    where: eq(users.id, entry.userId),
    columns: {
      id: true,
      username: true,
      name: true,
      avatar: true,
      email: true,
    },
  });
  return dbEntry
    ? {
        id: dbEntry.id,
        username: dbEntry.username,
        name: dbEntry.name,
        avatar: dbEntry.avatar,
      }
    : null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SpotlightEntrySchema = z.object({
  id: z.number(),
  userId: z.number().nullable(),
  fanName: z.string().nullable(),
  creatorProfileUrl: z.string().nullable(),
  title: z.string(),
  subtitle: z.string().nullable(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  contentUrl: z.string().nullable(),
  youtubeVideoId: z.string().nullable(),
  embedUrl: z.string().nullable(),
  thumbnailKey: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  mediaItemId: z.number().nullable(),
  additionalImageKeys: z.array(z.string()).nullable(),
  buttonText: z.string().nullable(),
  buttonUrl: z.string().nullable(),
  accentColor: z.string().nullable(),
  cardStyle: z.enum(["grid", "card", "banner"]),
  isApproved: z.boolean(),
  isFeatured: z.boolean(),
  displayOrder: z.number(),
  publishDate: z.date().nullable(),
  status: z.enum(SPOTLIGHT_STATUS),
  adminNotes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  thumbnailResolved: z.string().nullable(),
  embedUrlResolved: z.string().nullable(),
  additionalImagesResolved: z.array(z.string()).nullable(),
  creator: z
    .object({
      id: z.number(),
      username: z.string().nullable(),
      name: z.string().nullable(),
      avatar: z.string().nullable(),
    })
    .nullable(),
});

async function mapEntry(entry: typeof fanSpotlight.$inferSelect, db: ReturnType<typeof getDb>) {
  const [thumbnailResolved, embedUrlResolved, additionalImagesResolved, creator] = await Promise.all([
    resolveThumbnailUrl(entry, db),
    resolveEmbedUrl(entry),
    resolveAdditionalImageUrls(entry),
    resolveCreator(entry, db),
  ]);
  return {
    id: entry.id,
    userId: entry.userId,
    fanName: entry.fanName ?? null,
    creatorProfileUrl: entry.creatorProfileUrl ?? null,
    title: entry.title,
    subtitle: entry.subtitle ?? null,
    description: entry.description ?? null,
    category: entry.category ?? null,
    tags: entry.tags ? parseTags(entry.tags) : null,
    contentUrl: entry.contentUrl ?? null,
    youtubeVideoId: entry.youtubeVideoId ?? null,
     embedUrl: embedUrlResolved ?? (entry.embedUrl ?? null),
    thumbnailKey: entry.thumbnailKey ?? null,
    thumbnailUrl: entry.thumbnailUrl ?? null,
    mediaItemId: entry.mediaItemId ?? null,
    additionalImageKeys: entry.additionalImageKeys ? parseTags(entry.additionalImageKeys) : null,
    buttonText: entry.buttonText ?? null,
    buttonUrl: entry.buttonUrl ?? null,
    accentColor: entry.accentColor ?? null,
    cardStyle: entry.cardStyle ?? "card",
    isApproved: entry.isApproved,
    isFeatured: entry.isFeatured,
    displayOrder: entry.displayOrder,
    publishDate: entry.publishDate ? new Date(entry.publishDate) : null,
    status: entry.status ?? "draft",
    adminNotes: entry.adminNotes ?? null,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    thumbnailResolved,
    embedUrlResolved,
    additionalImagesResolved: additionalImagesResolved.length > 0 ? additionalImagesResolved : null,
    creator,
  };
}

type SpotlightEntry = z.infer<typeof SpotlightEntrySchema>;

export const fanSpotlightRouter = createRouter({
  // ------------------------------------------------------------------ public list
  list: publicQuery
    .input(
      z.object({
        category: z.enum(SPOTLIGHT_CATEGORIES).optional(),
        featuredOnly: z.boolean().optional(),
        limit: z.number().int().min(1).max(50).optional(),
        cursor: z.number().optional(),
      }),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const limit = input.limit ?? 24;
      const cursor = input.cursor ?? 0;
      const now = new Date();

      const conditions = [eq(fanSpotlight.isApproved, true)];
      if (input.category) conditions.push(eq(fanSpotlight.category, input.category));
      if (input.featuredOnly) conditions.push(eq(fanSpotlight.isFeatured, true));

      const list = await db
        .select()
        .from(fanSpotlight)
        .where(and(...conditions))
        .orderBy(desc(fanSpotlight.isFeatured), desc(fanSpotlight.displayOrder), desc(fanSpotlight.createdAt))
        .limit(limit + 1)
        .offset(cursor);

      // Filter by publish date in JS (entries without publishDate are immediately visible)
      const published = list.filter((e) => !e.publishDate || new Date(e.publishDate) <= now);
      const hasMore = published.length > limit;
      const page = published.slice(0, limit);

      const results: SpotlightEntry[] = [];
      for (const entry of page) {
        results.push(await mapEntry(entry, db));
      }

      return {
        items: results,
        hasMore,
        nextCursor: published.length > limit ? cursor + limit : null,
      };
    }),

  // ------------------------------------------------------- public featured list
  featured: publicQuery.query(async () => {
    const db = getDb();
    const now = new Date();

    const list = await db
      .select()
      .from(fanSpotlight)
      .where(and(eq(fanSpotlight.isApproved, true), eq(fanSpotlight.isFeatured, true)))
      .orderBy(desc(fanSpotlight.displayOrder), desc(fanSpotlight.createdAt))
      .limit(6);

    const published = list.filter((e) => !e.publishDate || new Date(e.publishDate) <= now);

    const results: SpotlightEntry[] = [];
    for (const entry of published) {
      results.push(await mapEntry(entry, db));
    }

    return { items: results };
  }),

  // --------------------------------------------------------- admin list all
  listAll: adminQuery
    .input(
      z.object({
        search: z.string().max(128).optional(),
        status: z.enum(SPOTLIGHT_STATUS).optional(),
        category: z.enum(SPOTLIGHT_CATEGORIES).optional(),
      }).optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];

      if (input?.status) {
        conditions.push(eq(fanSpotlight.status, input.status));
      }
      if (input?.category) {
        conditions.push(eq(fanSpotlight.category, input.category));
      }
      if (input?.search) {
        const term = `%${input.search}%`;
        conditions.push(
          or(
            like(fanSpotlight.title, term),
            like(fanSpotlight.description ?? "", term),
            like(fanSpotlight.category ?? "", term),
          ),
        );
      }

      const list = await db
        .select()
        .from(fanSpotlight)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(
          desc(fanSpotlight.isFeatured),
          desc(fanSpotlight.isApproved),
          desc(fanSpotlight.displayOrder),
          desc(fanSpotlight.createdAt),
        );

      const results: SpotlightEntry[] = [];
      for (const entry of list) {
        results.push(await mapEntry(entry, db));
      }

      return results;
    }),

  // --------------------------------------------------------- admin get by id
  getById: adminQuery.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = getDb();
    const entry = await db.query.fanSpotlight.findFirst({
      where: eq(fanSpotlight.id, input.id),
    });
    if (!entry) return null;
    return mapEntry(entry, db);
  }),

  // -------------------------------------------------------- public get by id
  getPublic: publicQuery.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = getDb();
    const entry = await db.query.fanSpotlight.findFirst({
      where: and(eq(fanSpotlight.id, input.id), eq(fanSpotlight.isApproved, true)),
    });
    if (!entry) return null;
    return mapEntry(entry, db);
  }),

  // ---------------------------------------------------------- admin create
  create: adminQuery
    .input(
      z.object({
        userId: z.number().int().positive().optional().nullable(),
        fanName: z.string().max(255).nullish(),
        creatorProfileUrl: z.string().max(URL_MAX).nullish(),
        title: z.string().min(1).max(TITLE_MAX),
        subtitle: z.string().max(255).nullish(),
        description: z.string().max(DESC_MAX).nullish(),
        category: z.enum(SPOTLIGHT_CATEGORIES).default("other"),
        tags: z.array(z.string().max(TAG_MAX)).max(TAGS_MAX).optional(),
        contentUrl: z.string().max(URL_MAX).nullish(),
        youtubeVideoId: z.string().max(64).nullish(),
        embedUrl: z.string().max(URL_MAX).nullish(),
        thumbnailKey: z.string().max(512).nullish(),
        thumbnailUrl: z.string().max(THUMBNAIL_URL_MAX).nullish(),
        mediaItemId: z.number().int().positive().nullish(),
        additionalImageKeys: z.array(z.string().max(512)).max(10).optional(),
        buttonText: z.string().max(BUTTON_TEXT_MAX).nullish(),
        buttonUrl: z.string().max(URL_MAX).nullish(),
        accentColor: z.string().max(16).nullish(),
        cardStyle: z.enum(["grid", "card", "banner"]).default("card"),
        isApproved: z.boolean().default(false),
        isFeatured: z.boolean().default(false),
        displayOrder: z.number().int().default(0),
        publishDate: z.coerce.date().nullish(),
        status: z.enum(SPOTLIGHT_STATUS).default("draft"),
        adminNotes: z.string().max(ADMIN_NOTES_MAX).nullish(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();

      // Use authenticated user's ID as fallback (table requires non-null userId)
      const effectiveUserId = input.userId ?? ctx.user?.id ?? null;

      // Validate user exists if provided
      if (effectiveUserId) {
        const userExists = await db.query.users.findFirst({
          where: eq(users.id, effectiveUserId),
          columns: { id: true },
        });
        if (!userExists) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
        }
      }

      // Validate URLs
      if (input.contentUrl && !isValidUrl(input.contentUrl)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid content URL." });
      }
      if (input.creatorProfileUrl && !isValidUrl(input.creatorProfileUrl)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid creator profile URL." });
      }
      if (input.embedUrl && !isValidUrl(input.embedUrl)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid embed URL." });
      }
      if (input.buttonUrl && !isValidUrl(input.buttonUrl)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid button URL." });
      }
      if (input.thumbnailUrl && !isValidUrl(input.thumbnailUrl)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid thumbnail URL." });
      }

      // Validate accent color
      if (input.accentColor && !/^#?[0-9A-Fa-f]{3,8}$/.test(input.accentColor)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid accent color." });
      }

      // Validate media item exists if provided
      if (input.mediaItemId) {
        const item = await db.query.mediaItems.findFirst({
          where: eq(mediaItems.id, input.mediaItemId),
          columns: { id: true },
        });
        if (!item) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Media item not found." });
        }
      }

      // Determine actual publish date
      const dbPublishDate = input.isApproved && input.status === "approved"
        ? input.publishDate ?? new Date()
        : input.publishDate ?? null;

      const title = sanitize(input.title, TITLE_MAX);
      if (!title) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Title is required." });
      }

      const [{ id }] = await db
        .insert(fanSpotlight)
        .values({
          userId: effectiveUserId,
          fanName: input.fanName ? sanitize(input.fanName, 255) : null,
          creatorProfileUrl: input.creatorProfileUrl ? sanitize(input.creatorProfileUrl, URL_MAX) : null,
          title,
          subtitle: input.subtitle ? sanitize(input.subtitle, 255) : null,
          description: input.description ? sanitize(input.description, DESC_MAX) : null,
          category: input.category,
          tags: joinTags(input.tags ?? []),
          contentUrl: input.contentUrl ?? null,
          youtubeVideoId: input.youtubeVideoId ?? null,
          embedUrl: input.embedUrl ?? null,
          thumbnailKey: input.thumbnailKey ?? null,
          thumbnailUrl: input.thumbnailUrl ?? null,
          mediaItemId: input.mediaItemId ?? null,
          additionalImageKeys: joinTags(input.additionalImageKeys ?? []),
          buttonText: input.buttonText ? sanitize(input.buttonText, BUTTON_TEXT_MAX) : null,
          buttonUrl: input.buttonUrl ? sanitize(input.buttonUrl, URL_MAX) : null,
          accentColor: input.accentColor ?? null,
          cardStyle: input.cardStyle,
          isApproved: input.isApproved,
          isFeatured: input.isFeatured,
          displayOrder: input.displayOrder,
          publishDate: dbPublishDate,
          status: input.isApproved ? "approved" : input.status,
          adminNotes: input.adminNotes ? sanitize(input.adminNotes, ADMIN_NOTES_MAX) : null,
        })
        .$returningId();

      return { id, ok: true };
    }),

  // ---------------------------------------------------------- admin update
  update: adminQuery
    .input(
      z.object({
        id: z.number().int().positive(),
        userId: z.number().int().positive().nullish(),
        fanName: z.string().max(255).nullish(),
        creatorProfileUrl: z.string().max(URL_MAX).nullish(),
        title: z.string().min(1).max(TITLE_MAX).optional(),
        subtitle: z.string().max(255).nullish(),
        description: z.string().max(DESC_MAX).nullish(),
        category: z.enum(SPOTLIGHT_CATEGORIES).optional(),
        tags: z.array(z.string().max(TAG_MAX)).max(TAGS_MAX).optional().nullable(),
        contentUrl: z.string().max(URL_MAX).nullish(),
        youtubeVideoId: z.string().max(64).nullish(),
        embedUrl: z.string().max(URL_MAX).nullish(),
        thumbnailKey: z.string().max(512).nullish(),
        thumbnailUrl: z.string().max(THUMBNAIL_URL_MAX).nullish(),
        mediaItemId: z.number().int().positive().nullish(),
        additionalImageKeys: z.array(z.string().max(512)).max(10).optional().nullable(),
        buttonText: z.string().max(BUTTON_TEXT_MAX).nullish(),
        buttonUrl: z.string().max(URL_MAX).nullish(),
        accentColor: z.string().max(16).nullish(),
        cardStyle: z.enum(["grid", "card", "banner"]).optional(),
        isApproved: z.boolean().optional(),
        isFeatured: z.boolean().optional(),
        displayOrder: z.number().int().optional(),
        publishDate: z.coerce.date().nullish(),
        status: z.enum(SPOTLIGHT_STATUS).optional(),
        adminNotes: z.string().max(ADMIN_NOTES_MAX).nullish(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...rest } = input;
      const existing = await db.query.fanSpotlight.findFirst({
        where: eq(fanSpotlight.id, id),
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Spotlight entry not found." });
      }

      // Validate user if provided
      if (rest.userId !== undefined) {
        if (rest.userId !== null) {
          const userExists = await db.query.users.findFirst({
            where: eq(users.id, rest.userId),
            columns: { id: true },
          });
          if (!userExists) {
            throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
          }
        }
      }

      // Validate URLs
      if (rest.contentUrl !== undefined && rest.contentUrl !== null && !isValidUrl(rest.contentUrl)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid content URL." });
      }
      if (rest.creatorProfileUrl !== undefined && rest.creatorProfileUrl !== null && !isValidUrl(rest.creatorProfileUrl)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid creator profile URL." });
      }
      if (rest.embedUrl !== undefined && rest.embedUrl !== null && !isValidUrl(rest.embedUrl)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid embed URL." });
      }
      if (rest.buttonUrl !== undefined && rest.buttonUrl !== null && !isValidUrl(rest.buttonUrl)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid button URL." });
      }
      if (rest.thumbnailUrl !== undefined && rest.thumbnailUrl !== null && !isValidUrl(rest.thumbnailUrl)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid thumbnail URL." });
      }
      if (rest.accentColor !== undefined && rest.accentColor !== null && !/^#?[0-9A-Fa-f]{3,8}$/.test(rest.accentColor)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid accent color." });
      }

      const updateData: Record<string, unknown> = {};

      // Map all fields
      if (rest.title !== undefined) {
        const title = sanitize(rest.title, TITLE_MAX);
        if (!title) throw new TRPCError({ code: "BAD_REQUEST", message: "Title is required." });
        updateData.title = title;
      }
      if (rest.subtitle !== undefined) updateData.subtitle = rest.subtitle !== null ? sanitize(rest.subtitle, 255) : null;
      if (rest.description !== undefined) updateData.description = rest.description !== null ? sanitize(rest.description, DESC_MAX) : null;
      if (rest.category !== undefined) updateData.category = rest.category;
      if (rest.tags !== undefined) updateData.tags = joinTags(rest.tags ?? []);
      if (rest.contentUrl !== undefined) updateData.contentUrl = rest.contentUrl;
      if (rest.youtubeVideoId !== undefined) updateData.youtubeVideoId = rest.youtubeVideoId;
      if (rest.embedUrl !== undefined) updateData.embedUrl = rest.embedUrl;
      if (rest.thumbnailKey !== undefined) updateData.thumbnailKey = rest.thumbnailKey;
      if (rest.thumbnailUrl !== undefined) updateData.thumbnailUrl = rest.thumbnailUrl;
      if (rest.mediaItemId !== undefined) updateData.mediaItemId = rest.mediaItemId;
      if (rest.additionalImageKeys !== undefined) updateData.additionalImageKeys = joinTags(rest.additionalImageKeys ?? []);
      if (rest.buttonText !== undefined) updateData.buttonText = rest.buttonText !== null ? sanitize(rest.buttonText, BUTTON_TEXT_MAX) : null;
      if (rest.buttonUrl !== undefined) updateData.buttonUrl = rest.buttonUrl;
      if (rest.accentColor !== undefined) updateData.accentColor = rest.accentColor;
      if (rest.cardStyle !== undefined) updateData.cardStyle = rest.cardStyle;
      if (rest.displayOrder !== undefined) updateData.displayOrder = rest.displayOrder;
      if (rest.publishDate !== undefined) updateData.publishDate = rest.publishDate;
      if (rest.userId !== undefined) updateData.userId = rest.userId;
      if (rest.fanName !== undefined) updateData.fanName = rest.fanName !== null ? sanitize(rest.fanName, 255) : null;
      if (rest.creatorProfileUrl !== undefined) updateData.creatorProfileUrl = rest.creatorProfileUrl;
      if (rest.status !== undefined) updateData.status = rest.status;
      if (rest.adminNotes !== undefined) updateData.adminNotes = rest.adminNotes !== null ? sanitize(rest.adminNotes, ADMIN_NOTES_MAX) : null;

      // Sync isApproved with status and publishDate
      if (rest.isApproved !== undefined) {
        updateData.isApproved = rest.isApproved;
        if (rest.isApproved) {
          updateData.status = updateData.status ?? "approved";
          updateData.publishDate = updateData.publishDate ?? new Date();
        } else {
          updateData.status = updateData.status ?? "pending";
        }
      }
      if (rest.isFeatured !== undefined) updateData.isFeatured = rest.isFeatured;

      if (Object.keys(updateData).length > 0) {
        await db.update(fanSpotlight).set(updateData).where(eq(fanSpotlight.id, id));
      }

      return { ok: true };
    }),

  // ---------------------------------------------------------- admin delete
  delete: adminQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const existing = await db.query.fanSpotlight.findFirst({
        where: eq(fanSpotlight.id, input.id),
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Spotlight entry not found." });
      }
      await db.delete(fanSpotlight).where(eq(fanSpotlight.id, input.id));
      return { ok: true };
    }),

  // -------------------------------------------------------- admin reorder
  reorder: adminQuery
    .input(
      z.object({
        ids: z.array(z.number().int().positive()).min(1).max(100),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      for (let i = 0; i < input.ids.length; i++) {
        await db
          .update(fanSpotlight)
          .set({ displayOrder: i })
          .where(eq(fanSpotlight.id, input.ids[i]));
      }
      return { ok: true };
    }),

  // ------------------------------------------------------------ admin upload
  uploadImage: adminQuery
    .input(
      z.object({
        name: z.string().min(1).max(400),
        contentBase64: z.string(),
        contentType: z.string().max(128).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { storage } = await import("./lib/storage");
      const MAX_BYTES = 8 * 1024 * 1024;
      const ALLOWED = new Set([
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/gif",
        "image/avif",
        "image/svg+xml",
      ]);
      const bytes = Uint8Array.from(Buffer.from(input.contentBase64, "base64"));
      if (bytes.byteLength > MAX_BYTES) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Image is too large. Maximum size is ${MAX_BYTES / 1024 / 1024} MB.`,
        });
      }
      const contentType = input.contentType ?? "image/png";
      if (!ALLOWED.has(contentType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only image files (PNG, JPG, WebP, GIF, AVIF, SVG) are allowed.",
        });
      }
      const saved = await storage.uploadFile({
        fileContent: bytes,
        fileName: `tsg/spotlight/${input.name}`,
        contentType,
      });
      const { url } = await storage.getPresignedUrl({ key: saved.key });
      return { key: saved.key, size: saved.size, url };
    }),

  // -------------------------------------------------------- admin media list
  mediaList: adminQuery
    .input(
      z.object({
        search: z.string().max(128).optional(),
        limit: z.number().int().min(1).max(50).optional(),
        cursor: z.number().optional(),
      }),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const limit = input.limit ?? 24;
      const offset = input.cursor ?? 0;

      const conditions = [];
      if (input.search) {
        const term = `%${input.search}%`;
        conditions.push(
          or(
            like(mediaItems.title, term),
            like(mediaItems.category, term),
          ),
        );
      }

      const list = await db
        .select({
          id: mediaItems.id,
          title: mediaItems.title,
          fileKey: mediaItems.fileKey,
          thumbnailKey: mediaItems.thumbnailKey,
          category: mediaItems.category,
          contentType: media.contentType,
          size: media.size,
        })
        .from(mediaItems)
        .leftJoin(media, eq(mediaItems.fileKey, media.fileKey))
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(mediaItems.createdAt))
        .limit(limit)
        .offset(offset);

      return { items: list };
    }),
});

export type { SpotlightEntry };
