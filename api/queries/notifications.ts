import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "./connection";
import {
  notificationTypes,
  notificationTemplates,
  notifications,
  announcements,
  announcementLinks,
  announcementTargets,
  users,
  roles,
  notificationRules,
  notificationRuleLogs,
  players,
} from "@db/schema";
import type { NotificationRule } from "@db/schema";
import { signKeys } from "../lib/images";
import {
  NOTIFICATION_TYPES,
  type NotificationTypeSlug,
} from "@contracts/constants";

/**
 * Notification service — the single source of truth for delivering
 * notifications. Every notification in the system flows through
 * deliverNotification(), which enforces:
 *   1. The notification type must exist and be ACTIVE.
 *   2. Duplicate suppression (same user + type + source).
 */

type DeliverInput = {
  type: NotificationTypeSlug;
  userId: number;
  title: string;
  message?: string | null;
  imageKey?: string | null;
  linkUrl?: string | null;
  linkLabel?: string | null;
  templateId?: number | null;
  youtubeVideoId?: string | null;
  youtubeThumbnailUrl?: string | null;
  layout?: "compact" | "card" | "banner";
  priority?: "normal" | "important" | "urgent";
  sourceType?: string | null;
  sourceId?: string | null;
};

/** Extract the 11-char YouTube video ID from a URL or bare ID. Returns null if not found. */
export function parseYouTubeVideoId(urlOrId: string | null | undefined): string | null {
  if (!urlOrId) return null;

  const trimmed = urlOrId.trim();
  if (!trimmed) return null;

  // Bare video ID (11 chars of base64url-ish characters)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);

    // youtube.com/watch?v=VIDEO_ID
    if (url.hostname.includes("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

      // youtube.com/shorts/VIDEO_ID
      const pathParts = url.pathname.split("/");
      const shortIdx = pathParts.indexOf("shorts");
      if (shortIdx !== -1 && pathParts[shortIdx + 1]) {
        const id = pathParts[shortIdx + 1];
        if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
      }
    }

    // youtu.be/VIDEO_ID
    if (url.hostname === "youtu.be" || url.hostname.endsWith(".youtu.be")) {
      const id = url.pathname.slice(1).split(/[?&#]/)[0];
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }
  } catch {
    // Not a URL — fall through
  }

  return null;
}

/** Build the standard YouTube thumbnail URL for a video ID. */
export function youTubeThumbnailUrl(videoId: string, quality: "mq" | "hq" | "max" = "mq"): string {
  return `https://i.ytimg.com/vi/${videoId}/${quality}default.jpg`;
}

/**
 * Resolve a YouTube thumbnail URL for a video.
 * Uses a custom thumbnail if the type/template has one, otherwise fetches the
 * automatic thumbnail from YouTube's service.
 */
export async function resolveYouTubeThumbnailUrl(
  videoId: string | null,
  customThumbnailKey: string | null | undefined,
): Promise<string | null> {
  if (!videoId) return null;
  if (customThumbnailKey) {
    const urls = await signKeys([customThumbnailKey]);
    return urls[customThumbnailKey] ?? null;
  }
  return youTubeThumbnailUrl(videoId);
}

/**
 * Expand a template string by replacing {{placeholder}} tokens with values.
 */
export function expandTemplate(template: string | null | undefined, values: Record<string, string | number>): string {
  if (!template) return "";
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
    const val = values[key];
    return val !== undefined ? String(val) : match;
  });
}

export type NotificationTypeConfig = {
  id: number;
  slug: string;
  name: string;
  isActive: boolean;
  isAutomatic: boolean;
  defaultTemplateId: number | null;
  titleTemplate: string | null;
  messageTemplate: string | null;
  imageKey: string | null;
  priority: "normal" | "important" | "urgent";
  linkUrl: string | null;
  linkLabel: string | null;
  buttonStyle: "primary" | "outline" | "ghost";
  buttonIcon: string | null;
  youtubeEnabled: boolean;
  youtubeAutoThumbnail: boolean;
  youtubeCustomThumbnailKey: string | null;
  layout: "compact" | "card" | "banner";
};

/**
 * Returns the full DB row for a notification type slug, or null.
 * Includes all customization fields from migration 0024.
 */
export async function getNotificationTypeConfig(
  slug: string,
): Promise<NotificationTypeConfig | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(notificationTypes)
    .where(eq(notificationTypes.slug, slug))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    isActive: !!row.isActive,
    isAutomatic: !!row.isAutomatic,
    defaultTemplateId: row.defaultTemplateId ?? null,
    titleTemplate: row.titleTemplate ?? null,
    messageTemplate: row.messageTemplate ?? null,
    imageKey: row.imageKey ?? null,
    priority: row.priority ?? "normal",
    linkUrl: row.linkUrl ?? null,
    linkLabel: row.linkLabel ?? null,
    buttonStyle: row.buttonStyle ?? "primary",
    buttonIcon: row.buttonIcon ?? null,
    youtubeEnabled: !!row.youtubeEnabled,
    youtubeAutoThumbnail: !!row.youtubeAutoThumbnail,
    youtubeCustomThumbnailKey: row.youtubeCustomThumbnailKey ?? null,
    layout: row.layout ?? "compact",
  };
}

/** Get the default template for a notification type slug. */
export async function getDefaultTemplateForType(
  typeSlug: string,
): Promise<NotificationTemplateRow | null> {
  const db = getDb();
  const nt = await db
    .select({ id: notificationTypes.id })
    .from(notificationTypes)
    .where(eq(notificationTypes.slug, typeSlug))
    .limit(1);
  if (nt.length === 0) return null;

  const [row] = await db
    .select()
    .from(notificationTemplates)
    .where(
      and(
        eq(notificationTemplates.notificationTypeId, nt[0].id),
        eq(notificationTemplates.isDefault, true),
        eq(notificationTemplates.isArchived, false),
      ),
    )
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    notificationTypeId: row.notificationTypeId,
    name: row.name,
    description: row.description,
    isDefault: !!row.isDefault,
    isArchived: !!row.isArchived,
    titleTemplate: row.titleTemplate,
    messageTemplate: row.messageTemplate,
    imageKey: row.imageKey,
    priority: row.priority ?? "normal",
    linkUrl: row.linkUrl,
    linkLabel: row.linkLabel,
    buttonStyle: row.buttonStyle ?? "primary",
    buttonIcon: row.buttonIcon,
    youtubeEnabled: !!row.youtubeEnabled,
    youtubeAutoThumbnail: !!row.youtubeAutoThumbnail,
    youtubeCustomThumbnailKey: row.youtubeCustomThumbnailKey,
    layout: row.layout ?? "compact",
    createdById: row.createdById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export type NotificationTemplateRow = {
  id: number;
  notificationTypeId: number;
  name: string;
  description: string | null;
  isDefault: boolean;
  isArchived: boolean;
  titleTemplate: string;
  messageTemplate: string;
  imageKey: string | null;
  priority: "normal" | "important" | "urgent";
  linkUrl: string | null;
  linkLabel: string | null;
  buttonStyle: "primary" | "outline" | "ghost";
  buttonIcon: string | null;
  youtubeEnabled: boolean;
  youtubeAutoThumbnail: boolean;
  youtubeCustomThumbnailKey: string | null;
  layout: "compact" | "card" | "banner";
  createdById: number;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Deliver a notification to a single user, resolving from the type's
 * configuration and default template. Supports YouTube thumbnails.
 */
export async function deliverNotification(
  input: DeliverInput,
): Promise<number | null> {
  const db = getDb();

  // 1. Type must exist and be active — inactive types never send.
  const config = await getNotificationTypeConfig(input.type);
  if (!config || !config.isActive) {
    return null;
  }

  // 2. Duplicate suppression: same user + type + source (when source given).
  if (input.sourceType && input.sourceId) {
    const existing = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, input.userId),
          eq(notifications.notificationTypeId, config.id),
          eq(notifications.sourceType, input.sourceType),
          eq(notifications.sourceId, input.sourceId),
        ),
      )
      .limit(1);
    if (existing.length > 0) {
      return null;
    }
  }

  // 3. Resolve YouTube thumbnail if applicable
  let thumbnailUrl = input.youtubeThumbnailUrl ?? null;
  if (!thumbnailUrl && input.youtubeVideoId) {
    thumbnailUrl = await resolveYouTubeThumbnailUrl(
      input.youtubeVideoId,
      config.youtubeCustomThumbnailKey,
    );
  }

  const [created] = await db
    .insert(notifications)
    .values({
      notificationTypeId: config.id,
      templateId: input.templateId ?? config.defaultTemplateId ?? null,
      userId: input.userId,
      title: input.title,
      message: input.message ?? null,
      imageKey: input.imageKey ?? config.imageKey ?? null,
      linkUrl: input.linkUrl ?? config.linkUrl ?? null,
      linkLabel: input.linkLabel ?? config.linkLabel ?? null,
      youtubeVideoId: input.youtubeVideoId ?? null,
      youtubeThumbnailUrl: thumbnailUrl,
      layout: input.layout ?? config.layout ?? "compact",
      priority: input.priority ?? config.priority ?? "normal",
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
    })
    .$returningId();
  return created.id;
}

/**
 * Resolve the list of user IDs an announcement targets.
 * - "everyone": all non-banned users
 * - "role": all non-banned users with the given role slug
 * - "users": explicit user IDs from announcement_targets
 */
export async function resolveAnnouncementTargets(
  announcementId: number,
): Promise<number[]> {
  const db = getDb();
  const [announcement] = await db
    .select()
    .from(announcements)
    .where(eq(announcements.id, announcementId))
    .limit(1);
  if (!announcement) return [];

  if (announcement.targetType === "everyone") {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.banned, false));
    return rows.map((r) => r.id);
  }

  if (announcement.targetType === "role" && announcement.targetRole) {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.banned, false), eq(users.role, announcement.targetRole)));
    return rows.map((r) => r.id);
  }

  // "users" — explicit targets
  const rows = await db
    .select({ userId: announcementTargets.userId })
    .from(announcementTargets)
    .where(eq(announcementTargets.announcementId, announcementId));
  return rows.map((r) => r.userId);
}

/**
 * Publish an announcement: deliver a notification to every targeted
 * user (respecting the admin_announcement type's active state).
 * Returns the number of notifications actually delivered.
 */
export async function publishAnnouncement(
  announcementId: number,
): Promise<number> {
  const db = getDb();
  const [announcement] = await db
    .select()
    .from(announcements)
    .where(eq(announcements.id, announcementId))
    .limit(1);
  if (!announcement) return 0;

  const targetIds = await resolveAnnouncementTargets(announcementId);
  const links = await db
    .select()
    .from(announcementLinks)
    .where(eq(announcementLinks.announcementId, announcementId))
    .orderBy(announcementLinks.displayOrder);

  const firstLink = links[0];

  // Resolve YouTube thumbnail for the announcement
  let youtubeVideoId: string | null = null;
  let youtubeThumbnailUrl: string | null = null;
  if (announcement.youtubeVideoId) {
    youtubeVideoId = announcement.youtubeVideoId;
    youtubeThumbnailUrl = await resolveYouTubeThumbnailUrl(
      youtubeVideoId,
      announcement.youtubeCustomThumbnailKey,
    );
  }

  let delivered = 0;
  for (const userId of targetIds) {
    const id = await deliverNotification({
      type: NOTIFICATION_TYPES.ADMIN_ANNOUNCEMENT,
      userId,
      title: announcement.title,
      message: announcement.message,
      imageKey: announcement.imageKey,
      linkUrl: firstLink?.url ?? null,
      linkLabel: firstLink?.label ?? null,
      youtubeVideoId,
      youtubeThumbnailUrl,
      layout: announcement.layout,
      priority: announcement.priority,
      sourceType: "announcement",
      sourceId: String(announcement.id),
    });
    if (id !== null) delivered += 1;
  }

  await db
    .update(announcements)
    .set({ status: "published", publishedAt: new Date() })
    .where(eq(announcements.id, announcementId));
  return delivered;
}

/** List all notification type configs (admin settings view). */
export async function listNotificationTypeConfigs() {
  const db = getDb();
  return db
    .select()
    .from(notificationTypes)
    .orderBy(notificationTypes.id);
}

/** Toggle a notification type's active state. */
export async function setNotificationTypeActive(
  slug: string,
  isActive: boolean,
) {
  const db = getDb();
  await db
    .update(notificationTypes)
    .set({ isActive })
    .where(eq(notificationTypes.slug, slug));
}

/** Toggle a notification type's automatic state. */
export async function setNotificationTypeAutomatic(
  slug: string,
  isAutomatic: boolean,
) {
  const db = getDb();
  await db
    .update(notificationTypes)
    .set({ isAutomatic })
    .where(eq(notificationTypes.slug, slug));
}

/** Update the customizable fields of a notification type. */
export async function updateNotificationType(
  slug: string,
  input: {
    name?: string | null;
    description?: string | null;
    icon?: string | null;
    isActive?: boolean;
    isAutomatic?: boolean;
    titleTemplate?: string | null;
    messageTemplate?: string | null;
    imageKey?: string | null;
    priority?: "normal" | "important" | "urgent";
    linkUrl?: string | null;
    linkLabel?: string | null;
    buttonStyle?: "primary" | "outline" | "ghost";
    buttonIcon?: string | null;
    youtubeEnabled?: boolean;
    youtubeAutoThumbnail?: boolean;
    youtubeCustomThumbnailKey?: string | null;
    layout?: "compact" | "card" | "banner";
    defaultTemplateId?: number | null;
  },
) {
  const db = getDb();
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description;
  if (input.icon !== undefined) updates.icon = input.icon;
  if (input.isActive !== undefined) updates.isActive = input.isActive;
  if (input.isAutomatic !== undefined) updates.isAutomatic = input.isAutomatic;
  if (input.titleTemplate !== undefined) updates.titleTemplate = input.titleTemplate;
  if (input.messageTemplate !== undefined) updates.messageTemplate = input.messageTemplate;
  if (input.imageKey !== undefined) updates.imageKey = input.imageKey;
  if (input.priority !== undefined) updates.priority = input.priority;
  if (input.linkUrl !== undefined) updates.linkUrl = input.linkUrl;
  if (input.linkLabel !== undefined) updates.linkLabel = input.linkLabel;
  if (input.buttonStyle !== undefined) updates.buttonStyle = input.buttonStyle;
  if (input.buttonIcon !== undefined) updates.buttonIcon = input.buttonIcon;
  if (input.youtubeEnabled !== undefined) updates.youtubeEnabled = input.youtubeEnabled;
  if (input.youtubeAutoThumbnail !== undefined) updates.youtubeAutoThumbnail = input.youtubeAutoThumbnail;
  if (input.youtubeCustomThumbnailKey !== undefined) updates.youtubeCustomThumbnailKey = input.youtubeCustomThumbnailKey;
  if (input.layout !== undefined) updates.layout = input.layout;
  if (input.defaultTemplateId !== undefined) updates.defaultTemplateId = input.defaultTemplateId;
  if (Object.keys(updates).length === 0) return false;
  const result = await db
    .update(notificationTypes)
    .set(updates)
    .where(eq(notificationTypes.slug, slug));
  return (result[0]?.affectedRows ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Notification Templates CRUD
// ---------------------------------------------------------------------------

export type TemplateInput = {
  notificationTypeId: number;
  name: string;
  description?: string | null;
  isDefault?: boolean;
  titleTemplate: string;
  messageTemplate: string;
  imageKey?: string | null;
  priority?: "normal" | "important" | "urgent" | null;
  linkUrl?: string | null;
  linkLabel?: string | null;
  buttonStyle?: "primary" | "outline" | "ghost" | null;
  buttonIcon?: string | null;
  youtubeEnabled?: boolean;
  youtubeAutoThumbnail?: boolean;
  youtubeCustomThumbnailKey?: string | null;
  layout?: "compact" | "card" | "banner" | null;
  createdById: number;
};

/** List all templates, optionally filtered by type slug or archive status. */
export async function listNotificationTemplates(input?: {
  typeSlug?: string;
  includeArchived?: boolean;
}) {
  const db = getDb();

  const conditions = [];
  if (input?.typeSlug) {
    conditions.push(eq(notificationTypes.slug, input.typeSlug));
  }
  if (!input?.includeArchived) {
    conditions.push(eq(notificationTemplates.isArchived, false));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db
    .select({
      id: notificationTemplates.id,
      notificationTypeId: notificationTemplates.notificationTypeId,
      typeSlug: notificationTypes.slug,
      typeName: notificationTypes.name,
      name: notificationTemplates.name,
      description: notificationTemplates.description,
      isDefault: notificationTemplates.isDefault,
      isArchived: notificationTemplates.isArchived,
      titleTemplate: notificationTemplates.titleTemplate,
      messageTemplate: notificationTemplates.messageTemplate,
      imageKey: notificationTemplates.imageKey,
      priority: notificationTemplates.priority,
      linkUrl: notificationTemplates.linkUrl,
      linkLabel: notificationTemplates.linkLabel,
      buttonStyle: notificationTemplates.buttonStyle,
      buttonIcon: notificationTemplates.buttonIcon,
      youtubeEnabled: notificationTemplates.youtubeEnabled,
      youtubeAutoThumbnail: notificationTemplates.youtubeAutoThumbnail,
      youtubeCustomThumbnailKey: notificationTemplates.youtubeCustomThumbnailKey,
      layout: notificationTemplates.layout,
      createdById: notificationTemplates.createdById,
      createdAt: notificationTemplates.createdAt,
      updatedAt: notificationTemplates.updatedAt,
    })
    .from(notificationTemplates)
    .innerJoin(
      notificationTypes,
      eq(notificationTemplates.notificationTypeId, notificationTypes.id),
    )
    .where(whereClause)
    .orderBy(notificationTemplates.id);

  // Resolve image URLs
  const imageKeys = [...new Set(rows.map((r) => r.imageKey).filter(Boolean) as string[])];
  const urls = imageKeys.length ? await signKeys(imageKeys) : {};

  return rows.map((r) => ({
    ...r,
    imageUrl: r.imageKey ? (urls[r.imageKey] ?? null) : null,
  }));
}

/** Get a single template by id. */
export async function getNotificationTemplate(id: number) {
  const db = getDb();
  const [row] = await db
    .select({
      id: notificationTemplates.id,
      notificationTypeId: notificationTemplates.notificationTypeId,
      typeSlug: notificationTypes.slug,
      typeName: notificationTypes.name,
      name: notificationTemplates.name,
      description: notificationTemplates.description,
      isDefault: notificationTemplates.isDefault,
      isArchived: notificationTemplates.isArchived,
      titleTemplate: notificationTemplates.titleTemplate,
      messageTemplate: notificationTemplates.messageTemplate,
      imageKey: notificationTemplates.imageKey,
      priority: notificationTemplates.priority,
      linkUrl: notificationTemplates.linkUrl,
      linkLabel: notificationTemplates.linkLabel,
      buttonStyle: notificationTemplates.buttonStyle,
      buttonIcon: notificationTemplates.buttonIcon,
      youtubeEnabled: notificationTemplates.youtubeEnabled,
      youtubeAutoThumbnail: notificationTemplates.youtubeAutoThumbnail,
      youtubeCustomThumbnailKey: notificationTemplates.youtubeCustomThumbnailKey,
      layout: notificationTemplates.layout,
      createdById: notificationTemplates.createdById,
      createdAt: notificationTemplates.createdAt,
      updatedAt: notificationTemplates.updatedAt,
    })
    .from(notificationTemplates)
    .innerJoin(
      notificationTypes,
      eq(notificationTemplates.notificationTypeId, notificationTypes.id),
    )
    .where(eq(notificationTemplates.id, id))
    .limit(1);

  if (!row) return null;

  const imageKeys = [...new Set([row.imageKey].filter(Boolean) as string[])];
  const urls = imageKeys.length ? await signKeys(imageKeys) : {};
  return {
    ...row,
    imageUrl: row.imageKey ? (urls[row.imageKey] ?? null) : null,
  };
}

/** Create a new template. If isDefault, clears other defaults for the type. */
export async function createNotificationTemplate(input: TemplateInput): Promise<number> {
  const db = getDb();

  // Verify the type exists
  const [typeRow] = await db
    .select({ id: notificationTypes.id })
    .from(notificationTypes)
    .where(eq(notificationTypes.id, input.notificationTypeId))
    .limit(1);
  if (!typeRow) throw new Error("Notification type not found");

  // If this is marked as default, clear any existing default for this type
  if (input.isDefault) {
    await db
      .update(notificationTemplates)
      .set({ isDefault: false })
      .where(eq(notificationTemplates.notificationTypeId, input.notificationTypeId));
  }

  const [created] = await db
    .insert(notificationTemplates)
    .values({
      notificationTypeId: input.notificationTypeId,
      name: input.name,
      description: input.description ?? null,
      isDefault: input.isDefault ?? false,
      isArchived: false,
      titleTemplate: input.titleTemplate,
      messageTemplate: input.messageTemplate,
      imageKey: input.imageKey ?? null,
      priority: input.priority ?? "normal",
      linkUrl: input.linkUrl ?? null,
      linkLabel: input.linkLabel ?? null,
      buttonStyle: input.buttonStyle ?? "primary",
      buttonIcon: input.buttonIcon ?? null,
      youtubeEnabled: input.youtubeEnabled ?? false,
      youtubeAutoThumbnail: input.youtubeAutoThumbnail ?? true,
      youtubeCustomThumbnailKey: input.youtubeCustomThumbnailKey ?? null,
      layout: input.layout ?? "compact",
      createdById: input.createdById,
    })
    .$returningId();

  return created.id;
}

/** Update an existing template. */
export async function updateNotificationTemplate(
  id: number,
  input: {
    name?: string;
    description?: string | null;
    isDefault?: boolean;
    titleTemplate?: string;
    messageTemplate?: string;
    imageKey?: string | null;
    priority?: "normal" | "important" | "urgent";
    linkUrl?: string | null;
    linkLabel?: string | null;
    buttonStyle?: "primary" | "outline" | "ghost";
    buttonIcon?: string | null;
    youtubeEnabled?: boolean;
    youtubeAutoThumbnail?: boolean;
    youtubeCustomThumbnailKey?: string | null;
    layout?: "compact" | "card" | "banner";
  },
) {
  const db = getDb();
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description;
  if (input.titleTemplate !== undefined) updates.titleTemplate = input.titleTemplate;
  if (input.messageTemplate !== undefined) updates.messageTemplate = input.messageTemplate;
  if (input.imageKey !== undefined) updates.imageKey = input.imageKey;
  if (input.priority !== undefined) updates.priority = input.priority;
  if (input.linkUrl !== undefined) updates.linkUrl = input.linkUrl;
  if (input.linkLabel !== undefined) updates.linkLabel = input.linkLabel;
  if (input.buttonStyle !== undefined) updates.buttonStyle = input.buttonStyle;
  if (input.buttonIcon !== undefined) updates.buttonIcon = input.buttonIcon;
  if (input.youtubeEnabled !== undefined) updates.youtubeEnabled = input.youtubeEnabled;
  if (input.youtubeAutoThumbnail !== undefined) updates.youtubeAutoThumbnail = input.youtubeAutoThumbnail;
  if (input.youtubeCustomThumbnailKey !== undefined) updates.youtubeCustomThumbnailKey = input.youtubeCustomThumbnailKey;
  if (input.layout !== undefined) updates.layout = input.layout;

  if (Object.keys(updates).length === 0) return false;

  // If marking as default, clear other defaults for this type
  if (input.isDefault) {
    const [tpl] = await db
      .select({ typeId: notificationTemplates.notificationTypeId })
      .from(notificationTemplates)
      .where(eq(notificationTemplates.id, id))
      .limit(1);
    if (tpl) {
      await db
        .update(notificationTemplates)
        .set({ isDefault: false })
        .where(eq(notificationTemplates.notificationTypeId, tpl.typeId));
    }
  }
  if (input.isDefault !== undefined) updates.isDefault = input.isDefault;

  const result = await db
    .update(notificationTemplates)
    .set(updates)
    .where(eq(notificationTemplates.id, id));
  return (result[0]?.affectedRows ?? 0) > 0;
}

/** Archive a template (soft-delete). */
export async function archiveNotificationTemplate(id: number): Promise<boolean> {
  const db = getDb();
  await db
    .update(notificationTemplates)
    .set({ isArchived: true })
    .where(eq(notificationTemplates.id, id));
  return true;
}

/** Unarchive a template. */
export async function restoreNotificationTemplate(id: number): Promise<boolean> {
  const db = getDb();
  await db
    .update(notificationTemplates)
    .set({ isArchived: false })
    .where(eq(notificationTemplates.id, id));
  return true;
}

/** Duplicate a template. */
export async function duplicateNotificationTemplate(
  id: number,
  name: string,
): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(notificationTemplates)
    .where(eq(notificationTemplates.id, id))
    .limit(1);
  if (!row) throw new Error("Template not found");

  const [created] = await db
    .insert(notificationTemplates)
    .values({
      notificationTypeId: row.notificationTypeId,
      name,
      description: row.description,
      isDefault: false,
      isArchived: false,
      titleTemplate: row.titleTemplate,
      messageTemplate: row.messageTemplate,
      imageKey: row.imageKey,
      priority: row.priority ?? "normal",
      linkUrl: row.linkUrl,
      linkLabel: row.linkLabel,
      buttonStyle: row.buttonStyle ?? "primary",
      buttonIcon: row.buttonIcon,
      youtubeEnabled: row.youtubeEnabled,
      youtubeAutoThumbnail: row.youtubeAutoThumbnail,
      youtubeCustomThumbnailKey: row.youtubeCustomThumbnailKey,
      layout: row.layout ?? "compact",
      createdById: row.createdById,
    })
    .$returningId();

  return created.id;
}

/**
 * Preview a template: expand its title/message with the given placeholder
 * values, and resolve any image/thumbnail URLs.
 */
export async function previewNotificationTemplate(
  id: number,
  placeholders: Record<string, string>,
): Promise<{
  title: string;
  message: string;
  imageUrl: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  youtubeVideoId: string | null;
  youtubeThumbnailUrl: string | null;
  priority: "normal" | "important" | "urgent";
  layout: "compact" | "card" | "banner";
  buttonStyle: "primary" | "outline" | "ghost";
  buttonIcon: string | null;
}> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(notificationTemplates)
    .where(eq(notificationTemplates.id, id))
    .limit(1);
  if (!row) throw new Error("Template not found");

  const title = expandTemplate(row.titleTemplate, placeholders);
  const message = expandTemplate(row.messageTemplate, placeholders);

  const keys = [...new Set([row.imageKey, row.youtubeCustomThumbnailKey].filter(Boolean) as string[])];
  const urls = keys.length ? await signKeys(keys) : {};
  const imageUrl = row.imageKey ? (urls[row.imageKey] ?? null) : null;

  let youtubeVideoId: string | null = null;
  let youtubeThumbnailUrl: string | null = null;
  if (row.youtubeEnabled && placeholders.youtubeUrl) {
    youtubeVideoId = parseYouTubeVideoId(placeholders.youtubeUrl);
    if (youtubeVideoId) {
      youtubeThumbnailUrl = await resolveYouTubeThumbnailUrl(
        youtubeVideoId,
        row.youtubeCustomThumbnailKey,
      );
    }
  }

  return {
    title,
    message,
    imageUrl,
    linkUrl: row.linkUrl,
    linkLabel: row.linkLabel,
    youtubeVideoId,
    youtubeThumbnailUrl,
    priority: row.priority ?? "normal",
    layout: row.layout ?? "compact",
    buttonStyle: row.buttonStyle ?? "primary",
    buttonIcon: row.buttonIcon,
  };
}

type SendTemplateInput = {
  templateId: number;
  title?: string;
  message?: string;
  imageKey?: string | null;
  linkUrl?: string | null;
  linkLabel?: string | null;
  youtubeVideoId?: string | null;
  priority?: "normal" | "important" | "urgent";
  layout?: "compact" | "card" | "banner";
  targetType: "everyone" | "role" | "users";
  targetRole?: string | null;
  targetUserIds?: number[];
  sourceType?: string | null;
  sourceId?: string | null;
};

/**
 * Send a template-based notification to targeted users.
 * If title/message are not provided, uses the template's values.
 */
export async function sendTemplateNotification(input: SendTemplateInput): Promise<{
  delivered: number;
  targetCount: number;
}> {
  const db = getDb();
  const [tpl] = await db
    .select()
    .from(notificationTemplates)
    .where(eq(notificationTemplates.id, input.templateId))
    .limit(1);
  if (!tpl) throw new Error("Template not found");

  // Resolve the notification type from the template
  const [typeRow] = await db
    .select()
    .from(notificationTypes)
    .where(eq(notificationTypes.id, tpl.notificationTypeId))
    .limit(1);
  if (!typeRow || !typeRow.isActive) {
    throw new Error("Notification type is inactive or not found");
  }

  // Resolve YouTube thumbnail
  let youtubeVideoId = input.youtubeVideoId ?? null;
  let youtubeThumbnailUrl: string | null = null;
  if (!youtubeVideoId && tpl.youtubeEnabled && input.linkUrl) {
    youtubeVideoId = parseYouTubeVideoId(input.linkUrl);
  }
  if (youtubeVideoId) {
    youtubeThumbnailUrl = await resolveYouTubeThumbnailUrl(
      youtubeVideoId,
      tpl.youtubeCustomThumbnailKey ?? null,
    );
  }

  // Resolve target user IDs
  let userIds: number[] = [];
  if (input.targetType === "everyone") {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.banned, false));
    userIds = rows.map((r) => r.id);
  } else if (input.targetType === "role" && input.targetRole) {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(eq(users.banned, false), eq(users.role, input.targetRole)),
      );
    userIds = rows.map((r) => r.id);
  } else {
    userIds = input.targetUserIds ?? [];
  }

  const title = input.title ?? tpl.titleTemplate;
  const message = input.message ?? tpl.messageTemplate;
  const aSourceId = input.sourceId ?? `template-${tpl.id}-${Date.now()}`;

  let delivered = 0;
  for (const userId of userIds) {
    // Deduplication: one notification per user per template-send
    const existing = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.notificationTypeId, typeRow.id),
          eq(notifications.sourceType, input.sourceType ?? "template"),
          eq(notifications.sourceId, aSourceId),
        ),
      )
      .limit(1);
    if (existing.length > 0) continue;

    const id = await deliverNotification({
      type: typeRow.slug as NotificationTypeSlug,
      userId,
      title,
      message,
      imageKey: input.imageKey ?? tpl.imageKey ?? null,
      linkUrl: input.linkUrl ?? tpl.linkUrl ?? null,
      linkLabel: input.linkLabel ?? tpl.linkLabel ?? null,
      youtubeVideoId,
      youtubeThumbnailUrl,
      layout: input.layout ?? tpl.layout,
      priority: input.priority ?? tpl.priority,
      templateId: tpl.id,
      sourceType: input.sourceType ?? "template",
      sourceId: aSourceId,
    });
    if (id !== null) delivered += 1;
  }

  return { delivered, targetCount: userIds.length };
}

/** Count unread notifications for a user. */
export async function countUnread(userId: number): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return row?.count ?? 0;
}

/** List notifications for a user (newest first). */
export async function listUserNotifications(
  userId: number,
  limit = 50,
) {
  const db = getDb();
  const rows = await db
    .select({
      id: notifications.id,
      notificationTypeId: notifications.notificationTypeId,
      typeSlug: notificationTypes.slug,
      typeName: notificationTypes.name,
      icon: notificationTypes.icon,
      title: notifications.title,
      message: notifications.message,
      imageKey: notifications.imageKey,
      linkUrl: notifications.linkUrl,
      linkLabel: notifications.linkLabel,
      youtubeVideoId: notifications.youtubeVideoId,
      youtubeThumbnailUrl: notifications.youtubeThumbnailUrl,
      layout: notifications.layout,
      priority: notifications.priority,
      isRead: notifications.isRead,
      readAt: notifications.readAt,
      clickedAt: notifications.clickedAt,
      sourceType: notifications.sourceType,
      sourceId: notifications.sourceId,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .innerJoin(
      notificationTypes,
      eq(notifications.notificationTypeId, notificationTypes.id),
    )
    .where(eq(notifications.userId, userId))
    .orderBy(sql`${notifications.createdAt} desc, ${notifications.id} desc`)
    .limit(limit);

  // Resolve image keys to URLs in a single batch
  // (youtubeThumbnailUrl is already a full presigned URL, not a storage key)
  const imageKeys = [...new Set(rows.map((r) => r.imageKey).filter(Boolean) as string[])];
  const urls = imageKeys.length ? await signKeys(imageKeys) : {};

  return rows.map((r) => ({
    ...r,
    imageUrl: r.imageKey ? (urls[r.imageKey] ?? null) : null,
    youtubeThumbnailUrl: r.youtubeThumbnailUrl ?? null,
  }));
}

/** Mark one notification as read. */
export async function markNotificationRead(
  id: number,
  userId: number,
): Promise<boolean> {
  const db = getDb();
  const result = await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  return (result[0]?.affectedRows ?? 0) > 0;
}

/** Mark all of a user's notifications as read. Returns how many were updated. */
export async function markAllNotificationsRead(userId: number): Promise<number> {
  const db = getDb();
  const result = await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(
      and(eq(notifications.userId, userId), eq(notifications.isRead, false)),
    );
  return result[0]?.affectedRows ?? 0;
}

/** Record a click on a notification (for click tracking). */
export async function recordNotificationClick(
  id: number,
  userId: number,
): Promise<boolean> {
  const db = getDb();
  const result = await db
    .update(notifications)
    .set({ clickedAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  return (result[0]?.affectedRows ?? 0) > 0;
}

/** Admin: list announcements with computed stats. */
export async function listAnnouncementsAdmin() {
  const db = getDb();
  const rows = await db
    .select({
      id: announcements.id,
      title: announcements.title,
      message: announcements.message,
      imageKey: announcements.imageKey,
      priority: announcements.priority,
      status: announcements.status,
      scheduledAt: announcements.scheduledAt,
      publishedAt: announcements.publishedAt,
      targetType: announcements.targetType,
      targetRole: announcements.targetRole,
      buttonStyle: announcements.buttonStyle,
      buttonIcon: announcements.buttonIcon,
      youtubeVideoId: announcements.youtubeVideoId,
      layout: announcements.layout,
       createdById: announcements.createdById,
      isActive: announcements.isActive,
      createdAt: announcements.createdAt,
      updatedAt: announcements.updatedAt,
      creatorName: users.name,
      creatorUsername: users.username,
    })
    .from(announcements)
    .leftJoin(users, eq(announcements.createdById, users.id))
    .orderBy(sql`${announcements.createdAt} desc, ${announcements.id} desc`);

  // Resolve image keys to URLs in a single batch
  const imageKeys = [...new Set(rows.map((r) => r.imageKey).filter(Boolean) as string[])];
  const urls = imageKeys.length ? await signKeys(imageKeys) : {};

  // Attach link + target + stats for each announcement
  const result = [];
  for (const row of rows) {
    const links = await db
      .select()
      .from(announcementLinks)
      .where(eq(announcementLinks.announcementId, row.id))
      .orderBy(announcementLinks.displayOrder);
    const targetIds = await resolveAnnouncementTargets(row.id);
    const [sentRow] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(notifications)
      .where(
        and(
          eq(notifications.sourceType, "announcement"),
          eq(notifications.sourceId, String(row.id)),
        ),
      );
    const [readRow] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(notifications)
      .where(
        and(
          eq(notifications.sourceType, "announcement"),
          eq(notifications.sourceId, String(row.id)),
          eq(notifications.isRead, true),
        ),
      );
    const [clickRow] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(notifications)
      .where(
        and(
          eq(notifications.sourceType, "announcement"),
          eq(notifications.sourceId, String(row.id)),
          sql`${notifications.clickedAt} is not null`,
        ),
      );
      result.push({
        ...row,
        imageUrl: row.imageKey ? (urls[row.imageKey] ?? null) : null,
        links,
        targetCount: targetIds.length,
        sentCount: sentRow?.count ?? 0,
        readCount: readRow?.count ?? 0,
        clickCount: clickRow?.count ?? 0,
      });
  }
  return result;
}

/** Admin: get a single announcement with links and targets. */
export async function getAnnouncementAdmin(id: number) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(announcements)
    .where(eq(announcements.id, id))
    .limit(1);
  if (!row) return null;
  const links = await db
    .select()
    .from(announcementLinks)
    .where(eq(announcementLinks.announcementId, id))
    .orderBy(announcementLinks.displayOrder);
  const targets = await db
    .select({
      userId: announcementTargets.userId,
      userName: users.name,
      userUsername: users.username,
    })
    .from(announcementTargets)
    .innerJoin(users, eq(announcementTargets.userId, users.id));
  return { ...row, links, targets };
}

/** Admin: create an announcement with links and optional user targets. */
export async function createAnnouncement(input: {
  title: string;
  message: string;
  imageKey?: string | null;
  priority: "normal" | "important" | "urgent";
  status: "draft" | "scheduled" | "published";
  scheduledAt?: Date | null;
  targetType: "everyone" | "role" | "users";
  targetRole?: string | null;
  targetUserIds?: number[];
  links: { url: string; label: string }[];
  buttonStyle?: "primary" | "outline" | "ghost";
  buttonIcon?: string | null;
  youtubeVideoId?: string | null;
  layout?: "compact" | "card" | "banner";
  createdById: number;
}) {
  const db = getDb();
  const [created] = await db
    .insert(announcements)
    .values({
      title: input.title,
      message: input.message,
      imageKey: input.imageKey ?? null,
      priority: input.priority,
      status: input.status,
      scheduledAt: input.scheduledAt ?? null,
      targetType: input.targetType,
      targetRole: input.targetType === "role" ? input.targetRole ?? null : null,
      buttonStyle: input.buttonStyle ?? "primary",
      buttonIcon: input.buttonIcon ?? null,
      youtubeVideoId: input.youtubeVideoId ?? null,
      layout: input.layout ?? "compact",
      createdById: input.createdById,
    })
    .$returningId();

  // Insert links
  for (let i = 0; i < input.links.length; i++) {
    const link = input.links[i];
    await db
      .insert(announcementLinks)
      .values({
        announcementId: created.id,
        url: link.url,
        label: link.label,
        displayOrder: i,
      });
  }

  // Insert explicit user targets
  if (input.targetType === "users" && input.targetUserIds) {
    for (const userId of input.targetUserIds) {
      await db
        .insert(announcementTargets)
        .values({ announcementId: created.id, userId })
        .onDuplicateKeyUpdate({ set: {} });
    }
  }

  return created.id;
}

/** Admin: update an announcement (title, message, image, priority, schedule, targeting, links). */
export async function updateAnnouncement(
  id: number,
  input: {
    title: string;
    message: string;
    imageKey?: string | null;
    priority: "normal" | "important" | "urgent";
    status: "draft" | "scheduled" | "published";
    scheduledAt?: Date | null;
    targetType: "everyone" | "role" | "users";
    targetRole?: string | null;
    targetUserIds?: number[];
  links: { url: string; label: string }[];
  buttonStyle?: "primary" | "outline" | "ghost";
  buttonIcon?: string | null;
  youtubeVideoId?: string | null;
  layout?: "compact" | "card" | "banner";
}) {
  const db = getDb();
  await db
    .update(announcements)
    .set({
      title: input.title,
      message: input.message,
      imageKey: input.imageKey ?? null,
      priority: input.priority,
      status: input.status,
      scheduledAt: input.scheduledAt ?? null,
      targetType: input.targetType,
      targetRole: input.targetType === "role" ? input.targetRole ?? null : null,
      buttonStyle: input.buttonStyle ?? "primary",
      buttonIcon: input.buttonIcon ?? null,
      youtubeVideoId: input.youtubeVideoId ?? null,
      layout: input.layout ?? "compact",
    })
    .where(eq(announcements.id, id));

  // Replace links
  await db
    .delete(announcementLinks)
    .where(eq(announcementLinks.announcementId, id));
  for (let i = 0; i < input.links.length; i++) {
    const link = input.links[i];
    await db
      .insert(announcementLinks)
      .values({
        announcementId: id,
        url: link.url,
        label: link.label,
        displayOrder: i,
      });
  }

  // Replace explicit user targets
  await db
    .delete(announcementTargets)
    .where(eq(announcementTargets.announcementId, id));
  if (input.targetType === "users" && input.targetUserIds) {
    for (const userId of input.targetUserIds) {
      await db
        .insert(announcementTargets)
        .values({ announcementId: id, userId })
        .onDuplicateKeyUpdate({ set: {} });
    }
  }
}

/** Admin: deactivate (soft-disable) an announcement. */
export async function setAnnouncementActive(id: number, isActive: boolean) {
  const db = getDb();
  await db
    .update(announcements)
    .set({ isActive })
    .where(eq(announcements.id, id));
}

/** Admin: delete an announcement and its links/targets/notifications. */
export async function deleteAnnouncement(id: number) {
  const db = getDb();
  await db
    .delete(announcementLinks)
    .where(eq(announcementLinks.announcementId, id));
  await db
    .delete(announcementTargets)
    .where(eq(announcementTargets.announcementId, id));
  await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.sourceType, "announcement"),
        eq(notifications.sourceId, String(id)),
      ),
    );
  await db.delete(announcements).where(eq(announcements.id, id));
}

/** Search users for targeting (admin). */
export async function searchUsersForTargeting(query: string, limit = 20) {
  const db = getDb();
  const q = `%${query}%`;
  return db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      role: users.role,
    })
    .from(users)
    .where(
      sql`(${users.name} like ${q} or ${users.username} like ${q})`,
    )
    .limit(limit);
}

/** List all roles for targeting dropdown. */
export async function listRolesForTargeting() {
  const db = getDb();
  return db
    .select({ slug: roles.slug, name: roles.name })
    .from(roles)
    .where(eq(roles.isActive, true));
}

/**
 * Deliver a manual notification of a given type to targeted users.
 * Used for manual Player Live / Clutch / Engagement notifications.
 */
export async function sendManualNotification(input: {
  type: NotificationTypeSlug;
  title: string;
  message?: string | null;
  linkUrl?: string | null;
  linkLabel?: string | null;
  youtubeVideoId?: string | null;
  priority?: "normal" | "important" | "urgent";
  layout?: "compact" | "card" | "banner";
  targetType: "everyone" | "role" | "users";
  targetRole?: string | null;
  targetUserIds?: number[];
}) {
  // Type must be active
  const config = await getNotificationTypeConfig(input.type);
  if (!config) {
    throw new Error("Unknown notification type");
  }
  if (!config.isActive) {
    throw new Error("This notification type is inactive and cannot send.");
  }

  const db = getDb();
  let userIds: number[] = [];
  if (input.targetType === "everyone") {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.banned, false));
    userIds = rows.map((r) => r.id);
  } else if (input.targetType === "role" && input.targetRole) {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(eq(users.banned, false), eq(users.role, input.targetRole)),
      );
    userIds = rows.map((r) => r.id);
  } else {
    userIds = input.targetUserIds ?? [];
  }

  // Resolve YouTube thumbnail if needed
  let youtubeThumbnailUrl: string | null = null;
  if (input.youtubeVideoId) {
    youtubeThumbnailUrl = await resolveYouTubeThumbnailUrl(
      input.youtubeVideoId,
      config.youtubeCustomThumbnailKey ?? null,
    );
  }

  let delivered = 0;
  for (const userId of userIds) {
    const id = await deliverNotification({
      type: input.type,
      userId,
      title: input.title,
      message: input.message ?? null,
      imageKey: config.imageKey ?? null,
      linkUrl: input.linkUrl ?? null,
      linkLabel: input.linkLabel ?? config.linkLabel ?? null,
      youtubeVideoId: input.youtubeVideoId ?? null,
      youtubeThumbnailUrl,
      layout: input.layout ?? config.layout,
      priority: input.priority ?? config.priority,
      sourceType: "manual",
      sourceId: `${input.type}-${Date.now()}`,
    });
    if (id !== null) delivered += 1;
  }
  return { delivered, targetCount: userIds.length };
}

/**
 * Process scheduled announcements whose scheduled time has passed.
 * Called by the scheduler; publishes each due announcement.
 */
export async function processScheduledAnnouncements(): Promise<number> {
  const db = getDb();
  const due = await db
    .select({ id: announcements.id })
    .from(announcements)
    .where(
      and(
        eq(announcements.status, "scheduled"),
        eq(announcements.isActive, true),
        sql`${announcements.scheduledAt} is not null`,
        sql`${announcements.scheduledAt} <= now()`,
      ),
    );
  let published = 0;
  for (const row of due) {
    await publishAnnouncement(row.id);
    published += 1;
  }
  return published;
}

/**
 * Automatic delivery hooks. Each checks the type's active state
 * before generating any notification — inactive types never send.
 */

/** Player Live: notify when a player goes live. */
export async function notifyPlayerLive(input: {
  playerName: string;
  streamUrl?: string | null;
  youtubeVideoId?: string | null;
  targetType?: "everyone" | "role" | "users";
  targetRole?: string | null;
  targetUserIds?: number[];
}) {
  const config = await getNotificationTypeConfig(NOTIFICATION_TYPES.PLAYER_LIVE);
  if (!config || !config.isActive) return { delivered: 0, skipped: true };

  const db = getDb();
  let userIds: number[] = [];
  const targetType = input.targetType ?? "everyone";
  if (targetType === "everyone") {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.banned, false));
    userIds = rows.map((r) => r.id);
  } else if (targetType === "role" && input.targetRole) {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(eq(users.banned, false), eq(users.role, input.targetRole)),
      );
    userIds = rows.map((r) => r.id);
  } else {
    userIds = input.targetUserIds ?? [];
  }

  // Resolve YouTube thumbnail
  let youtubeVideoId: string | null = input.youtubeVideoId ?? null;
  let youtubeThumbnailUrl: string | null = null;
  if (!youtubeVideoId && config.youtubeEnabled && input.streamUrl) {
    youtubeVideoId = parseYouTubeVideoId(input.streamUrl);
  }
  if (youtubeVideoId) {
    youtubeThumbnailUrl = await resolveYouTubeThumbnailUrl(
      youtubeVideoId,
      config.youtubeCustomThumbnailKey ?? null,
    );
  }

  const placeholders = { playerName: input.playerName };
  const title = expandTemplate(config.titleTemplate, placeholders);
  const message = expandTemplate(config.messageTemplate, placeholders);

  let delivered = 0;
  for (const userId of userIds) {
    const id = await deliverNotification({
      type: NOTIFICATION_TYPES.PLAYER_LIVE,
      userId,
      title,
      message,
      imageKey: config.imageKey ?? null,
      linkUrl: input.streamUrl ?? null,
      linkLabel: config.linkLabel ?? "Watch Live",
      youtubeVideoId,
      youtubeThumbnailUrl,
      layout: config.layout,
      priority: config.priority,
      sourceType: "player_live",
      sourceId: `${input.playerName}-${new Date().toISOString().slice(0, 16)}`,
    });
    if (id !== null) delivered += 1;
  }
  return { delivered, skipped: false };
}

/** Clutch/Highlight: notify when new highlight content is published. */
export async function notifyClutchHighlight(input: {
  title: string;
  highlightUrl?: string | null;
  imageKey?: string | null;
  youtubeVideoId?: string | null;
  targetType?: "everyone" | "role" | "users";
  targetRole?: string | null;
  targetUserIds?: number[];
}) {
  const config = await getNotificationTypeConfig(
    NOTIFICATION_TYPES.CLUTCH_HIGHLIGHT,
  );
  if (!config || !config.isActive) return { delivered: 0, skipped: true };

  const db = getDb();
  let userIds: number[] = [];
  const targetType = input.targetType ?? "everyone";
  if (targetType === "everyone") {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.banned, false));
    userIds = rows.map((r) => r.id);
  } else if (targetType === "role" && input.targetRole) {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(eq(users.banned, false), eq(users.role, input.targetRole)),
      );
    userIds = rows.map((r) => r.id);
  } else {
    userIds = input.targetUserIds ?? [];
  }

  // Resolve YouTube thumbnail
  let youtubeVideoId: string | null = input.youtubeVideoId ?? null;
  let youtubeThumbnailUrl: string | null = null;
  if (!youtubeVideoId && config.youtubeEnabled && input.highlightUrl) {
    youtubeVideoId = parseYouTubeVideoId(input.highlightUrl);
  }
  if (youtubeVideoId) {
    youtubeThumbnailUrl = await resolveYouTubeThumbnailUrl(
      youtubeVideoId,
      config.youtubeCustomThumbnailKey ?? null,
    );
  }

  const placeholders = { title: input.title };
  const title = expandTemplate(config.titleTemplate, placeholders);
  const message = expandTemplate(config.messageTemplate, placeholders);

  let delivered = 0;
  for (const userId of userIds) {
    const id = await deliverNotification({
      type: NOTIFICATION_TYPES.CLUTCH_HIGHLIGHT,
      userId,
      title,
      message,
      imageKey: input.imageKey ?? config.imageKey ?? null,
      linkUrl: input.highlightUrl ?? null,
      linkLabel: config.linkLabel ?? "Watch Highlight",
      youtubeVideoId,
      youtubeThumbnailUrl,
      layout: config.layout,
      priority: config.priority,
      sourceType: "clutch_highlight",
      sourceId: `${input.title}-${Date.now()}`,
    });
    if (id !== null) delivered += 1;
  }
  return { delivered, skipped: false };
}

/**
 * Engagement: notify a content author about a like, comment, or reply
 * on their content. All three engagement actions share ONE type.
 * `actorName` is who performed the action; `contentDesc` describes
 * what was engaged (e.g. "your comment on Tournament X").
 */
export async function notifyEngagement(input: {
  recipientUserId: number;
  actorName: string;
  action: "like" | "comment" | "reply";
  contentDesc: string;
  linkUrl?: string | null;
}) {
  const config = await getNotificationTypeConfig(NOTIFICATION_TYPES.ENGAGEMENT);
  if (!config || !config.isActive) return { delivered: 0, skipped: true };

  const actionText =
    input.action === "like"
      ? "liked"
      : input.action === "comment"
        ? "commented on"
        : "replied to";
  const placeholders = {
    actorName: input.actorName,
    actionText,
    contentDesc: input.contentDesc,
  };
  const title = expandTemplate(config.titleTemplate, placeholders);
  const message = expandTemplate(config.messageTemplate, placeholders);
  const id = await deliverNotification({
    type: NOTIFICATION_TYPES.ENGAGEMENT,
    userId: input.recipientUserId,
    title,
    message,
    imageKey: config.imageKey ?? null,
    linkUrl: input.linkUrl ?? null,
    linkLabel: config.linkLabel ?? "View",
    layout: config.layout,
    priority: config.priority,
    sourceType: "engagement",
    // Dedup per actor+action+content+recipient
    sourceId: `${input.recipientUserId}-${input.actorName}-${input.action}-${input.contentDesc}`,
  });
  return { delivered: id !== null ? 1 : 0, skipped: false };
}

/**
 * Scheduler tick: publish due scheduled announcements.
 * Exposed so the server can run it periodically.
 */
export async function runNotificationScheduler(): Promise<{
  published: number;
}> {
  const published = await processScheduledAnnouncements();
  return { published };
}

// ---------------------------------------------------------------------------
// Live Stream Auto-Notification
//
// When a user sets a live link to "live" (isLive: true), the system checks
// notification rules and sends notifications to targeted users if the
// rule's cooldown has elapsed and the user's role matches.
// ---------------------------------------------------------------------------

type LiveLinkWithUser = {
  id: number;
  userId: number;
  playerId: number | null;
  teamId: number | null;
  ownershipType: "personal" | "team";
   platform: string;
   displayPlatform: string | null;
   liveUrl: string;
  isLive: boolean;
  isManuallyLive: boolean;
  title: string | null;
  description: string | null;
  viewerCount: number;
  thumbnailKey: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: { id: number; username: string; role: string };
  teamName?: string | null;
};

/**
 * Check all active notification rules when a live link goes live.
 * Sends notifications based on rule configuration (platform match, role match,
 * ownership type, and team targeting).
 * Returns the number of notifications delivered.
 */
export async function checkLiveNotificationRules(
  liveLink: LiveLinkWithUser,
): Promise<number> {
  const db = getDb();
  const rules = await db
    .select()
    .from(notificationRules)
    .where(eq(notificationRules.isActive, true));

  let totalDelivered = 0;

   for (const rule of rules as NotificationRule[]) {
     // Check platform match — also check displayPlatform for kick/facebook/etc.
     const platformMatch =
       rule.platform === "any" ||
       rule.platform === liveLink.platform ||
       rule.platform === liveLink.displayPlatform;
     if (!platformMatch) {
       continue;
     }

    // Check ownership type match (personal/team/any)
    if (rule.ownershipType !== "any" && rule.ownershipType !== liveLink.ownershipType) {
      continue;
    }

    // For team-specific rules, check teamId matches
    if (rule.ownershipType === "team" && rule.targetTeamId) {
      if (rule.targetTeamId !== liveLink.teamId) {
        continue;
      }
    }

     // Check trigger role match
     if (rule.triggerRole !== "any") {
       const userRole = liveLink.user.role;
       const roleMatches =
         rule.triggerRole === "player" && userRole === "player" ||
         rule.triggerRole === "co-owner" && (userRole === "moderator" || userRole === "admin") ||
         rule.triggerRole === "owner" && userRole === "admin" ||
         rule.triggerRole === "staff" && (userRole === "moderator" || userRole === "admin");
       if (!roleMatches) continue;
     }

    // Check cooldown (don't re-trigger within cooldown period)
    if (rule.cooldownMinutes > 0) {
      const cooldownAgo = new Date(Date.now() - rule.cooldownMinutes * 60_000);
      const recentLog = await db
        .select({ triggeredAt: notificationRuleLogs.triggeredAt })
        .from(notificationRuleLogs)
        .where(
          and(
            eq(notificationRuleLogs.ruleId, rule.id),
            eq(notificationRuleLogs.liveLinkId, liveLink.id),
            sql`${notificationRuleLogs.triggeredAt} > ${cooldownAgo}`,
          ),
        )
        .limit(1);
      if (recentLog[0]) {
        // Within cooldown, skip
        await db.insert(notificationRuleLogs).values({
          ruleId: rule.id,
          liveLinkId: liveLink.id,
          skipped: true,
          skipReason: `Within cooldown (${rule.cooldownMinutes} min)`,
        });
        continue;
      }
    }

    // Resolve the notification type config
    const config = await getNotificationTypeConfig("player_live");
    if (!config || !config.isActive) {
      await db.insert(notificationRuleLogs).values({
        ruleId: rule.id,
        liveLinkId: liveLink.id,
        skipped: true,
        skipReason: "Notification type inactive",
      });
      continue;
    }

    // Resolve target user IDs based on rule's targetType
    let targetIds: number[] = [];
    if (rule.targetType === "everyone") {
      const rows = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.banned, false));
      targetIds = rows.map((r) => r.id);
    } else if (rule.targetType === "role" && rule.targetRole) {
      const rows = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(eq(users.banned, false), eq(users.role, rule.targetRole)),
        );
      targetIds = rows.map((r) => r.id);
    } else if (rule.targetType === "followers") {
      // For now, send to everyone (follower system would be added separately)
      const rows = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.banned, false));
      targetIds = rows.map((r) => r.id);
    } else if (rule.targetType === "users" && rule.targetUserIds) {
      try {
        targetIds = JSON.parse(rule.targetUserIds);
      } catch {
        targetIds = [];
      }
    } else if (rule.targetType === "team" && rule.targetTeamId) {
      // Send to all players/users on this team
      const rows = await db
        .select({ id: users.id })
        .from(users)
        .innerJoin(players, eq(players.userId, users.id))
        .where(and(eq(users.banned, false), eq(players.teamId, rule.targetTeamId)));
      targetIds = rows.map((r) => r.id);
    }

    // Exclude the streamer themselves
    targetIds = targetIds.filter((uid) => uid !== liveLink.user.id);

    // Build notification content — use rule templates if provided, otherwise fall back to config
    const playerName = liveLink.user.username || liveLink.user.id.toString();
    const teamName = liveLink.teamName ?? null;
    const templateValues: Record<string, string | number> = {
      playerName,
      platform: liveLink.platform,
    };
    if (teamName) templateValues.teamName = teamName;
    const title = rule.titleTemplate
      ? expandTemplate(rule.titleTemplate, templateValues)
      : expandTemplate(config.titleTemplate, templateValues);
    const message = rule.messageTemplate
      ? expandTemplate(rule.messageTemplate, templateValues)
      : expandTemplate(config.messageTemplate, templateValues);
    const linkLabel = rule.linkLabel ?? config.linkLabel ?? "Watch Live";

    let delivered = 0;
    for (const userId of targetIds) {
      const id = await deliverNotification({
        type: NOTIFICATION_TYPES.PLAYER_LIVE,
        userId,
        title,
        message,
        linkUrl: liveLink.liveUrl,
        linkLabel,
        youtubeVideoId: liveLink.platform === "youtube" ? extractYouTubeVideoId(liveLink.liveUrl) : null,
        layout: config.layout,
        priority: config.priority,
        sourceType: "live_link",
        sourceId: String(liveLink.id),
      });
      if (id !== null) delivered += 1;
    }

    // Log the result
    await db.insert(notificationRuleLogs).values({
      ruleId: rule.id,
      liveLinkId: liveLink.id,
      deliveredCount: delivered,
      skipped: false,
    });

    totalDelivered += delivered;
   }

   return totalDelivered;
 }

function extractYouTubeVideoId(url: string): string | null {
  // Use the existing parseYouTubeVideoId helper which handles URLs and bare IDs
  return parseYouTubeVideoId(url);
}

export { inArray };
