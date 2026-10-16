import { z } from "zod";
import type { SQL } from "drizzle-orm";
import { and, asc, desc, eq, gte, inArray, isNull, like, ne, or, sql, gt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, adminQuery, moderatorQuery } from "./middleware";
import { allRoles, PERMISSIONS, ADMIN_ONLY_PERMISSIONS } from "@contracts/constants";
import { getDb } from "./queries/connection";
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
  commentReactions,
  users,
  xpHistory,
  media,
  maps,
  achievements,
  playerAchievements,
  teamAchievements,
  predictions,
  predictionOptions,
  predictionVotes,
  quizQuestions,
  quizOptions,
  quizAttempts,
  xpTasks,
  userTaskCompletions,
  weeklyTopFan,
  userAchievements,
  userStreaks,
  userCards,
  cards,
  streakCardRewards,
  xpCardMilestones,
  achievementCardRewards,
  cardGrants,
  cardEvents,
  refreshTokens,
  passwordResets,
  roles,
  rolePermissions,
  playerHighlights,
  highlightComments,
  highlightCommentReactions,
  highlightLikes,
  liveLinks,
  commentReports,
  notificationRules,
  notificationRuleLogs,
   notificationTypes,
    adCampaigns,
    adCreatives,
    adMetrics,
    developerInfo,
     contentComments,
     contentCommentReports,
     fanRewards,
     rewardRedemptions,
     rewardRedemptionHistory,
} from "../db/schema";
import { signKeys } from "./lib/images";
import { storage } from "./lib/storage";
import { youtubeEmbedUrl } from "./lib/youtube";
import { getOrgSettings, getXpEnabledRoles, setXpEnabledRoles, getLiveSectionEnabledRoles, setLiveSectionEnabledRoles } from "./queries/orgSettings";
import { grantCard, checkAndGrantXpMilestoneCards } from "./queries/cards";

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function uniqueSlug(
  table: "teams" | "players" | "tournaments",
  base: string,
  ignoreId?: number,
) {
  const db = getDb();
  const root = slugify(base) || "item";
  let candidate = root;
  let i = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let existing;
    if (table === "teams") {
      existing = await db.query.teams.findFirst({ where: eq(teams.slug, candidate) });
    } else if (table === "players") {
      existing = await db.query.players.findFirst({ where: eq(players.slug, candidate) });
    } else {
      existing = await db.query.tournaments.findFirst({
        where: eq(tournaments.slug, candidate),
      });
    }
    if (!existing || existing.id === ignoreId) return candidate;
    i += 1;
    candidate = `${root}-${i}`;
  }
}

const socialFields = {
  instagram: z.string().max(512).nullish(),
  youtube: z.string().max(512).nullish(),
  x: z.string().max(512).nullish(),
};

const ANNOUNCEMENT_TITLE_MAX = 255;
const ANNOUNCEMENT_MESSAGE_MAX = 10000;
const ANNOUNCEMENT_LINK_LABEL_MAX = 128;
const ANNOUNCEMENT_LINK_URL_MAX = 1024;

function sanitizeAnnouncementText(value: string, max: number) {
  // Strip control characters, trim, hard-cap length.
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim().slice(0, max);
}

function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}


const notificationProcedures = {
  /** List all notification types with their config (admin settings). */
  listNotificationTypes: adminQuery.query(async () => {
    const types = await listNotificationTypeConfigs();
    return types.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      description: t.description,
      icon: t.icon,
      isActive: !!t.isActive,
      isAutomatic: !!t.isAutomatic,
      titleTemplate: t.titleTemplate,
      messageTemplate: t.messageTemplate,
      imageKey: t.imageKey,
      priority: t.priority,
      linkUrl: t.linkUrl,
      linkLabel: t.linkLabel,
      buttonStyle: t.buttonStyle,
      buttonIcon: t.buttonIcon,
      youtubeEnabled: t.youtubeEnabled,
      youtubeAutoThumbnail: t.youtubeAutoThumbnail,
      youtubeCustomThumbnailKey: t.youtubeCustomThumbnailKey,
      layout: t.layout,
      defaultTemplateId: t.defaultTemplateId,
    }));
  }),

  /** Toggle a notification type's active state. */
  setNotificationTypeActive: adminQuery
    .input(
      z.object({
        slug: z.string().min(1).max(64),
        isActive: z.boolean(),
      }),
    )
    .mutation(async ({ input }) => {
      await setNotificationTypeActive(input.slug, input.isActive);
      return { ok: true };
    }),

  /** Toggle a notification type's automatic state. */
  setNotificationTypeAutomatic: adminQuery
    .input(
      z.object({
        slug: z.string().min(1).max(64),
        isAutomatic: z.boolean(),
      }),
    )
    .mutation(async ({ input }) => {
      await setNotificationTypeAutomatic(input.slug, input.isAutomatic);
      return { ok: true };
    }),

  /** Update notification type settings (templates, layout, YouTube, etc.). */
  updateNotificationTypeSettings: adminQuery
    .input(
      z.object({
        slug: z.string().min(1).max(64),
        name: z.string().min(1).max(128).nullish(),
        description: z.string().max(1000).nullish(),
        icon: z.string().max(64).nullish(),
        isActive: z.boolean().optional(),
        isAutomatic: z.boolean().optional(),
        titleTemplate: z.string().max(500).nullish(),
        messageTemplate: z.string().max(2000).nullish(),
        imageKey: z.string().max(512).nullish(),
        priority: z.enum(["normal", "important", "urgent"]).optional(),
        linkUrl: z.string().max(1024).nullish(),
        linkLabel: z.string().max(128).nullish(),
        buttonStyle: z.enum(["primary", "outline", "ghost"]).optional(),
        buttonIcon: z.string().max(64).nullish(),
        youtubeEnabled: z.boolean().optional(),
        youtubeAutoThumbnail: z.boolean().optional(),
        youtubeCustomThumbnailKey: z.string().max(512).nullish(),
        layout: z.enum(["compact", "card", "banner"]).optional(),
        defaultTemplateId: z.number().nullish(),
      }),
    )
    .mutation(async ({ input }) => {
      const { slug, ...updates } = input;
      const updateInput: Parameters<typeof updateNotificationType>[1] = {};
      if (updates.name !== undefined) updateInput.name = updates.name;
      if (updates.description !== undefined) updateInput.description = updates.description;
      if (updates.icon !== undefined) updateInput.icon = updates.icon;
      if (updates.isActive !== undefined) updateInput.isActive = updates.isActive;
      if (updates.isAutomatic !== undefined) updateInput.isAutomatic = updates.isAutomatic;
      if (updates.titleTemplate !== undefined) updateInput.titleTemplate = updates.titleTemplate;
      if (updates.messageTemplate !== undefined) updateInput.messageTemplate = updates.messageTemplate;
      if (updates.imageKey !== undefined) updateInput.imageKey = updates.imageKey;
      if (updates.priority !== undefined) updateInput.priority = updates.priority;
      if (updates.linkUrl !== undefined) updateInput.linkUrl = updates.linkUrl;
      if (updates.linkLabel !== undefined) updateInput.linkLabel = updates.linkLabel;
      if (updates.buttonStyle !== undefined) updateInput.buttonStyle = updates.buttonStyle;
      if (updates.buttonIcon !== undefined) updateInput.buttonIcon = updates.buttonIcon;
      if (updates.youtubeEnabled !== undefined) updateInput.youtubeEnabled = updates.youtubeEnabled;
      if (updates.youtubeAutoThumbnail !== undefined) updateInput.youtubeAutoThumbnail = updates.youtubeAutoThumbnail;
      if (updates.youtubeCustomThumbnailKey !== undefined) updateInput.youtubeCustomThumbnailKey = updates.youtubeCustomThumbnailKey;
      if (updates.layout !== undefined) updateInput.layout = updates.layout;
      if (updates.defaultTemplateId !== undefined) updateInput.defaultTemplateId = updates.defaultTemplateId;
      if (Object.keys(updateInput).length === 0) {
        return { ok: true };
      }
      const ok = await updateNotificationType(slug, updateInput);
      return { ok };
    }),

  // ---------------------------------------------------------------------------
  // Notification Templates
  // ---------------------------------------------------------------------------

  /** List notification templates. */
  listNotificationTemplates: adminQuery
    .input(
      z.object({
        typeSlug: z.string().min(1).max(64).nullish(),
        includeArchived: z.boolean().nullish(),
      }),
    )
    .query(async ({ input }) => {
      return listNotificationTemplates({
        typeSlug: input.typeSlug ?? undefined,
        includeArchived: input.includeArchived ?? false,
      });
    }),

  /** Get a single notification template. */
  getNotificationTemplate: adminQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const tpl = await getNotificationTemplate(input.id);
      if (!tpl) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found." });
      }
      return tpl;
    }),

  /** Create a new notification template. */
  createNotificationTemplate: adminQuery
    .input(
      z.object({
        notificationTypeId: z.number(),
        name: z.string().min(1).max(128),
        description: z.string().max(1000).nullish(),
        isDefault: z.boolean().nullish(),
        titleTemplate: z.string().min(1).max(500),
        messageTemplate: z.string().min(1).max(2000),
        imageKey: z.string().max(512).nullish(),
        priority: z.enum(["normal", "important", "urgent"]).nullish(),
        linkUrl: z.string().max(1024).nullish(),
        linkLabel: z.string().max(128).nullish(),
        buttonStyle: z.enum(["primary", "outline", "ghost"]).nullish(),
        buttonIcon: z.string().max(64).nullish(),
        youtubeEnabled: z.boolean().nullish(),
        youtubeAutoThumbnail: z.boolean().nullish(),
        youtubeCustomThumbnailKey: z.string().max(512).nullish(),
        layout: z.enum(["compact", "card", "banner"]).nullish(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const templateId = await createNotificationTemplate({
        notificationTypeId: input.notificationTypeId,
        name: input.name,
        description: input.description ?? null,
        isDefault: input.isDefault ?? false,
        titleTemplate: input.titleTemplate,
        messageTemplate: input.messageTemplate,
        imageKey: input.imageKey ?? null,
        priority: input.priority ?? null,
        linkUrl: input.linkUrl ?? null,
        linkLabel: input.linkLabel ?? null,
        buttonStyle: input.buttonStyle ?? null,
        buttonIcon: input.buttonIcon ?? null,
        youtubeEnabled: input.youtubeEnabled ?? false,
        youtubeAutoThumbnail: input.youtubeAutoThumbnail ?? true,
        youtubeCustomThumbnailKey: input.youtubeCustomThumbnailKey ?? null,
        layout: input.layout ?? "compact",
        createdById: ctx.user.id,
      });
      return { id: templateId };
    }),

  /** Update an existing notification template. */
  updateNotificationTemplate: adminQuery
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(128).optional(),
        description: z.string().max(1000).nullish(),
        isDefault: z.boolean().optional(),
        titleTemplate: z.string().min(1).max(500).optional(),
        messageTemplate: z.string().min(1).max(2000).optional(),
        imageKey: z.string().max(512).nullish(),
        priority: z.enum(["normal", "important", "urgent"]).optional(),
        linkUrl: z.string().max(1024).nullish(),
        linkLabel: z.string().max(128).nullish(),
        buttonStyle: z.enum(["primary", "outline", "ghost"]).optional(),
        buttonIcon: z.string().max(64).nullish(),
        youtubeEnabled: z.boolean().optional(),
        youtubeAutoThumbnail: z.boolean().optional(),
        youtubeCustomThumbnailKey: z.string().max(512).nullish(),
        layout: z.enum(["compact", "card", "banner"]).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      const updateInput: Parameters<typeof updateNotificationTemplate>[1] = {};
      if (updates.name !== undefined) updateInput.name = updates.name;
      if (updates.description !== undefined) updateInput.description = updates.description;
      if (updates.isDefault !== undefined) updateInput.isDefault = updates.isDefault;
      if (updates.titleTemplate !== undefined) updateInput.titleTemplate = updates.titleTemplate;
      if (updates.messageTemplate !== undefined) updateInput.messageTemplate = updates.messageTemplate;
      if (updates.imageKey !== undefined) updateInput.imageKey = updates.imageKey;
      if (updates.priority !== undefined) updateInput.priority = updates.priority;
      if (updates.linkUrl !== undefined) updateInput.linkUrl = updates.linkUrl;
      if (updates.linkLabel !== undefined) updateInput.linkLabel = updates.linkLabel;
      if (updates.buttonStyle !== undefined) updateInput.buttonStyle = updates.buttonStyle;
      if (updates.buttonIcon !== undefined) updateInput.buttonIcon = updates.buttonIcon;
      if (updates.youtubeEnabled !== undefined) updateInput.youtubeEnabled = updates.youtubeEnabled;
      if (updates.youtubeAutoThumbnail !== undefined) updateInput.youtubeAutoThumbnail = updates.youtubeAutoThumbnail;
      if (updates.youtubeCustomThumbnailKey !== undefined) updateInput.youtubeCustomThumbnailKey = updates.youtubeCustomThumbnailKey;
      if (updates.layout !== undefined) updateInput.layout = updates.layout;
      const ok = await updateNotificationTemplate(id, updateInput);
      return { ok };
    }),

  /** Archive (soft-delete) a notification template. */
  archiveNotificationTemplate: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await archiveNotificationTemplate(input.id);
      return { ok: true };
    }),

  /** Restore an archived template. */
  restoreNotificationTemplate: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await restoreNotificationTemplate(input.id);
      return { ok: true };
    }),

  /** Duplicate a template. */
  duplicateNotificationTemplate: adminQuery
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(128),
      }),
    )
    .mutation(async ({ input }) => {
      const newId = await duplicateNotificationTemplate(input.id, input.name);
      return { id: newId };
    }),

  /** Preview a template with placeholder values. */
  previewNotificationTemplate: adminQuery
    .input(
      z.object({
        id: z.number(),
        placeholders: z.record(z.string(), z.string()),
      }),
    )
    .mutation(async ({ input }) => {
      return previewNotificationTemplate(input.id, input.placeholders);
    }),

  /** Send a template-based notification to targeted users. */
  sendTemplateNotification: adminQuery
    .input(
      z.object({
        templateId: z.number(),
        title: z.string().max(500).nullish(),
        message: z.string().max(2000).nullish(),
        imageKey: z.string().max(512).nullish(),
        linkUrl: z.string().max(1024).nullish(),
        linkLabel: z.string().max(128).nullish(),
        youtubeVideoId: z.string().max(64).nullish(),
        priority: z.enum(["normal", "important", "urgent"]).nullish(),
        layout: z.enum(["compact", "card", "banner"]).nullish(),
        targetType: z.enum(["everyone", "role", "users"]),
        targetRole: z.string().max(64).nullish(),
        targetUserIds: z.array(z.number()).nullish(),
        sourceType: z.string().max(64).nullish(),
        sourceId: z.string().max(255).nullish(),
      }),
    )
    .mutation(async ({ input }) => {
      if (input.linkUrl && !isValidUrl(input.linkUrl)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid link URL." });
      }
      const result = await sendTemplateNotification({
        templateId: input.templateId,
        title: input.title ?? undefined,
        message: input.message ?? undefined,
        imageKey: input.imageKey ?? null,
        linkUrl: input.linkUrl ?? null,
        linkLabel: input.linkLabel ?? null,
        youtubeVideoId: input.youtubeVideoId ?? null,
        priority: input.priority ?? undefined,
        layout: input.layout ?? undefined,
        targetType: input.targetType,
        targetRole: input.targetRole ?? null,
        targetUserIds: input.targetUserIds ?? undefined,
        sourceType: input.sourceType ?? null,
        sourceId: input.sourceId ?? null,
      });
      return result;
    }),

  /** Set a template as the default for its notification type. */
  setDefaultTemplate: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await updateNotificationTemplate(input.id, { isDefault: true });
      return { ok: true };
    }),

  /** List announcements with computed stats. */
  listAnnouncements: adminQuery.query(async () => {
    return listAnnouncementsAdmin();
  }),

  /** Get a single announcement for editing. */
  getAnnouncement: adminQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const announcement = await getAnnouncementAdmin(input.id);
      if (!announcement) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Announcement not found." });
      }
      return announcement;
    }),

  /** Create an announcement. */
  createAnnouncement: adminQuery
    .input(
      z.object({
        title: z.string().min(1).max(ANNOUNCEMENT_TITLE_MAX),
        message: z.string().min(1).max(ANNOUNCEMENT_MESSAGE_MAX),
        imageKey: z.string().max(512).nullish(),
        priority: z.enum(["normal", "important", "urgent"]),
        status: z.enum(["draft", "scheduled", "published"]),
        scheduledAt: z.string().nullish(),
        targetType: z.enum(["everyone", "role", "users"]),
        targetRole: z.string().max(64).nullish(),
        targetUserIds: z.array(z.number()).nullish(),
        links: z
          .array(
            z.object({
              url: z.string().max(ANNOUNCEMENT_LINK_URL_MAX),
              label: z.string().min(1).max(ANNOUNCEMENT_LINK_LABEL_MAX),
            }),
          )
          .max(10),
        buttonStyle: z.enum(["primary", "outline", "ghost"]).nullish(),
        buttonIcon: z.string().max(64).nullish(),
        youtubeVideoId: z.string().max(64).nullish(),
        layout: z.enum(["compact", "card", "banner"]).nullish(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const title = sanitizeAnnouncementText(input.title, ANNOUNCEMENT_TITLE_MAX);
      const message = sanitizeAnnouncementText(
        input.message,
        ANNOUNCEMENT_MESSAGE_MAX,
      );
      if (!title) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Title is required." });
      }
      if (!message) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Message is required." });
      }

      // Validate links
      const links = input.links.map((l) => ({
        url: l.url.trim(),
        label: sanitizeAnnouncementText(l.label, ANNOUNCEMENT_LINK_LABEL_MAX),
      }));
      for (const link of links) {
        if (!isValidUrl(link.url)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid link URL: ${link.url}`,
          });
        }
        if (!link.label) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Link label is required.",
          });
        }
      }

      // Validate schedule
      let scheduledAt: Date | null = null;
      if (input.status === "scheduled") {
        if (!input.scheduledAt) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Scheduled time is required for scheduled announcements.",
          });
        }
        scheduledAt = new Date(input.scheduledAt);
        if (Number.isNaN(scheduledAt.getTime())) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid scheduled time.",
          });
        }
      }

      // Validate role targeting
      let targetRole: string | null = null;
      if (input.targetType === "role") {
        if (!input.targetRole) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Target role is required when targeting a role.",
          });
        }
        targetRole = input.targetRole;
      }

      // Validate user targeting
      let targetUserIds: number[] | undefined;
      if (input.targetType === "users") {
        if (!input.targetUserIds || input.targetUserIds.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "At least one user is required when targeting specific users.",
          });
        }
        targetUserIds = input.targetUserIds;
      }

      const id = await createAnnouncement({
        title,
        message,
        imageKey: input.imageKey ?? null,
        priority: input.priority,
        status: input.status,
        scheduledAt,
        targetType: input.targetType,
        targetRole,
        targetUserIds,
        links,
        buttonStyle: input.buttonStyle ?? "primary",
        buttonIcon: input.buttonIcon ?? null,
        youtubeVideoId: input.youtubeVideoId ?? null,
        layout: input.layout ?? "compact",
        createdById: ctx.user.id,
      });

      // Publish immediately if requested
      if (input.status === "published") {
        await publishAnnouncement(id);
      }

      return { id };
    }),

  /** Update an announcement. */
  updateAnnouncement: adminQuery
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).max(ANNOUNCEMENT_TITLE_MAX),
        message: z.string().min(1).max(ANNOUNCEMENT_MESSAGE_MAX),
        imageKey: z.string().max(512).nullish(),
        priority: z.enum(["normal", "important", "urgent"]),
        status: z.enum(["draft", "scheduled", "published"]),
        scheduledAt: z.string().nullish(),
        targetType: z.enum(["everyone", "role", "users"]),
        targetRole: z.string().max(64).nullish(),
        targetUserIds: z.array(z.number()).nullish(),
         links: z
           .array(
             z.object({
               url: z.string().max(ANNOUNCEMENT_LINK_URL_MAX),
               label: z.string().min(1).max(ANNOUNCEMENT_LINK_LABEL_MAX),
             }),
           )
           .max(10),
         buttonStyle: z.enum(["primary", "outline", "ghost"]).nullish(),
         buttonIcon: z.string().max(64).nullish(),
         youtubeVideoId: z.string().max(64).nullish(),
         layout: z.enum(["compact", "card", "banner"]).nullish(),
       }),
     )
     .mutation(async ({ input }) => {
      const existing = await getAnnouncementAdmin(input.id);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Announcement not found." });
      }

      const title = sanitizeAnnouncementText(input.title, ANNOUNCEMENT_TITLE_MAX);
      const message = sanitizeAnnouncementText(
        input.message,
        ANNOUNCEMENT_MESSAGE_MAX,
      );
      if (!title) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Title is required." });
      }
      if (!message) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Message is required." });
      }

      const links = input.links.map((l) => ({
        url: l.url.trim(),
        label: sanitizeAnnouncementText(l.label, ANNOUNCEMENT_LINK_LABEL_MAX),
      }));
      for (const link of links) {
        if (!isValidUrl(link.url)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid link URL: ${link.url}`,
          });
        }
        if (!link.label) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Link label is required.",
          });
        }
      }

      let scheduledAt: Date | null = null;
      if (input.status === "scheduled") {
        if (!input.scheduledAt) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Scheduled time is required for scheduled announcements.",
          });
        }
        scheduledAt = new Date(input.scheduledAt);
        if (Number.isNaN(scheduledAt.getTime())) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid scheduled time.",
          });
        }
      }

      let targetRole: string | null = null;
      if (input.targetType === "role") {
        if (!input.targetRole) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Target role is required when targeting a role.",
          });
        }
        targetRole = input.targetRole;
      }

      let targetUserIds: number[] | undefined;
      if (input.targetType === "users") {
        if (!input.targetUserIds || input.targetUserIds.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "At least one user is required when targeting specific users.",
          });
        }
        targetUserIds = input.targetUserIds;
      }

      await updateAnnouncement(input.id, {
        title,
        message,
        imageKey: input.imageKey ?? null,
        priority: input.priority,
        status: input.status,
        scheduledAt,
        targetType: input.targetType,
        targetRole,
        targetUserIds,
        links,
        buttonStyle: input.buttonStyle ?? "primary",
        buttonIcon: input.buttonIcon ?? null,
        youtubeVideoId: input.youtubeVideoId ?? null,
        layout: input.layout ?? "compact",
      });

      // If publishing now, deliver
      if (input.status === "published" && existing.status !== "published") {
        await publishAnnouncement(input.id);
      }

      return { ok: true };
    }),

  /** Publish a draft/scheduled announcement immediately. */
  publishAnnouncement: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const existing = await getAnnouncementAdmin(input.id);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Announcement not found." });
      }
      const delivered = await publishAnnouncement(input.id);
      return { ok: true, delivered };
    }),

  /** Deactivate/reactivate an announcement. */
  setAnnouncementActive: adminQuery
    .input(z.object({ id: z.number(), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      const existing = await getAnnouncementAdmin(input.id);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Announcement not found." });
      }
      await setAnnouncementActive(input.id, input.isActive);
      return { ok: true };
    }),

  /** Delete an announcement. */
  deleteAnnouncement: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const existing = await getAnnouncementAdmin(input.id);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Announcement not found." });
      }
      await deleteAnnouncement(input.id);
      return { ok: true };
    }),

  /** Search users for targeting. */
  searchUsers: adminQuery
    .input(z.object({ query: z.string().min(1).max(255) }))
    .query(async ({ input }) => {
      return searchUsersForTargeting(input.query);
    }),

  /** List roles for targeting. */
  listNotificationRoles: adminQuery.query(async () => {
    return listRolesForTargeting();
  }),

  /** Send a manual notification (Player Live / Clutch / Engagement). */
  sendManualNotification: adminQuery
    .input(
      z.object({
        type: z.enum([
          "player_live",
          "clutch_highlight",
          "engagement",
        ]),
        title: z.string().min(1).max(255),
        message: z.string().max(2000).nullish(),
        linkUrl: z.string().max(1024).nullish(),
        linkLabel: z.string().max(128).nullish(),
        youtubeVideoId: z.string().max(64).nullish(),
        targetType: z.enum(["everyone", "role", "users"]),
        targetRole: z.string().max(64).nullish(),
        targetUserIds: z.array(z.number()).nullish(),
      }),
    )
    .mutation(async ({ input }) => {
      const title = sanitizeAnnouncementText(input.title, 255);
      if (!title) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Title is required." });
      }
      if (input.linkUrl && !isValidUrl(input.linkUrl)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid link URL.",
        });
      }
      const result = await sendManualNotification({
        type: input.type,
        title,
        message: input.message ?? null,
        linkUrl: input.linkUrl ?? null,
        linkLabel: input.linkLabel ?? null,
        youtubeVideoId: input.youtubeVideoId ?? null,
        targetType: input.targetType,
        targetRole: input.targetRole ?? null,
        targetUserIds: input.targetUserIds ?? undefined,
      });
      return result;
    }),

  /** Trigger Player Live notification manually (admin). */
  sendPlayerLive: adminQuery
    .input(
      z.object({
        playerName: z.string().min(1).max(255),
        streamUrl: z.string().max(1024).nullish(),
        youtubeVideoId: z.string().max(64).nullish(),
        targetType: z.enum(["everyone", "role", "users"]).nullish(),
        targetRole: z.string().max(64).nullish(),
        targetUserIds: z.array(z.number()).nullish(),
      }),
    )
    .mutation(async ({ input }) => {
      if (input.streamUrl && !isValidUrl(input.streamUrl)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid stream URL.",
        });
      }
      return notifyPlayerLive({
        playerName: input.playerName,
        streamUrl: input.streamUrl ?? null,
        youtubeVideoId: input.youtubeVideoId ?? null,
        targetType: input.targetType ?? "everyone",
        targetRole: input.targetRole ?? null,
        targetUserIds: input.targetUserIds ?? undefined,
      });
    }),

  /** Trigger Clutch/Highlight notification manually (admin). */
  sendClutchHighlight: adminQuery
    .input(
      z.object({
        title: z.string().min(1).max(255),
        highlightUrl: z.string().max(1024).nullish(),
        imageKey: z.string().max(512).nullish(),
        youtubeVideoId: z.string().max(64).nullish(),
        targetType: z.enum(["everyone", "role", "users"]).nullish(),
        targetRole: z.string().max(64).nullish(),
        targetUserIds: z.array(z.number()).nullish(),
      }),
    )
    .mutation(async ({ input }) => {
      if (input.highlightUrl && !isValidUrl(input.highlightUrl)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid highlight URL.",
        });
      }
      return notifyClutchHighlight({
        title: input.title,
        highlightUrl: input.highlightUrl ?? null,
        imageKey: input.imageKey ?? null,
        youtubeVideoId: input.youtubeVideoId ?? null,
        targetType: input.targetType ?? "everyone",
        targetRole: input.targetRole ?? null,
        targetUserIds: input.targetUserIds ?? undefined,
      });
    }),

  /** Run the scheduler (publish due scheduled announcements). */
  runScheduler: adminQuery.mutation(async () => {
    const result = await runNotificationScheduler();
    return result;
  }),
};

export const adminRouter = createRouter({
  // -------------------------------------------------------------- dashboard
  dashboard: adminQuery.query(async () => {
    const db = getDb();
    const [teamCount] = await db.select({ count: sql<number>`count(*)` }).from(teams);
    const [playerCount] = await db.select({ count: sql<number>`count(*)` }).from(players);
    const [upcomingCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tournaments)
      .where(eq(tournaments.status, "upcoming"));
    const [liveCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tournaments)
      .where(eq(tournaments.status, "ongoing"));
    const [completedCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tournaments)
      .where(eq(tournaments.status, "completed"));
    const [matchCount] = await db.select({ count: sql<number>`count(*)` }).from(matches);
    const [commentCount] = await db.select({ count: sql<number>`count(*)` }).from(comments);
    const recentTournaments = await db
      .select()
      .from(tournaments)
      .orderBy(desc(tournaments.updatedAt))
      .limit(5);
    const recentComments = await db
      .select({
        id: comments.id,
        content: comments.content,
        createdAt: comments.createdAt,
        userName: users.name,
        tournamentName: tournaments.name,
      })
      .from(comments)
      .innerJoin(users, eq(comments.userId, users.id))
      .innerJoin(tournaments, eq(comments.tournamentId, tournaments.id))
      .orderBy(desc(comments.createdAt))
      .limit(5);
    return {
      teams: Number(teamCount.count),
      players: Number(playerCount.count),
      upcoming: Number(upcomingCount.count),
      live: Number(liveCount.count),
      completed: Number(completedCount.count),
      matches: Number(matchCount.count),
      comments: Number(commentCount.count),
      recentTournaments,
      recentComments,
    };
  }),

  // ------------------------------------------------------------------- org
  updateOrg: adminQuery
    .input(
      z.object({
        orgName: z.string().min(1).max(255),
        shortName: z.string().min(1).max(32),
        tagline: z.string().max(255),
        description: z.string().nullish(),
        logoKey: z.string().max(512).nullish(),
        instagram: z.string().max(512).nullish(),
        youtube: z.string().max(512).nullish(),
        x: z.string().max(512).nullish(),
        discord: z.string().max(512).nullish(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [org] = await db.select().from(orgSettings).limit(1);
      if (org) {
        await db.update(orgSettings).set(input).where(eq(orgSettings.id, org.id));
      } else {
        await db.insert(orgSettings).values(input);
      }
      return { ok: true };
    }),

  // ------------------------------------------------------- Developer Info
  getDeveloperInfo: adminQuery.query(async () => {
    const db = getDb();
    const info = await db.query.developerInfo.findFirst();
    if (!info) return null;
    const urls = await signKeys([info.developerPhotoKey].filter(Boolean) as string[]);
    return {
      ...info,
      photoUrl: info.developerPhotoKey ? (urls[info.developerPhotoKey] ?? null) : null,
    };
  }),

  updateDeveloperInfo: adminQuery
    .input(
      z.object({
        developerName: z.string().min(1).max(255),
        developerPhotoKey: z.string().max(512).nullish(),
        bio: z.string().max(2000).nullish(),
        instagramUrl: z.string().max(512).nullish(),
        youtubeUrl: z.string().max(512).nullish(),
        discordUrl: z.string().max(512).nullish(),
        portfolioUrl: z.string().max(512).nullish(),
        showOnHomePage: z.boolean().default(false),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const existing = await db.query.developerInfo.findFirst();
      if (existing) {
        await db
          .update(developerInfo)
          .set({
            developerName: input.developerName,
            developerPhotoKey: input.developerPhotoKey ?? null,
            bio: input.bio ?? null,
            instagramUrl: input.instagramUrl ?? null,
            youtubeUrl: input.youtubeUrl ?? null,
            discordUrl: input.discordUrl ?? null,
            portfolioUrl: input.portfolioUrl ?? null,
            showOnHomePage: input.showOnHomePage,
          })
          .where(eq(developerInfo.id, existing.id));
      } else {
        await db.insert(developerInfo).values({
          developerName: input.developerName,
          developerPhotoKey: input.developerPhotoKey ?? null,
          bio: input.bio ?? null,
          instagramUrl: input.instagramUrl ?? null,
          youtubeUrl: input.youtubeUrl ?? null,
          discordUrl: input.discordUrl ?? null,
          portfolioUrl: input.portfolioUrl ?? null,
          showOnHomePage: input.showOnHomePage,
        });
      }
      return { ok: true };
    }),

  // ----------------------------------------------------------------- people
  listPeople: adminQuery.query(async () => {
    const db = getDb();
    const list = await db.select().from(people).orderBy(asc(people.displayOrder));
    const urls = await signKeys(list.map((p) => p.photoKey));
    return list.map((p) => ({
      ...p,
      photoUrl: p.photoKey ? (urls[p.photoKey] ?? null) : null,
    }));
  }),

  upsertPerson: adminQuery
    .input(
      z.object({
        id: z.number().optional(),
        kind: z.enum(["owner", "legend"]),
        name: z.string().min(1).max(255),
        position: z.string().max(255).nullish(),
        description: z.string().nullish(),
        photoKey: z.string().max(512).nullish(),
        displayOrder: z.number().int().default(0),
        ...socialFields,
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      if (id) {
        await db.update(people).set(data).where(eq(people.id, id));
        return { id };
      }
      const [{ id: newId }] = await db.insert(people).values(data).$returningId();
      return { id: newId };
    }),

  deletePerson: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await getDb().delete(people).where(eq(people.id, input.id));
      return { ok: true };
    }),

  // ------------------------------------------------------------------ teams
  listTeams: adminQuery.query(async () => {
    const db = getDb();
    const list = await db.select().from(teams).orderBy(asc(teams.displayOrder));
    const urls = await signKeys(list.map((t) => t.logoKey));
    return list.map((t) => ({
      ...t,
      logoUrl: t.logoKey ? (urls[t.logoKey] ?? null) : null,
    }));
  }),

  upsertTeam: adminQuery
    .input(
      z.object({
        id: z.number().optional(),
        name: z.string().min(1).max(255),
        category: z.string().max(128).nullish(),
        tagline: z.string().max(255).nullish(),
        description: z.string().nullish(),
        logoKey: z.string().max(512).nullish(),
        accent: z.enum(["blue", "red"]).default("blue"),
        displayOrder: z.number().int().default(0),
        ...socialFields,
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...raw } = input;
      const data = { ...raw, category: raw.category ?? "Esports Team" };
      if (id) {
        await db.update(teams).set(data).where(eq(teams.id, id));
        return { id };
      }
      const slug = await uniqueSlug("teams", input.name);
      const [{ id: newId }] = await db
        .insert(teams)
        .values({ ...data, slug })
        .$returningId();
      return { id: newId, slug };
    }),

  deleteTeam: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(teamAchievements).where(eq(teamAchievements.teamId, input.id));
      await db
        .update(players)
        .set({ teamId: null, status: "former" })
        .where(eq(players.teamId, input.id));
      await db.delete(teams).where(eq(teams.id, input.id));
      return { ok: true };
    }),

  // ---------------------------------------------------------------- players
  listPlayers: adminQuery
    .input(z.object({ teamId: z.number().optional(), showFormer: z.boolean().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const conditions: SQL<unknown>[] = [];
      if (input?.teamId) conditions.push(eq(players.teamId, input.teamId));
      if (!input?.showFormer) conditions.push(ne(players.status, "former"));
      const list = await db
        .select()
        .from(players)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(asc(players.displayOrder));
      const teamList = await db.select().from(teams);
      const urls = await signKeys(list.map((p) => p.photoKey));
      return list.map((p) => ({
        ...p,
        photoUrl: p.photoKey ? (urls[p.photoKey] ?? null) : null,
        team: teamList.find((t) => t.id === p.teamId) ?? null,
      }));
    }),

  upsertPlayer: adminQuery
    .input(
      z.object({
        id: z.number().optional(),
        teamId: z.number(),
        userId: z.number().nullish(),
        realName: z.string().max(255).nullish(),
        ign: z.string().min(1).max(255),
        role: z.string().max(128).nullish(),
        photoKey: z.string().max(512).nullish(),
        bio: z.string().nullish(),
        status: z.enum(["active", "substitute", "former"]).default("active"),
        joinedDate: z.date().nullish(),
        displayOrder: z.number().int().default(0),
        ...socialFields,
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      if (id) {
        await db.update(players).set(data).where(eq(players.id, id));
        return { id };
      }
      const slug = await uniqueSlug("players", input.ign);
      const [{ id: newId }] = await db
        .insert(players)
        .values({ ...data, slug })
        .$returningId();
      return { id: newId, slug };
    }),

  deletePlayer: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db
        .update(players)
        .set({ status: "former", teamId: null, userId: null })
        .where(eq(players.id, input.id));
      if ((result[0]?.affectedRows ?? 0) === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Player not found.",
        });
      }
      return { ok: true };
    }),

  // ------------------------------------------------------- player highlights
  listHighlights: adminQuery
    .input(
      z.object({
        playerId: z.number().optional(),
        active: z.boolean().optional(),
        search: z.string().optional(),
      }).optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input?.playerId) conditions.push(eq(playerHighlights.playerId, input.playerId));
      if (input?.active !== undefined) conditions.push(eq(playerHighlights.isActive, input.active));
      if (input?.search)
        conditions.push(sql`${playerHighlights.title} like ${`%${input.search}%`}`);

      const list = await db
        .select()
        .from(playerHighlights)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(playerHighlights.createdAt));

      const playerIds = [...new Set(list.map((h) => h.playerId))];
      const playersList = await db
        .select()
        .from(players)
        .where(
          playerIds.length ? inArray(players.id, playerIds) : sql`1=0`,
        );
      const teamsList = await db.select().from(teams);
      const usersList = await db.select().from(users);

      const playerMap = new Map(playersList.map((p) => [p.id, p]));
      const teamMap = new Map(teamsList.map((t) => [t.id, t]));
      const userMap = new Map(usersList.map((u) => [u.id, u]));

      const allKeys = [
        ...list.map((h) => h.thumbnailKey),
        ...list.map((h) => h.videoKey),
      ].filter(Boolean) as string[];
      const urls = allKeys.length ? await signKeys(allKeys) : {};

      return list.map((h) => {
        const p = playerMap.get(h.playerId);
        const team = p?.teamId ? teamMap.get(p.teamId) ?? null : null;
        return {
          ...h,
          thumbnailUrl: h.thumbnailKey ? (urls[h.thumbnailKey] ?? null) : null,
          videoUrl: h.videoKey ? (urls[h.videoKey] ?? null) : null,
          embedUrl: h.youtubeVideoId ? youtubeEmbedUrl(h.youtubeVideoId) : null,
          watchUrl: h.youtubeVideoId
            ? `https://www.youtube.com/watch?v=${h.youtubeVideoId}`
            : null,
          player: { id: p?.id ?? null, ign: p?.ign ?? null, slug: p?.slug ?? null },
          team: team ? { id: team.id, name: team.name, slug: team.slug } : null,
          user: userMap.get(h.userId)
            ? {
                id: userMap.get(h.userId)!.id,
                name: userMap.get(h.userId)!.name,
                username: userMap.get(h.userId)!.username,
              }
            : null,
        };
      });
    }),

  featureHighlight: moderatorQuery
    .input(z.object({ id: z.number(), isFeatured: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(playerHighlights)
        .set({ isActive: input.isFeatured })
        .where(eq(playerHighlights.id, input.id));
      return { ok: true };
    }),

  updateHighlight: adminQuery
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().max(2000).nullish().optional(),
        isActive: z.boolean().optional(),
        thumbnailKey: z.string().max(512).nullish().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const updateData: Record<string, unknown> = {};
      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;
      if (input.thumbnailKey !== undefined) updateData.thumbnailKey = input.thumbnailKey;
      if (Object.keys(updateData).length > 0) {
        await db.update(playerHighlights).set(updateData).where(eq(playerHighlights.id, input.id));
      }
      return { ok: true };
    }),

  deleteHighlight: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const existing = await db.query.playerHighlights.findFirst({
        where: eq(playerHighlights.id, input.id),
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Highlight not found." });
      }

      await db.delete(highlightCommentReactions).where(
        sql`${highlightCommentReactions.commentId} in (select id from ${highlightComments} where ${highlightComments.highlightId} = ${existing.id})`,
      );
      await db.delete(highlightComments).where(eq(highlightComments.highlightId, existing.id));
      await db.delete(highlightLikes).where(eq(highlightLikes.highlightId, existing.id));

      if (existing.videoKey) {
        await storage.deleteFile({ fileKey: existing.videoKey });
      }
      await db.delete(playerHighlights).where(eq(playerHighlights.id, existing.id));
      return { ok: true };
    }),

  // ------------------------------------------------------------ tournaments
  listTournaments: adminQuery
    .input(z.object({ teamId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const list = await db
        .select()
        .from(tournaments)
        .where(input?.teamId ? eq(tournaments.teamId, input.teamId) : undefined)
        .orderBy(desc(tournaments.startDate));
      const teamList = await db.select().from(teams);
      const urls = await signKeys(list.map((t) => t.logoKey));
      return list.map((t) => ({
        ...t,
        logoUrl: t.logoKey ? (urls[t.logoKey] ?? null) : null,
        team: teamList.find((x) => x.id === t.teamId) ?? null,
      }));
    }),

  /** Tournaments eligible for predictions: upcoming or ongoing only. */
  listPredictionTournaments: adminQuery.query(async () => {
    const db = getDb();
    const list = await db
      .select()
      .from(tournaments)
      .where(or(eq(tournaments.status, "upcoming"), eq(tournaments.status, "ongoing")))
      .orderBy(desc(tournaments.startDate));
    const teamList = await db.select().from(teams);
    const urls = await signKeys(list.map((t) => t.logoKey));
    return list.map((t) => ({
      ...t,
      logoUrl: t.logoKey ? (urls[t.logoKey] ?? null) : null,
      team: teamList.find((x) => x.id === t.teamId) ?? null,
    }));
  }),

  upsertTournament: adminQuery
    .input(
      z.object({
        id: z.number().optional(),
        teamId: z.number().int().min(1),
        name: z.string().min(1).max(255),
        description: z.string().nullish(),
        logoKey: z.string().max(512).nullish(),
        startDate: z.date().nullish(),
        startTime: z.string().max(32).nullish(),
        status: z.enum(["upcoming", "ongoing", "completed"]).default("upcoming"),
        youtubeLiveUrl: z.string().max(512).nullish(),
        instagramLiveUrl: z.string().max(512).nullish(),
        numberOfMatches: z.number().int().min(0).default(0),
        pointTableKey: z.string().max(512).nullish(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      if (id) {
        await db.update(tournaments).set(data).where(eq(tournaments.id, id));
        return { id };
      }
      const slug = await uniqueSlug("tournaments", input.name);
      const [{ id: newId }] = await db
        .insert(tournaments)
        .values({ ...data, slug })
        .$returningId();
      return { id: newId, slug };
    }),

  deleteTournament: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteTournamentCascade(input.id);
      return { ok: true };
    }),

  getTournamentAdmin: adminQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const tournament = await db.query.tournaments.findFirst({
        where: eq(tournaments.id, input.id),
      });
      if (!tournament) throw new TRPCError({ code: "NOT_FOUND" });
      const matchList = await db
        .select()
        .from(matches)
        .where(eq(matches.tournamentId, tournament.id))
        .orderBy(asc(matches.matchNumber));
      const lineup = matchList.length
        ? await db
            .select()
            .from(matchPlayers)
            .where(
              sql`${matchPlayers.matchId} in (${sql.join(
                matchList.map((m) => sql`${m.id}`),
                sql`, `,
              )})`,
            )
        : [];
      const roster = await db
        .select()
        .from(players)
        .where(tournament.teamId ? eq(players.teamId, tournament.teamId) : isNull(players.teamId))
        .orderBy(asc(players.displayOrder));
      const mvpPlayer = tournament.mvpPlayerId
        ? await db.query.players.findFirst({
            where: eq(players.id, tournament.mvpPlayerId),
          })
        : null;
      const mapList = await db.select().from(maps);
      const mapById = new Map(mapList.map((m) => [m.id, m]));
      const urls = await signKeys([
        tournament.logoKey,
        tournament.pointTableKey,
        ...roster.map((p) => p.photoKey),
        ...mapList.map((m) => m.imageKey),
        ...(mvpPlayer?.photoKey ? [mvpPlayer.photoKey] : []),
      ]);
      return {
        ...tournament,
        logoUrl: tournament.logoKey ? (urls[tournament.logoKey] ?? null) : null,
        pointTableUrl: tournament.pointTableKey
          ? (urls[tournament.pointTableKey] ?? null)
          : null,
        mvpPlayer: mvpPlayer
          ? {
              ...mvpPlayer,
              photoUrl: mvpPlayer.photoKey ? (urls[mvpPlayer.photoKey] ?? null) : null,
            }
          : null,
        matches: matchList.map((m) => {
          const map = m.mapId ? mapById.get(m.mapId) : undefined;
          return {
            ...m,
            map: map
              ? {
                  ...map,
                  imageUrl: map.imageKey ? (urls[map.imageKey] ?? null) : null,
                }
              : null,
            matchPlayers: lineup.filter((p) => p.matchId === m.id),
          };
        }),
        roster: roster.map((p) => ({
          ...p,
          photoUrl: p.photoKey ? (urls[p.photoKey] ?? null) : null,
        })),
      };
    }),

  // ------------------------------------------------------------------- maps
  setTournamentMVP: adminQuery
    .input(
      z.object({
        tournamentId: z.number(),
        mvpPlayerId: z.number().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const tournament = await db.query.tournaments.findFirst({
        where: eq(tournaments.id, input.tournamentId),
      });
      if (!tournament) throw new TRPCError({ code: "NOT_FOUND", message: "Tournament not found." });
      if (input.mvpPlayerId !== null) {
        const player = await db.query.players.findFirst({
          where: eq(players.id, input.mvpPlayerId),
        });
        if (!player) throw new TRPCError({ code: "NOT_FOUND", message: "Player not found." });
      }
      await db
        .update(tournaments)
        .set({ mvpPlayerId: input.mvpPlayerId })
        .where(eq(tournaments.id, input.tournamentId));
      return { ok: true };
    }),

  // ------------------------------------------------------------------- maps
  listMaps: adminQuery.query(async () => {
    const db = getDb();
    const list = await db.select().from(maps).orderBy(asc(maps.displayOrder), asc(maps.id));
    const urls = await signKeys(list.map((m) => m.imageKey));
    return list.map((m) => ({
      ...m,
      imageUrl: m.imageKey ? (urls[m.imageKey] ?? null) : null,
    }));
  }),

  upsertMap: adminQuery
    .input(
      z.object({
        id: z.number().optional(),
        name: z.string().min(1).max(128),
        imageKey: z.string().max(512).nullish(),
        displayOrder: z.number().int().default(0),
        isActive: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      if (id) {
        await db.update(maps).set(data).where(eq(maps.id, id));
        return { id };
      }
      const [{ id: newId }] = await db.insert(maps).values(data).$returningId();
      return { id: newId };
    }),

  toggleMapActive: adminQuery
    .input(z.object({ id: z.number(), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      await getDb()
        .update(maps)
        .set({ isActive: input.isActive })
        .where(eq(maps.id, input.id));
      return { ok: true };
    }),

  reorderMaps: adminQuery
    .input(
      z.object({
        items: z
          .array(z.object({ id: z.number(), displayOrder: z.number().int() }))
          .min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      for (const item of input.items) {
        await db
          .update(maps)
          .set({ displayOrder: item.displayOrder })
          .where(eq(maps.id, item.id));
      }
      return { ok: true };
    }),

  deleteMap: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [ref] = await db
        .select({ count: sql<number>`count(*)` })
        .from(matches)
        .where(eq(matches.mapId, input.id));
      if (Number(ref.count) > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This map is used by one or more matches. Deactivate it instead.",
        });
      }
      await db.delete(maps).where(eq(maps.id, input.id));
      return { ok: true };
    }),

  // ----------------------------------------------------------- achievements
  listAchievements: adminQuery.query(async () => {
    const db = getDb();
    const list = await db.select().from(achievements).orderBy(asc(achievements.category), asc(achievements.name));
    const keys = list.map((a) => a.iconKey).filter(Boolean) as string[];
    const urls = keys.length ? await signKeys(keys) : {};
    return list.map((a) => ({ ...a, iconUrl: a.iconKey ? (urls[a.iconKey] ?? null) : null }));
  }),

  upsertAchievement: adminQuery
    .input(
      z.object({
        id: z.number().optional(),
        name: z.string().min(1).max(255),
        description: z.string().nullish(),
        iconKey: z.string().max(512).nullish(),
        badge: z.string().max(128).nullish(),
        tag: z.string().max(64).nullish(),
        category: z.string().max(128).nullish(),
        requirementType: z.enum(["xp_milestone", "login_streak", "quiz_completion", "task_completion", "manual"]).default("manual"),
        requirementValue: z.number().int().min(0).nullish(),
        xpReward: z.number().int().min(0).default(0),
        isActive: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      if (id) {
        const existing = await db.query.achievements.findFirst({
          where: eq(achievements.id, id),
        });
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Achievement not found." });
        await db.update(achievements).set(data).where(eq(achievements.id, id));
        return { id };
      }
      const [{ id: newId }] = await db.insert(achievements).values(data).$returningId();
      return { id: newId };
    }),

  createAchievement: adminQuery
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().nullish(),
        iconKey: z.string().max(512).nullish(),
        badge: z.string().max(128).nullish(),
        tag: z.string().max(64).nullish(),
        category: z.string().max(128).nullish(),
        requirementType: z.enum(["xp_milestone", "login_streak", "quiz_completion", "task_completion", "manual"]).default("manual"),
        requirementValue: z.number().int().min(0).nullish(),
        xpReward: z.number().int().min(0).default(0),
        isActive: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [{ id: newId }] = await db.insert(achievements).values(input).$returningId();
      return { id: newId };
    }),

  updateAchievement: adminQuery
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().nullish(),
        iconKey: z.string().max(512).nullish(),
        badge: z.string().max(128).nullish(),
        tag: z.string().max(64).nullish(),
        category: z.string().max(128).nullish(),
        requirementType: z.enum(["xp_milestone", "login_streak", "quiz_completion", "task_completion", "manual"]).optional(),
        requirementValue: z.number().int().min(0).nullish(),
        xpReward: z.number().int().min(0).optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      const existing = await db.query.achievements.findFirst({
        where: eq(achievements.id, id),
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Achievement not found." });
      await db.update(achievements).set(data).where(eq(achievements.id, id));
      return { id };
    }),

  deleteAchievement: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const existing = await db.query.achievements.findFirst({
        where: eq(achievements.id, input.id),
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Achievement not found." });
      await db.delete(achievements).where(eq(achievements.id, input.id));
      return { ok: true };
    }),

  awardPlayerAchievement: adminQuery
    .input(
      z.object({
        playerId: z.number(),
        title: z.string().min(1).max(255),
        achievementId: z.number().optional().nullable(),
        earnedAt: z.date(),
        tournamentId: z.number().optional().nullable(),
        matchId: z.number().optional().nullable(),
        metadata: z.string().nullish(),
        tournamentName: z.string().nullish(),
        achievementType: z.string().nullish(),
        position: z.string().nullish(),
        liquipediaUrl: z.string().url().nullish(),
        photoKey: z.string().max(512).nullish(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const player = await db.query.players.findFirst({
        where: eq(players.id, input.playerId),
      });
      if (!player) throw new TRPCError({ code: "NOT_FOUND", message: "Player not found." });

      // If achievementId provided, validate it exists and is active (for User Achievements)
      if (input.achievementId) {
        const achievement = await db.query.achievements.findFirst({
          where: eq(achievements.id, input.achievementId),
        });
        if (!achievement) throw new TRPCError({ code: "NOT_FOUND", message: "Achievement not found." });
        if (!achievement.isActive)
          throw new TRPCError({ code: "BAD_REQUEST", message: "Achievement is inactive." });
      }

      const existing = await db.query.playerAchievements.findFirst({
        where: and(
          eq(playerAchievements.playerId, input.playerId),
          input.achievementId != null
            ? eq(playerAchievements.achievementId, input.achievementId)
            : eq(playerAchievements.customTitle, input.title),
          input.tournamentId != null
            ? eq(playerAchievements.tournamentId, input.tournamentId)
            : isNull(playerAchievements.tournamentId),
          input.matchId != null
            ? eq(playerAchievements.matchId, input.matchId)
            : isNull(playerAchievements.matchId),
        ),
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This player already has this achievement for the given context.",
        });
      }

      const meta: Record<string, unknown> = {};
      if (input.tournamentName) meta.tournamentName = input.tournamentName;
      if (input.achievementType) meta.achievementType = input.achievementType;
      if (input.position) meta.position = input.position;
      if (input.liquipediaUrl) meta.liquipediaUrl = input.liquipediaUrl;
      if (input.photoKey) meta.photoKey = input.photoKey;
      if (input.metadata) {
        try {
          const parsed = JSON.parse(input.metadata);
          Object.assign(meta, parsed);
        } catch {
          meta.raw = input.metadata;
        }
      }

      const [{ id: newId }] = await db
        .insert(playerAchievements)
        .values({
          playerId: input.playerId,
          achievementId: input.achievementId ?? null,
          customTitle: input.achievementId ? null : input.title,
          earnedAt: input.earnedAt,
          tournamentId: input.tournamentId ?? null,
          matchId: input.matchId ?? null,
          metadata: Object.keys(meta).length > 0 ? JSON.stringify(meta) : null,
        })
        .$returningId();
      return { id: newId };
    }),

  removePlayerAchievement: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(playerAchievements).where(eq(playerAchievements.id, input.id));
      return { ok: true };
    }),

  awardTeamAchievement: adminQuery
    .input(
      z.object({
        teamId: z.number(),
        title: z.string().min(1).max(255),
        achievementId: z.number().optional().nullable(),
        earnedAt: z.date(),
        tournamentId: z.number().optional().nullable(),
        metadata: z.string().nullish(),
        placement: z.number().int().positive().nullish(),
        tournamentName: z.string().nullish(),
        achievementType: z.string().nullish(),
        position: z.string().nullish(),
        liquipediaUrl: z.string().url().nullish(),
        photoKey: z.string().max(512).nullish(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const team = await db.query.teams.findFirst({
        where: eq(teams.id, input.teamId),
      });
      if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found." });

      // If achievementId provided, validate it exists and is active (for User Achievements)
      if (input.achievementId) {
        const achievement = await db.query.achievements.findFirst({
          where: eq(achievements.id, input.achievementId),
        });
        if (!achievement) throw new TRPCError({ code: "NOT_FOUND", message: "Achievement not found." });
        if (!achievement.isActive)
          throw new TRPCError({ code: "BAD_REQUEST", message: "Achievement is inactive." });
      }

      const existing = await db.query.teamAchievements.findFirst({
        where: and(
          eq(teamAchievements.teamId, input.teamId),
          input.achievementId != null
            ? eq(teamAchievements.achievementId, input.achievementId)
            : eq(teamAchievements.customTitle, input.title),
          input.tournamentId != null
            ? eq(teamAchievements.tournamentId, input.tournamentId)
            : isNull(teamAchievements.tournamentId),
        ),
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This team already has this achievement for the given context.",
        });
      }

      const meta: Record<string, unknown> = {};
      if (input.tournamentName) meta.tournamentName = input.tournamentName;
      if (input.achievementType) meta.achievementType = input.achievementType;
      if (input.position) meta.position = input.position;
      if (input.liquipediaUrl) meta.liquipediaUrl = input.liquipediaUrl;
      if (input.photoKey) meta.photoKey = input.photoKey;
      if (input.metadata) {
        try {
          const parsed = JSON.parse(input.metadata);
          Object.assign(meta, parsed);
        } catch {
          meta.raw = input.metadata;
        }
      }

      const [{ id: newId }] = await db
        .insert(teamAchievements)
        .values({
          teamId: input.teamId,
          achievementId: input.achievementId ?? null,
          customTitle: input.achievementId ? null : input.title,
          earnedAt: input.earnedAt,
          tournamentId: input.tournamentId ?? null,
          metadata: Object.keys(meta).length > 0 ? JSON.stringify(meta) : null,
          placement: input.placement ?? null,
        })
        .$returningId();
      return { id: newId };
    }),

  removeTeamAchievement: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(teamAchievements).where(eq(teamAchievements.id, input.id));
      return { ok: true };
    }),

  listPlayerAchievements: adminQuery.query(async () => {
    const db = getDb();
    const rows = await db
      .select({
        id: playerAchievements.id,
        playerId: playerAchievements.playerId,
        playerIgn: players.ign,
        achievementId: playerAchievements.achievementId,
        customTitle: playerAchievements.customTitle,
        achievementName: achievements.name,
        earnedAt: playerAchievements.earnedAt,
        tournamentId: playerAchievements.tournamentId,
        metadata: playerAchievements.metadata,
      })
      .from(playerAchievements)
      .innerJoin(players, eq(playerAchievements.playerId, players.id))
      .leftJoin(achievements, eq(playerAchievements.achievementId, achievements.id))
      .orderBy(desc(playerAchievements.earnedAt));
    return rows.map((r) => {
      let parsed: Record<string, unknown> | null = null;
      if (r.metadata) {
        try { parsed = JSON.parse(r.metadata); } catch { parsed = null; }
      }
      return { ...r, parsedMetadata: parsed };
    });
  }),

  listTeamAchievements: adminQuery.query(async () => {
    const db = getDb();
    const rows = await db
      .select({
        id: teamAchievements.id,
        teamId: teamAchievements.teamId,
        teamName: teams.name,
        achievementId: teamAchievements.achievementId,
        customTitle: teamAchievements.customTitle,
        achievementName: achievements.name,
        earnedAt: teamAchievements.earnedAt,
        tournamentId: teamAchievements.tournamentId,
        placement: teamAchievements.placement,
        metadata: teamAchievements.metadata,
      })
      .from(teamAchievements)
      .innerJoin(teams, eq(teamAchievements.teamId, teams.id))
      .leftJoin(achievements, eq(teamAchievements.achievementId, achievements.id))
      .orderBy(desc(teamAchievements.earnedAt));
    return rows.map((r) => {
      let parsed: Record<string, unknown> | null = null;
      if (r.metadata) {
        try { parsed = JSON.parse(r.metadata); } catch { parsed = null; }
      }
      return { ...r, parsedMetadata: parsed };
    });
  }),

  // --------------------------------------------------------------- matches
  upsertMatch: adminQuery
    .input(
      z.object({
        id: z.number().optional(),
        tournamentId: z.number(),
        matchNumber: z.number().int().min(1),
        mapId: z.number().int().positive().nullish(),
        specialMoment: z.string().max(255).nullish(),
        placementPoints: z.number().int().min(0).default(0),
        finishPoints: z.number().int().min(0).default(0),
        totalPoints: z.number().int().min(0).default(0),
        officialTotalPoints: z.number().int().min(0).nullish(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...raw } = input;
      let data;
      if (raw.mapId) {
        const map = await db.query.maps.findFirst({ where: eq(maps.id, raw.mapId) });
        if (!map) throw new TRPCError({ code: "NOT_FOUND", message: "Map not found." });
        if (!map.isActive)
          throw new TRPCError({ code: "BAD_REQUEST", message: "This map is deactivated." });
        data = { ...raw, mapName: map.name };
      } else {
        data = { ...raw, mapName: null };
      }
      if (id) {
        await db.update(matches).set(data).where(eq(matches.id, id));
        return { id };
      }
      const [{ id: newId }] = await db.insert(matches).values(data).$returningId();
      return { id: newId };
    }),

  deleteMatch: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(matchPlayers).where(eq(matchPlayers.matchId, input.id));
      await db.delete(matches).where(eq(matches.id, input.id));
      return { ok: true };
    }),

  /**
   * Set the full lineup for a match in one call.
   * - lineupStatus: played / bench / dnp
   * - Max 4 PLAYED players enforced server-side
   * - Match-level scoring is managed separately via upsertMatch
   */
  setMatchLineup: adminQuery
    .input(
      z.object({
        matchId: z.number(),
        lineup: z.array(
          z.object({
            playerId: z.number(),
            lineupStatus: z.enum(["played", "bench", "dnp"]).default("played"),
            kills: z.number().int().min(0).default(0),
            specialMoment: z.string().max(255).nullish(),
          }),
        ),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const playedCount = input.lineup.filter((p) => p.lineupStatus === "played").length;
      if (playedCount > 4) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Maximum 4 PLAYED players allowed per match. You selected ${playedCount}.`,
        });
      }
      await db.delete(matchPlayers).where(eq(matchPlayers.matchId, input.matchId));
      if (input.lineup.length > 0) {
        await db.insert(matchPlayers).values(
          input.lineup.map((p) => ({
            matchId: input.matchId,
            playerId: p.playerId,
            lineupStatus: p.lineupStatus,
            kills: p.kills,
            placement: null,
            placementPoints: 0,
            finishPoints: 0,
            totalPoints: 0,
            officialTotalPoints: null,
            specialMoment: p.specialMoment ?? null,
          })),
        );
      }
      return { ok: true };
    }),

  // -------------------------------------------------------------- comments
  // Moderation is available to moderators and admins (moderatorQuery);
  // everything else in this router remains admin-only.
  listComments: moderatorQuery.query(async () => {
    const db = getDb();
    const list = await db
      .select({
        id: comments.id,
        content: comments.content,
        pinned: comments.pinned,
        hidden: comments.hidden,
        createdAt: comments.createdAt,
        userName: users.name,
        userId: users.id,
        tournamentName: tournaments.name,
        tournamentId: tournaments.id,
      })
      .from(comments)
      .innerJoin(users, eq(comments.userId, users.id))
      .innerJoin(tournaments, eq(comments.tournamentId, tournaments.id))
      .orderBy(desc(comments.createdAt))
      .limit(200);
    return list;
  }),

  moderateComment: moderatorQuery
    .input(
      z.object({
        id: z.number(),
        action: z.enum(["pin", "unpin", "hide", "unhide", "delete"]),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      if (input.action === "delete") {
        await db.delete(commentReactions).where(eq(commentReactions.commentId, input.id));
        await db.delete(comments).where(eq(comments.id, input.id));
      } else if (input.action === "pin") {
        await db.update(comments).set({ pinned: true }).where(eq(comments.id, input.id));
      } else if (input.action === "unpin") {
        await db.update(comments).set({ pinned: false }).where(eq(comments.id, input.id));
      } else if (input.action === "hide") {
        await db.update(comments).set({ hidden: true }).where(eq(comments.id, input.id));
      } else {
        await db.update(comments).set({ hidden: false }).where(eq(comments.id, input.id));
      }
      return { ok: true };
    }),

  // ----------------------------------------------------------------- users
  listUsers: adminQuery
    .input(
      z.object({ q: z.string().max(120).optional() }).optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const q = input?.q?.trim();
      const where = q
        ? or(
            like(users.name, `%${q}%`),
            like(users.email, `%${q}%`),
            like(users.username, `%${q}%`),
          )
        : undefined;
      const list = await db
        .select()
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(200);

      const avatarKeys = [...new Set(list.map((u) => u.avatar).filter(Boolean) as string[])];
      const urls = avatarKeys.length ? await signKeys(avatarKeys) : {};

      // Pre-fetch role permissions for custom roles
      const uniqueCustomRoles = [...new Set(list.map((u) => u.role).filter((r) => !allRoles.includes(r as any)))];
      const roleDefs = uniqueCustomRoles.length > 0
        ? await db
            .select({ slug: roles.slug, name: roles.name })
            .from(roles)
            .where(inArray(roles.slug, uniqueCustomRoles as string[]))
        : [];

      // Fetch permissions separately
      const rolePermEntries: { roleSlug: string; permission: string }[] = [];
      if (roleDefs.length > 0) {
        const slugs = roleDefs.map((r) => r.slug);
        const entries = await db
          .select({ roleSlug: roles.slug, permission: rolePermissions.permission })
          .from(roles)
          .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
          .where(inArray(roles.slug, slugs));
        rolePermEntries.push(...entries);
      }

      const rolePermMap = new Map<string, { name: string; permissions: string[] }>();
      for (const r of roleDefs) {
        rolePermMap.set(r.slug, { name: r.name, permissions: [] });
      }
      for (const e of rolePermEntries) {
        rolePermMap.get(e.roleSlug)!.permissions.push(e.permission);
      }

      return list.map((u) => ({
        ...u,
        avatarUrl: u.avatar ? (urls[u.avatar] ?? null) : null,
        roleInfo: allRoles.includes(u.role as any)
          ? null // built-in role, no extra info needed
          : (rolePermMap.get(u.role) ?? { name: u.role, permissions: [] }),
      }));
    }),

  setUserBanned: adminQuery
    .input(z.object({ id: z.number(), banned: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      // Admins cannot ban themselves.
      if (input.id === ctx.user.id && input.banned) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You cannot ban your own account.",
        });
      }
      await getDb().update(users).set({ banned: input.banned }).where(eq(users.id, input.id));
      return { ok: true };
    }),

  /**
   * Get the users currently assigned to a specific role slug.
   */
  roleUsers: adminQuery
    .input(z.object({ roleSlug: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = getDb();
      const list = await db
        .select({
          id: users.id,
          name: users.name,
          username: users.username,
          email: users.email,
          avatar: users.avatar,
          banned: users.banned,
          lastSignInAt: users.lastSignInAt,
        })
        .from(users)
        .where(eq(users.role, input.roleSlug))
        .orderBy(desc(users.createdAt))
        .limit(100);

      const avatarKeys = [...new Set(list.map((u) => u.avatar).filter(Boolean))] as string[];
      const urls = avatarKeys.length ? await signKeys(avatarKeys) : {};

      return list.map((u) => ({
        ...u,
        avatarUrl: u.avatar ? (urls[u.avatar] ?? null) : null,
      }));
    }),

  /**
    * Assign a role to a user.
    * Server-side guard rails: an admin cannot change their own role, and the
    * last remaining admin can never be demoted. Both built-in and custom
   * role slugs are accepted.
   */
  setUserRole: adminQuery
    .input(z.object({ id: z.number(), role: z.string().min(1).max(128) }))
    .mutation(async ({ input, ctx }) => {
      if (input.id === ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You cannot change your own role.",
        });
      }
      const db = getDb();
      const target = await db.query.users.findFirst({ where: eq(users.id, input.id) });
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      }

      // Validate the role exists (either built-in or custom)
      const isBuiltIn = (allRoles as readonly string[]).includes(input.role);
      let isActive = true;
      if (!isBuiltIn) {
        const roleDef = await db.query.roles.findFirst({ where: eq(roles.slug, input.role) });
        if (!roleDef) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Role '${input.role}' does not exist.` });
        }
        if (!roleDef.isActive) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot assign an inactive role." });
        }
        isActive = true;
      }

      // Check for admin downgrade
      if (target.role === "admin" && input.role !== "admin") {
        const [remaining] = await db
          .select({ count: sql<number>`count(*)` })
          .from(users)
          .where(eq(users.role, "admin"));
        if (Number(remaining.count) <= 1) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "The last administrator cannot be demoted.",
          });
        }
      }
      void isActive;
      await db.update(users).set({ role: input.role }).where(eq(users.id, input.id));
      return { ok: true };
    }),

  updateUserInstagram: adminQuery
    .input(z.object({ id: z.number(), instagram: z.string().max(512).nullable() }))
    .mutation(async ({ input }) => {
      await getDb().update(users).set({ instagram: input.instagram }).where(eq(users.id, input.id));
      return { ok: true };
    }),

  /**
   * List all roles (built-in and custom) with their active state, description,
   * and the count of users assigned to each.
   */
  listRoles: adminQuery
    .input(
      z.object({ includeInactive: z.boolean().default(false) }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const where = input?.includeInactive
        ? undefined
        : eq(roles.isActive, true);

      const roleList = await db
        .select()
        .from(roles)
        .where(where)
        .orderBy(asc(roles.isBuiltIn), desc(roles.isBuiltIn), asc(roles.name));

      const userCounts = await db
        .select({ role: users.role, count: sql<number>`count(*)` })
        .from(users)
        .where(
          inArray(
            users.role,
            roleList.map((r) => r.slug),
          ),
        )
        .groupBy(users.role);

      const countMap = new Map(userCounts.map((c) => [c.role, Number(c.count)]));

      // Get permissions for each role
      const roleIds = roleList.map((r) => r.id);
      const perms = await db
        .select({ roleId: rolePermissions.roleId, permission: rolePermissions.permission })
        .from(rolePermissions)
        .where(inArray(rolePermissions.roleId, roleIds));

      const permMap = new Map<number, string[]>();
      for (const p of perms) {
        if (!permMap.has(p.roleId)) permMap.set(p.roleId, []);
        permMap.get(p.roleId)!.push(p.permission);
      }

      return roleList.map((r) => ({
        ...r,
        userCount: countMap.get(r.slug) ?? 0,
        permissions: permMap.get(r.id) ?? [],
      }));
    }),

  /**
   * Create a new custom role or update an existing one.
   * Cannot modify built-in roles or create roles with admin-only permissions.
   */
  upsertRole: adminQuery
    .input(
      z.object({
        id: z.number().optional(),
        name: z.string().min(1).max(128),
        slug: z.string().min(1).max(128),
        description: z.string().nullish(),
        isActive: z.boolean().default(true),
        permissions: z.array(z.string()).default([]),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // Validate slug doesn't clash with built-in roles
      const builtInSlugs = new Set(allRoles as readonly string[]);
      if (builtInSlugs.has(input.slug) && !input.id) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `The slug '${input.slug}' is reserved for a built-in role.`,
        });
      }

      // Validate permissions: must not include admin-only permissions
      const invalidPerms = input.permissions.filter((p) =>
        (ADMIN_ONLY_PERMISSIONS as readonly string[]).includes(p),
      );
      if (invalidPerms.length > 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `The following permissions are admin-only and cannot be assigned to custom roles: ${invalidPerms.join(", ")}`,
        });
      }

      // Validate all permissions are recognized
      const allPerms = new Set(Object.values(PERMISSIONS));
      const unknownPerms = input.permissions.filter((p) => !allPerms.has(p as any));
      if (unknownPerms.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Unknown permissions: ${unknownPerms.join(", ")}`,
        });
      }

      if (input.id) {
        // Update existing role
        const existing = await db.query.roles.findFirst({
          where: eq(roles.id, input.id),
        });
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Role not found." });
        }
        if (existing.isBuiltIn) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Built-in roles cannot be modified.",
          });
        }

        const { permissions, ...roleData } = input;
        await db.update(roles).set(roleData).where(eq(roles.id, input.id));

        // Update permissions
        await db.delete(rolePermissions).where(eq(rolePermissions.roleId, input.id));
        if (permissions.length > 0) {
          await db.insert(rolePermissions).values(
            permissions.map((p) => ({ roleId: input.id!, permission: p })),
          );
        }

        return { id: input.id };
      }

      // Create new custom role
      // Check for duplicate slug
      const existing = await db.query.roles.findFirst({
        where: eq(roles.slug, input.slug),
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `A role with slug '${input.slug}' already exists.`,
        });
      }

      const { permissions, ...roleData } = input;
      const [{ id: newId }] = await db.insert(roles)
        .values({ ...roleData, isBuiltIn: false })
        .$returningId();

      if (permissions.length > 0) {
        await db.insert(rolePermissions).values(
          permissions.map((p) => ({ roleId: newId, permission: p })),
        );
      }

      return { id: newId };
    }),

  /**
   * Toggle the active state of a custom role.
   * Built-in roles cannot be deactivated.
   */
  toggleRoleActive: adminQuery
    .input(z.object({ id: z.number(), isActive: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const existing = await db.query.roles.findFirst({
        where: eq(roles.id, input.id),
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Role not found." });
      }
      if (existing.isBuiltIn) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Built-in roles cannot be deactivated.",
        });
      }
      if (existing.slug === ctx.user.role) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You cannot deactivate the role you are currently using.",
        });
      }

      await db
        .update(roles)
        .set({ isActive: input.isActive })
        .where(eq(roles.id, input.id));

      return { ok: true };
    }),

  /**
   * Delete a custom role. Users with this role will have it cleared.
   * Built-in roles cannot be deleted.
   */
  deleteRole: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const existing = await db.query.roles.findFirst({
        where: eq(roles.id, input.id),
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Role not found." });
      }
      if (existing.isBuiltIn) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Built-in roles cannot be deleted.",
        });
      }
      if (existing.slug === ctx.user.role) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot delete the role you are currently using.",
        });
      }

      // Clear the role from all users who have it
      await db
        .update(users)
        .set({ role: "fan" })
        .where(eq(users.role, existing.slug));

      // Delete the role's permissions
      await db.delete(rolePermissions).where(eq(rolePermissions.roleId, input.id));

      // Delete the role
      await db.delete(roles).where(eq(roles.id, input.id));

      return { ok: true };
    }),

  /**
   * Assign a role to a user.
   * The admin-only permission set is checked server-side — custom roles
   * with admin-only permissions are rejected at creation time, but we
   * also enforce here that non-admin users cannot be assigned admin-only
   * roles.
   */
  assignUserRole: adminQuery
    .input(z.object({ userId: z.number(), roleSlug: z.string().min(1).max(128) }))
    .mutation(async ({ input, ctx }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You cannot change your own role.",
        });
      }

      const db = getDb();
      const target = await db.query.users.findFirst({
        where: eq(users.id, input.userId),
      });
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      }

      // Check if this is an admin role (built-in admin or custom role that has admin-only permissions)
      const roleDef = await db.query.roles.findFirst({
        where: eq(roles.slug, input.roleSlug),
      });

      // Check for built-in role assignment
      if (input.roleSlug === "admin" && target.role === "admin") {
        // Check if they would be the last admin
        const [remaining] = await db
          .select({ count: sql<number>`count(*)` })
          .from(users)
          .where(eq(users.role, "admin"));
        if (Number(remaining.count) <= 1) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "The last administrator cannot be changed.",
          });
        }
      }

      // If it's a custom role with admin-only permissions, only an admin can assign it
      if (roleDef && !roleDef.isBuiltIn) {
        if (roleDef.isActive === false) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot assign an inactive role.",
          });
        }
      } else if (!roleDef && !allRoles.includes(input.roleSlug as any)) {
        // Role doesn't exist in DB or as a built-in
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Role '${input.roleSlug}' does not exist.`,
        });
      }

      await db
        .update(users)
        .set({ role: input.roleSlug })
        .where(eq(users.id, input.userId));

      return { ok: true };
    }),

  /**
   * Get the list of all available roles (built-in + custom active) for
   * the assignment dropdown in User Management.
   */
  availableRoles: adminQuery.query(async () => {
    const db = getDb();
    const list = await db
      .select()
      .from(roles)
      .where(eq(roles.isActive, true))
      .orderBy(asc(roles.isBuiltIn), desc(roles.isBuiltIn), asc(roles.name));

     return list;
    }),

  /**
   * Get the effective permissions for a specific user.
   */
  getUserPermissions: adminQuery
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const user = await db.query.users.findFirst({
        where: eq(users.id, input.userId),
        columns: { role: true },
      });
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      }

      // Built-in roles use BUILTIN_ROLE_PERMISSIONS
      const isBuiltIn = (allRoles as readonly string[]).includes(user.role);
      if (isBuiltIn) {
      const { BUILTIN_ROLE_PERMISSIONS } = await import("@contracts/constants");
      return (BUILTIN_ROLE_PERMISSIONS as Record<string, readonly string[]>)[user.role] ?? [];
      }

      // Custom role: fetch from role_permissions
      const perms = await db
        .select({ permission: rolePermissions.permission })
        .from(rolePermissions)
        .innerJoin(roles, eq(roles.id, rolePermissions.roleId))
        .where(eq(roles.slug, user.role));

      return perms.map((p) => p.permission);
    }),
  deleteUser: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      // Admins cannot delete themselves
      if (input.id === ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You cannot delete your own account.",
        });
      }

      const db = getDb();
      const target = await db.query.users.findFirst({ where: eq(users.id, input.id) });
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      }

      // Cannot delete the last remaining admin
      if (target.role === "admin") {
        const [remaining] = await db
          .select({ count: sql<number>`count(*)` })
          .from(users)
          .where(eq(users.role, "admin"));
        if (Number(remaining.count) <= 1) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "The last administrator cannot be deleted.",
          });
        }
      }

      // Delete related data first (cascade cleanup)
      // Delete user's card collection
      await db.delete(userCards).where(eq(userCards.userId, input.id));
      // Delete user's achievements
      await db.delete(userAchievements).where(eq(userAchievements.userId, input.id));
      // Delete user's streak
      await db.delete(userStreaks).where(eq(userStreaks.userId, input.id));
      // Delete user's XP history
      await db.delete(xpHistory).where(eq(xpHistory.userId, input.id));
      // Delete user's task completions
      await db.delete(userTaskCompletions).where(eq(userTaskCompletions.userId, input.id));
      // Delete user's quiz attempts
      await db.delete(quizAttempts).where(eq(quizAttempts.userId, input.id));
      // Delete user's prediction votes
      await db.delete(predictionVotes).where(eq(predictionVotes.userId, input.id));
      // Delete user's comments and reactions
      const userComments = await db
        .select({ id: comments.id })
        .from(comments)
        .where(eq(comments.userId, input.id));
      const commentIds = userComments.map((c) => c.id);
      if (commentIds.length > 0) {
        await db.delete(commentReactions).where(inArray(commentReactions.commentId, commentIds));
        await db.delete(comments).where(eq(comments.userId, input.id));
      }
      // Delete refresh tokens
      await db.delete(refreshTokens).where(eq(refreshTokens.userId, input.id));
      // Delete password resets
      await db.delete(passwordResets).where(eq(passwordResets.email, target.email ?? ""));
      // Delete media uploads by user
      // (media table doesn't have uploadedById, skipping)

      // Finally delete the user
      await db.delete(users).where(eq(users.id, input.id));

      return { ok: true };
    }),

  // --------------------------------------------------------------- xp / fan xp
  getXpSettings: adminQuery.query(async () => {
    const settings = await getOrgSettings();
    const enabledRoles = getXpEnabledRoles(settings);
    return { enabledRoles };
  }),

   updateXpEnabledRoles: adminQuery
     .input(z.object({ enabledRoles: z.array(z.string()) }))
     .mutation(async ({ input }) => {
       const settings = await getOrgSettings();
       if (!settings) {
         throw new TRPCError({ code: "NOT_FOUND", message: "Organization settings not found." });
       }
       const updated = setXpEnabledRoles(settings, input.enabledRoles);
       await getDb()
         .update(orgSettings)
         .set({ xpEnabledRoles: updated.xpEnabledRoles })
         .where(eq(orgSettings.id, settings.id));
       return { enabledRoles: input.enabledRoles };
     }),

   // ----------------------------------------------- Live Section Role Access
   getLiveSectionEnabledRoles: adminQuery.query(async () => {
     const settings = await getOrgSettings();
     return { enabledRoles: getLiveSectionEnabledRoles(settings) };
   }),

   updateLiveSectionEnabledRoles: adminQuery
     .input(z.object({ enabledRoles: z.array(z.string()) }))
     .mutation(async ({ input }) => {
       const settings = await getOrgSettings();
       if (!settings) {
         throw new TRPCError({ code: "NOT_FOUND", message: "Organization settings not found." });
       }
       const updated = setLiveSectionEnabledRoles(settings, input.enabledRoles);
       await getDb()
         .update(orgSettings)
         .set({ liveSectionEnabledRoles: updated.liveSectionEnabledRoles })
         .where(eq(orgSettings.id, settings.id));
       return { enabledRoles: input.enabledRoles };
     }),

  listXpHistory: adminQuery
    .input(z.object({ userId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const where = input?.userId ? eq(xpHistory.userId, input.userId) : undefined;
      const list = await db
        .select()
        .from(xpHistory)
        .where(where)
        .orderBy(desc(xpHistory.createdAt))
        .limit(200);
      return list;
    }),

  adjustUserXp: adminQuery
    .input(
      z.object({
        userId: z.number(),
        amount: z.number().int(), // positive or negative
        reason: z.string().max(255).nullish(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const target = await db.query.users.findFirst({ where: eq(users.id, input.userId) });
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });

      const settings = await getOrgSettings();
      const enabledRoles = getXpEnabledRoles(settings);
      if (!enabledRoles.includes(target.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `XP adjustments are disabled for the ${target.role} role.`,
        });
      }

      const current = target.xp ?? 0;
      const next = Math.max(0, current + input.amount);
      await db.update(users).set({ xp: next }).where(eq(users.id, input.userId));
      await db.insert(xpHistory).values({
        userId: input.userId,
        amount: input.amount,
        reason: input.reason ?? null,
      });
      await checkAndGrantXpMilestoneCards(input.userId);
      return { userId: input.userId, previousXp: current, newXp: next, amount: input.amount };
    }),

  // ----------------------------------------------------------------- media
  listMedia: adminQuery
    .input(
      z
        .object({
          category: z
          .enum([
            "team-logos",
            "player-photos",
            "owner-photos",
            "tournament-logos",
            "point-tables",
            "achievement-images",
            "card-artwork",
            "user-avatars",
            "team-media",
            "other",
          ])
            .optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const list = await db
        .select()
        .from(media)
        .where(input?.category ? eq(media.category, input.category) : undefined)
        .orderBy(desc(media.createdAt));
      const urls = await signKeys(list.map((m) => m.fileKey));
      return list.map((m) => ({ ...m, url: urls[m.fileKey] ?? null }));
    }),

  updateMediaCategory: adminQuery
    .input(
      z.object({
        id: z.number(),
        category: z.enum([
          "team-logos",
          "player-photos",
          "owner-photos",
          "tournament-logos",
          "point-tables",
          "other",
        ]),
      }),
    )
    .mutation(async ({ input }) => {
      await getDb()
        .update(media)
        .set({ category: input.category })
        .where(eq(media.id, input.id));
      return { ok: true };
    }),

  deleteMedia: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const item = await db.query.media.findFirst({ where: eq(media.id, input.id) });
      if (!item) return { ok: true };
      await db.delete(media).where(eq(media.id, input.id));
      try {
        await storage.deleteFile({ fileKey: item.fileKey });
      } catch {
        // object may already be gone; deletion is idempotent
      }
      return { ok: true };
    }),

  // ----------------------------------------------------------------- staff
  listStaff: adminQuery
    .input(z.object({ teamId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const where = input?.teamId ? eq(teamStaff.teamId, input.teamId) : undefined;
      const list = await db
        .select()
        .from(teamStaff)
        .where(where)
        .orderBy(asc(teamStaff.displayOrder));
      const teamList = await db.select().from(teams);
      const urls = await signKeys(list.map((s) => s.photoKey));
      return list.map((s) => ({
        ...s,
        photoUrl: s.photoKey ? (urls[s.photoKey] ?? null) : null,
        team: teamList.find((t) => t.id === s.teamId) ?? null,
      }));
    }),

  upsertStaff: adminQuery
    .input(
      z.object({
        id: z.number().optional(),
        teamId: z.number(),
        name: z.string().min(1).max(255),
        role: z.string().min(1).max(128),
        photoKey: z.string().max(512).nullish(),
        bio: z.string().nullish(),
        joinedDate: z.date().nullish(),
        status: z.enum(["active", "former"]).default("active"),
        instagram: z.string().max(512).nullish(),
        youtube: z.string().max(512).nullish(),
        displayOrder: z.number().int().default(0),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      if (id) {
        await db.update(teamStaff).set(data).where(eq(teamStaff.id, id));
        return { id };
      }
      const [{ id: newId }] = await db
        .insert(teamStaff)
        .values(data)
        .$returningId();
      return { id: newId };
    }),

  deleteStaff: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(teamStaff).where(eq(teamStaff.id, input.id));
      return { ok: true };
    }),

  // --------------------------------------------------------------- team media
  listTeamMedia: adminQuery
    .input(z.object({ teamId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const where = input?.teamId ? eq(teamMedia.teamId, input.teamId) : undefined;
      const list = await db
        .select()
        .from(teamMedia)
        .where(where)
        .orderBy(asc(teamMedia.displayOrder));
      const teamList = await db.select().from(teams);
      const urls = await signKeys(list.map((m) => m.photos));
      return list.map((m) => ({
        ...m,
        photoUrls: m.photos ? JSON.parse(m.photos).map((k: string) => urls[k] ?? `/uploads/${k}`) : [],
        team: teamList.find((t) => t.id === m.teamId) ?? null,
      }));
    }),

  upsertTeamMedia: adminQuery
    .input(
      z.object({
        id: z.number().optional(),
        teamId: z.number(),
        name: z.string().min(1).max(255),
        description: z.string().nullish(),
        date: z.date().nullish(),
        photos: z.string().nullish(),
        link: z.string().max(1024).nullish(),
        isActive: z.enum(["active", "hidden"]).default("active"),
        displayOrder: z.number().int().default(0),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      if (id) {
        await db.update(teamMedia).set(data).where(eq(teamMedia.id, id));
        return { id };
      }
      const [{ id: newId }] = await db
        .insert(teamMedia)
        .values(data)
        .$returningId();
      return { id: newId };
    }),

  deleteTeamMedia: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(teamMedia).where(eq(teamMedia.id, input.id));
      return { ok: true };
    }),

  // --------------------------------------------------------------- xp features: daily streak settings
  getStreakSettings: adminQuery.query(async () => {
    const settings = await getOrgSettings();
    return {
      dailyLoginXp: settings?.dailyLoginXp ?? 10,
      streakBonusXp: settings?.streakBonusXp ?? 5,
      maxStreakDays: settings?.maxStreakDays ?? 7,
      streakEnabled: settings?.streakEnabled ?? true,
    };
  }),

  updateStreakSettings: adminQuery
    .input(
      z.object({
        dailyLoginXp: z.number().int().min(0).max(1000).optional(),
        streakBonusXp: z.number().int().min(0).max(1000).optional(),
        maxStreakDays: z.number().int().min(1).max(365).optional(),
        streakEnabled: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const settings = await getOrgSettings();
      if (!settings) throw new TRPCError({ code: "NOT_FOUND", message: "Organization settings not found." });
      const updateData: Record<string, unknown> = {};
      if (input.dailyLoginXp !== undefined) updateData.dailyLoginXp = input.dailyLoginXp;
      if (input.streakBonusXp !== undefined) updateData.streakBonusXp = input.streakBonusXp;
      if (input.maxStreakDays !== undefined) updateData.maxStreakDays = input.maxStreakDays;
      if (input.streakEnabled !== undefined) updateData.streakEnabled = input.streakEnabled;
      if (Object.keys(updateData).length > 0) {
        await db.update(orgSettings).set(updateData).where(eq(orgSettings.id, settings.id));
      }
      return { ok: true };
    }),

  // --------------------------------------------------------------- xp features: tournament predictions
  listPredictions: adminQuery
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
          timerSeconds: predictions.timerSeconds,
          correctOptionId: predictions.correctOptionId,
          createdAt: predictions.createdAt,
        })
        .from(predictions)
        .leftJoin(tournaments, eq(predictions.tournamentId, tournaments.id))
        .where(where)
        .orderBy(desc(predictions.createdAt));
      // Fetch options for each prediction
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

  getPrediction: adminQuery
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
      const voteCounts = await db
        .select({ optionId: predictionVotes.optionId, count: sql<number>`count(*)` })
        .from(predictionVotes)
        .where(eq(predictionVotes.predictionId, input.id))
        .groupBy(predictionVotes.optionId);
      return { ...prediction, options: options.map((o) => ({ ...o, votes: voteCounts.find((v) => v.optionId === o.id)?.count ?? 0 })) };
    }),

  createPrediction: adminQuery
    .input(
      z.object({
        tournamentId: z.number(),
        question: z.string().min(1).max(1000),
        xpReward: z.number().int().min(0).max(10000).default(0),
        closesAt: z.date(),
        timerSeconds: z.number().int().min(0).max(86400).optional().nullable(),
        options: z.array(z.object({ text: z.string().min(1).max(255) })).min(2).max(10),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const tournament = await db.query.tournaments.findFirst({ where: eq(tournaments.id, input.tournamentId) });
      if (!tournament) throw new TRPCError({ code: "NOT_FOUND", message: "Tournament not found." });
      const [{ id }] = await db
        .insert(predictions)
        .values({
          tournamentId: input.tournamentId,
          question: input.question,
          xpReward: input.xpReward,
          closesAt: input.closesAt,
          timerSeconds: input.timerSeconds ?? null,
          status: "open",
        })
        .$returningId();
      for (let i = 0; i < input.options.length; i++) {
        await db.insert(predictionOptions).values({
          predictionId: id,
          text: input.options[i].text,
          displayOrder: i,
        });
      }
      return { id };
    }),

  updatePrediction: adminQuery
    .input(
      z.object({
        id: z.number(),
        question: z.string().min(1).max(1000).optional(),
        xpReward: z.number().int().min(0).max(10000).optional(),
        closesAt: z.date().optional(),
        timerSeconds: z.number().int().min(0).max(86400).optional().nullable(),
        status: z.enum(["open", "closed", "answered"]).optional(),
        correctOptionId: z.number().optional().nullable(),
        options: z.array(z.object({ id: z.number().optional(), text: z.string().min(1).max(255), displayOrder: z.number().int() })).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, options, correctOptionId, ...data } = input;
      const prediction = await db.query.predictions.findFirst({ where: eq(predictions.id, id) });
      if (!prediction) throw new TRPCError({ code: "NOT_FOUND", message: "Prediction not found." });
      if (Object.keys(data).length > 0) {
        await db.update(predictions).set(data).where(eq(predictions.id, id));
      }
      if (options) {
        const existingOptions = await db.select().from(predictionOptions).where(eq(predictionOptions.predictionId, id));
        const existingIds = new Set(existingOptions.map((o) => o.id));
        const inputIds = new Set(options.filter((o) => o.id).map((o) => o.id!));
        for (const existingId of existingIds) {
          if (!inputIds.has(existingId)) {
            await db.delete(predictionOptions).where(eq(predictionOptions.id, existingId));
          }
        }
        for (const opt of options) {
          if (opt.id && existingIds.has(opt.id)) {
            await db.update(predictionOptions).set({ text: opt.text, displayOrder: opt.displayOrder }).where(eq(predictionOptions.id, opt.id));
          } else {
            await db.insert(predictionOptions).values({ predictionId: id, text: opt.text, displayOrder: opt.displayOrder });
          }
        }
      }
      if (correctOptionId !== undefined && correctOptionId !== null) {
        await setPredictionCorrectOption(db, id, correctOptionId);
      }
      return { ok: true };
    }),

  deletePrediction: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(predictionVotes).where(eq(predictionVotes.predictionId, input.id));
      await db.delete(predictionOptions).where(eq(predictionOptions.predictionId, input.id));
      await db.delete(predictions).where(eq(predictions.id, input.id));
      return { ok: true };
    }),

  /**
   * Admin declares the correct option for a prediction after the event finishes.
   * Awards XP to voters of the new correct option and revokes XP from voters of
   * the previously-selected (now wrong) option. XP history stays consistent.
   */
  setPredictionCorrectOption: adminQuery
    .input(z.object({ id: z.number(), correctOptionId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const prediction = await db.query.predictions.findFirst({ where: eq(predictions.id, input.id) });
      if (!prediction) throw new TRPCError({ code: "NOT_FOUND", message: "Prediction not found." });
      const option = await db.query.predictionOptions.findFirst({
        where: and(eq(predictionOptions.id, input.correctOptionId), eq(predictionOptions.predictionId, input.id)),
      });
      if (!option) throw new TRPCError({ code: "NOT_FOUND", message: "Option not found for this prediction." });
      await setPredictionCorrectOption(db, input.id, input.correctOptionId, ctx.user.id);
      return { ok: true };
    }),

  // --------------------------------------------------------------- xp features: TSG Quiz
  listQuizQuestions: adminQuery.query(async () => {
    const db = getDb();
    const questions = await db
      .select()
      .from(quizQuestions)
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
    const keys = questions.map((q) => q.imageKey).filter(Boolean) as string[];
    const urls = keys.length ? await signKeys(keys) : {};
    return questions.map((q) => ({ ...q, imageUrl: q.imageKey ? (urls[q.imageKey] ?? null) : null, options: optionsMap[q.id] ?? [] }));
  }),

  createQuizQuestion: adminQuery
    .input(
      z.object({
        question: z.string().min(1).max(1000),
        xpReward: z.number().int().min(0).max(10000).default(0),
        cardRewardId: z.number().optional().nullable(),
        timerSeconds: z.number().int().min(5).max(3600).optional().nullable(),
        isActive: z.boolean().default(true),
        imageKey: z.string().max(512).optional().nullable(),
        options: z.array(z.object({ text: z.string().min(1).max(255), isCorrect: z.boolean() })).min(4).max(10),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const correctCount = input.options.filter((o) => o.isCorrect).length;
      if (correctCount !== 1) throw new TRPCError({ code: "BAD_REQUEST", message: "Exactly one option must be marked as correct." });
      const [{ id }] = await db
        .insert(quizQuestions)
        .values({ question: input.question, xpReward: input.xpReward, cardRewardId: input.cardRewardId ?? null, timerSeconds: input.timerSeconds, isActive: input.isActive, imageKey: input.imageKey ?? null })
        .$returningId();
      for (let i = 0; i < input.options.length; i++) {
        await db.insert(quizOptions).values({
          questionId: id,
          text: input.options[i].text,
          isCorrect: input.options[i].isCorrect,
          displayOrder: i,
        });
      }
      return { id };
    }),

  updateQuizQuestion: adminQuery
    .input(
      z.object({
        id: z.number(),
        question: z.string().min(1).max(1000).optional(),
        xpReward: z.number().int().min(0).max(10000).optional(),
        cardRewardId: z.number().optional().nullable(),
        timerSeconds: z.number().int().min(5).max(3600).optional().nullable(),
        isActive: z.boolean().optional(),
        imageKey: z.string().max(512).optional().nullable(),
        options: z.array(z.object({ id: z.number().optional(), text: z.string().min(1).max(255), isCorrect: z.boolean(), displayOrder: z.number().int() })).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, options, ...data } = input;
      if (options) {
        const correctCount = options.filter((o) => o.isCorrect).length;
        if (correctCount !== 1) throw new TRPCError({ code: "BAD_REQUEST", message: "Exactly one option must be marked as correct." });
      }
      if (Object.keys(data).length > 0) {
        await db.update(quizQuestions).set(data).where(eq(quizQuestions.id, id));
      }
      if (options) {
        const existingOptions = await db.select().from(quizOptions).where(eq(quizOptions.questionId, id));
        const existingIds = new Set(existingOptions.map((o) => o.id));
        const inputIds = new Set(options.filter((o) => o.id).map((o) => o.id!));
        for (const existingId of existingIds) {
          if (!inputIds.has(existingId)) {
            await db.delete(quizOptions).where(eq(quizOptions.id, existingId));
          }
        }
        for (const opt of options) {
          if (opt.id && existingIds.has(opt.id)) {
            await db.update(quizOptions).set({ text: opt.text, isCorrect: opt.isCorrect, displayOrder: opt.displayOrder }).where(eq(quizOptions.id, opt.id));
          } else {
            await db.insert(quizOptions).values({ questionId: id, text: opt.text, isCorrect: opt.isCorrect, displayOrder: opt.displayOrder });
          }
        }
      }
      return { ok: true };
    }),

  deleteQuizQuestion: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(quizAttempts).where(eq(quizAttempts.questionId, input.id));
      await db.delete(quizOptions).where(eq(quizOptions.questionId, input.id));
      await db.delete(quizQuestions).where(eq(quizQuestions.id, input.id));
      return { ok: true };
    }),

  // --------------------------------------------------------------- xp features: XP Tasks
  listXpTasks: adminQuery.query(async () => {
    const db = getDb();
    return db.select().from(xpTasks).orderBy(asc(xpTasks.displayOrder), desc(xpTasks.createdAt));
  }),

  createXpTask: adminQuery
    .input(
      z.object({
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        actionUrl: z.string().max(1024).optional().nullable(),
        xpReward: z.number().int().min(0).max(10000).default(0),
        isActive: z.boolean().default(true),
        displayOrder: z.number().int().default(0),
        deadlineAt: z.date().optional().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { deadlineAt, ...rest } = input;
      const [{ id }] = await db.insert(xpTasks).values({ ...rest, deadlineAt: deadlineAt ?? null }).$returningId();
      return { id };
    }),

  updateXpTask: adminQuery
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        actionUrl: z.string().max(1024).optional().nullable(),
        xpReward: z.number().int().min(0).max(10000).optional(),
        isActive: z.boolean().optional(),
        displayOrder: z.number().int().optional(),
        deadlineAt: z.date().optional().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, deadlineAt, ...data } = input;
      const updateData: Record<string, unknown> = { ...data };
      if (deadlineAt !== undefined) updateData.deadlineAt = deadlineAt;
      await db.update(xpTasks).set(updateData).where(eq(xpTasks.id, id));
      return { ok: true };
    }),

  deleteXpTask: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(userTaskCompletions).where(eq(userTaskCompletions.taskId, input.id));
      await db.delete(xpTasks).where(eq(xpTasks.id, input.id));
      return { ok: true };
    }),

  // --------------------------------------------------------------- xp features: Weekly Top Fan
  listWeeklyTopFans: adminQuery.query(async () => {
    const db = getDb();
    return db
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
      .orderBy(desc(weeklyTopFan.weekStart));
  }),

  // Manual trigger for weekly top fan calculation (for testing/admin use)
  calculateWeeklyTopFan: adminQuery.mutation(async () => {
    const db = getDb();
    const settings = await getOrgSettings();
    const enabledRoles = getXpEnabledRoles(settings);
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Sunday
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Check if already calculated for this week
    const existing = await db.query.weeklyTopFan.findFirst({ where: eq(weeklyTopFan.weekStart, weekStart) });
    if (existing) throw new TRPCError({ code: "CONFLICT", message: "Weekly top fan already calculated for this week." });

    // Find top XP user among enabled roles
    const topUser = await db
      .select({ id: users.id, xp: users.xp })
      .from(users)
      .where(and(inArray(users.role, enabledRoles as ("fan" | "player" | "moderator" | "admin")[]), gt(users.xp, 0)))
      .orderBy(desc(users.xp))
      .limit(1);

    if (topUser.length === 0) return { ok: true, message: "No eligible users found." };

    const winner = topUser[0];
    await db.insert(weeklyTopFan).values({
      weekStart,
      weekEnd,
      userId: winner.id,
      userXp: winner.xp,
    });
    return { ok: true, userId: winner.id, userXp: winner.xp };
  }),

  // ----------------------------------------------------------------- cards: CRUD
  listCards: adminQuery.query(async () => {
    const db = getDb();
    const list = await db
      .select()
      .from(cards)
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

  upsertCard: adminQuery
    .input(
      z.object({
        id: z.number().optional(),
        name: z.string().min(1).max(255),
        slug: z.string().min(1).max(255),
        description: z.string().nullish(),
        imageKey: z.string().max(512).nullish(),
        category: z
          .enum(["common", "rare", "epic", "legendary", "event", "exclusive"])
          .default("common"),
        totalSupply: z.number().int().min(1),
        claimedSupply: z.number().int().min(0).optional(),
        unlockMethod: z
          .enum(["daily_streak", "xp_milestone", "achievement", "event", "manual", "exclusive"])
          .default("manual"),
        unlockRequirement: z.string().max(255).nullish(),
        isActive: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      if (id) {
        const existing = await db.query.cards.findFirst({ where: eq(cards.id, id) });
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Card not found." });
        if (data.totalSupply !== undefined && data.totalSupply < existing.claimedSupply) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot reduce totalSupply below already-claimed (${existing.claimedSupply}).`,
          });
        }
        const updateData: Record<string, unknown> = { ...data };
        if (data.slug !== undefined) {
          const dup = await db
            .select({ id: cards.id })
            .from(cards)
            .where(and(eq(cards.slug, data.slug), sql`${cards.id} != ${id}`))
            .limit(1);
          if (dup.length) throw new TRPCError({ code: "CONFLICT", message: "Slug already in use." });
        }
        await db.update(cards).set(updateData).where(eq(cards.id, id));
        return { id };
      }
      const dup = await db
        .select({ id: cards.id })
        .from(cards)
        .where(eq(cards.slug, data.slug))
        .limit(1);
      if (dup.length) throw new TRPCError({ code: "CONFLICT", message: "Slug already in use." });
      const [{ id: newId }] = await db.insert(cards).values(data).$returningId();
      return { id: newId };
    }),

  deleteCard: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const existing = await db.query.cards.findFirst({ where: eq(cards.id, input.id) });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Card not found." });
      await db.delete(cards).where(eq(cards.id, input.id));
      return { ok: true };
    }),

  // ----------------------------------------------------------------- cards: streak milestones
   listStreakCardRewards: adminQuery.query(async () => {
    const db = getDb();
    const list = await db
      .select({
        id: streakCardRewards.id,
        streakDays: streakCardRewards.streakDays,
        isActive: streakCardRewards.isActive,
        cardId: streakCardRewards.cardId,
        cardName: cards.name,
        cardImageKey: cards.imageKey,
        cardCategory: cards.category,
        cardTotalSupply: cards.totalSupply,
        cardClaimedSupply: cards.claimedSupply,
        cardIsActive: cards.isActive,
      })
      .from(streakCardRewards)
      .innerJoin(cards, eq(streakCardRewards.cardId, cards.id))
      .orderBy(asc(streakCardRewards.streakDays));
    const urls = await signKeys([...new Set(list.map((r) => r.cardImageKey).filter(Boolean) as string[])]);
    return list.map((r) => ({
      ...r,
      cardImageUrl: r.cardImageKey ? (urls[r.cardImageKey] ?? null) : null,
    }));
  }),

  upsertStreakCardReward: adminQuery
    .input(
      z.object({
        id: z.number().optional(),
        streakDays: z.number().int().min(1),
        cardId: z.number(),
        isActive: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      if (input.id) {
        const existing = await db.query.streakCardRewards.findFirst({
          where: eq(streakCardRewards.id, input.id),
        });
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Streak reward not found." });

        let data = { streakDays: input.streakDays, isActive: input.isActive, cardId: input.cardId };

        const sameStreak = await db
          .select({ id: streakCardRewards.id })
          .from(streakCardRewards)
          .where(
            and(
              eq(streakCardRewards.streakDays, input.streakDays),
              ne(streakCardRewards.id, input.id),
            ),
          )
          .limit(1);
        if (sameStreak.length) {
          throw new TRPCError({ code: "CONFLICT", message: "Another streak reward with the same day count exists." });
        }

        await db.update(streakCardRewards).set(data).where(eq(streakCardRewards.id, input.id));
        return { id: input.id };
      }

      const existing = await db.query.streakCardRewards.findFirst({
        where: eq(streakCardRewards.streakDays, input.streakDays),
      });
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "A streak reward for this day count already exists." });

      const cardExists = await db.query.cards.findFirst({ where: eq(cards.id, input.cardId) });
      if (!cardExists) throw new TRPCError({ code: "NOT_FOUND", message: "Card not found." });

      const [{ id: newId }] = await db
        .insert(streakCardRewards)
        .values({ streakDays: input.streakDays, cardId: input.cardId, isActive: input.isActive })
        .$returningId();
      return { id: newId };
    }),

  deleteStreakCardReward: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(streakCardRewards).where(eq(streakCardRewards.id, input.id));
      return { ok: true };
    }),

  // ----------------------------------------------------------------- cards: XP milestones
  listXpCardMilestones: adminQuery.query(async () => {
    const db = getDb();
    const list = await db
      .select({
        id: xpCardMilestones.id,
        xpThreshold: xpCardMilestones.xpThreshold,
        isActive: xpCardMilestones.isActive,
        cardId: xpCardMilestones.cardId,
        cardName: cards.name,
        cardImageKey: cards.imageKey,
        cardCategory: cards.category,
        cardTotalSupply: cards.totalSupply,
        cardClaimedSupply: cards.claimedSupply,
        cardIsActive: cards.isActive,
      })
      .from(xpCardMilestones)
      .innerJoin(cards, eq(xpCardMilestones.cardId, cards.id))
      .orderBy(asc(xpCardMilestones.xpThreshold));
    const urls = await signKeys([...new Set(list.map((r) => r.cardImageKey).filter(Boolean) as string[])]);
    return list.map((r) => ({
      ...r,
      cardImageUrl: r.cardImageKey ? (urls[r.cardImageKey] ?? null) : null,
    }));
  }),

  upsertXpCardMilestone: adminQuery
    .input(
      z.object({
        id: z.number().optional(),
        xpThreshold: z.number().int().min(0),
        cardId: z.number(),
        isActive: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      if (input.id) {
        const existing = await db.query.xpCardMilestones.findFirst({
          where: eq(xpCardMilestones.id, input.id),
        });
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "XP milestone not found." });

        const sameThreshold = await db
          .select({ id: xpCardMilestones.id })
          .from(xpCardMilestones)
          .where(
            and(
              eq(xpCardMilestones.xpThreshold, input.xpThreshold),
              ne(xpCardMilestones.id, input.id),
            ),
          )
          .limit(1);
        if (sameThreshold.length) {
          throw new TRPCError({ code: "CONFLICT", message: "Another XP milestone with the same threshold exists." });
        }

        await db
          .update(xpCardMilestones)
          .set({ xpThreshold: input.xpThreshold, isActive: input.isActive, cardId: input.cardId })
          .where(eq(xpCardMilestones.id, input.id));
        return { id: input.id };
      }

      const duplicate = await db.query.xpCardMilestones.findFirst({
        where: eq(xpCardMilestones.xpThreshold, input.xpThreshold),
      });
      if (duplicate) {
        throw new TRPCError({ code: "CONFLICT", message: "An XP milestone with this threshold already exists." });
      }

      const cardExists = await db.query.cards.findFirst({ where: eq(cards.id, input.cardId) });
      if (!cardExists) throw new TRPCError({ code: "NOT_FOUND", message: "Card not found." });

      const [{ id: newId }] = await db
        .insert(xpCardMilestones)
        .values({ xpThreshold: input.xpThreshold, cardId: input.cardId, isActive: input.isActive })
        .$returningId();
      return { id: newId };
    }),

  deleteXpCardMilestone: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(xpCardMilestones).where(eq(xpCardMilestones.id, input.id));
      return { ok: true };
    }),

  // ----------------------------------------------------------------- cards: achievement rewards
  listAchievementCardRewards: adminQuery.query(async () => {
    const db = getDb();
    const list = await db
      .select({
        id: achievementCardRewards.id,
        achievementId: achievementCardRewards.achievementId,
        achievementName: achievements.name,
        cardId: achievementCardRewards.cardId,
        cardName: cards.name,
        cardImageKey: cards.imageKey,
        cardCategory: cards.category,
        cardTotalSupply: cards.totalSupply,
        cardClaimedSupply: cards.claimedSupply,
        cardIsActive: cards.isActive,
      })
      .from(achievementCardRewards)
      .innerJoin(achievements, eq(achievementCardRewards.achievementId, achievements.id))
      .innerJoin(cards, eq(achievementCardRewards.cardId, cards.id))
      .orderBy(asc(achievementCardRewards.id));
    const urls = await signKeys([...new Set(list.map((r) => r.cardImageKey).filter(Boolean) as string[])]);
    return list.map((r) => ({
      ...r,
      cardImageUrl: r.cardImageKey ? (urls[r.cardImageKey] ?? null) : null,
    }));
  }),

  upsertAchievementCardReward: adminQuery
    .input(
      z.object({
        id: z.number().optional(),
        achievementId: z.number(),
        cardId: z.number(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const ach = await db.query.achievements.findFirst({ where: eq(achievements.id, input.achievementId) });
      if (!ach) throw new TRPCError({ code: "NOT_FOUND", message: "Achievement not found." });
      const card = await db.query.cards.findFirst({ where: eq(cards.id, input.cardId) });
      if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Card not found." });
      const { id, ...data } = input;
      if (id) {
        await db.update(achievementCardRewards).set(data).where(eq(achievementCardRewards.id, id));
        return { id };
      }
      const [{ id: newId }] = await db.insert(achievementCardRewards).values(data).$returningId();
      return { id: newId };
    }),

  deleteAchievementCardReward: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(achievementCardRewards).where(eq(achievementCardRewards.id, input.id));
      return { ok: true };
    }),

  // ----------------------------------------------------------------- cards: grant to user
  grantCardToUser: adminQuery
    .input(
      z.object({
        userId: z.number(),
        cardId: z.number(),
        quantity: z.number().int().min(1).default(1),
        note: z.string().nullish(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const result = await grantCard({
        userId: input.userId,
        cardId: input.cardId,
        quantity: input.quantity,
        source: "manual grant",
        note: input.note ?? undefined,
        grantedById: ctx.user?.id,
      });
      if (result.wasSoldOut) {
        throw new TRPCError({ code: "CONFLICT", message: "This card is sold out." });
      }
      return { granted: result.granted, remainingSupply: result.remainingSupply };
    }),

  // ----------------------------------------------------------------- cards: user collection lookup
  getUserCardCollection: adminQuery
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select({
          id: userCards.id,
          cardId: userCards.cardId,
          quantity: userCards.quantity,
          copyNumber: userCards.copyNumber,
          acquiredAt: userCards.acquiredAt,
          source: userCards.source,
          revoked: userCards.revoked,
          card: cards,
        })
        .from(userCards)
        .innerJoin(cards, eq(userCards.cardId, cards.id))
        .where(eq(userCards.userId, input.userId))
        .orderBy(desc(userCards.acquiredAt));
      const urls = await signKeys(rows.map((r) => r.card.imageKey).filter(Boolean) as string[]);
      return rows.map((r) => ({
        ...r,
        cardImageUrl: r.card.imageKey ? (urls[r.card.imageKey] ?? null) : null,
      }));
    }),

  revokeCardFromUser: adminQuery
    .input(
      z.object({
        userId: z.number(),
        userCardId: z.number(),
        reason: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      return db.transaction(async (tx) => {
        const userCard = await tx
          .select({
            id: userCards.id,
            cardId: userCards.cardId,
            quantity: userCards.quantity,
            copyNumber: userCards.copyNumber,
            revoked: userCards.revoked,
          })
          .from(userCards)
          .where(eq(userCards.id, input.userCardId))
          .limit(1);

        if (!userCard.length) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User card not found." });
        }

        const uc = userCard[0];

        const card = await tx.query.cards.findFirst({
          where: eq(cards.id, uc.cardId),
          columns: { id: true, name: true, totalSupply: true, claimedSupply: true },
        });
        if (!card) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Card not found." });
        }

        if (!uc.revoked) {
          await tx
            .update(userCards)
            .set({
              revoked: true,
              revokedAt: new Date(),
              revokedById: ctx.user.id,
              revokeReason: input.reason ?? null,
            })
            .where(eq(userCards.id, input.userCardId));

          await tx
            .update(cards)
            .set({
              claimedSupply: sql`${cards.claimedSupply} - ${uc.quantity ?? 1}`,
              updatedAt: new Date(),
            })
            .where(eq(cards.id, card.id));

          await tx.insert(cardEvents).values({
            userId: input.userId,
            cardId: card.id,
            copyNumber: uc.copyNumber,
            action: "revoke",
            reason: input.reason ?? null,
            performedById: ctx.user.id,
            source: "admin_revoke",
          });
        }

        return { ok: true };
      });
    }),

  listCardEvents: adminQuery
    .input(z.object({ userId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const where = input?.userId ? eq(cardEvents.userId, input.userId) : undefined;
      const rows = await db
        .select({
          id: cardEvents.id,
          userId: cardEvents.userId,
          userName: users.name,
          userUsername: users.username,
          cardId: cardEvents.cardId,
          cardName: cards.name,
          copyNumber: cardEvents.copyNumber,
          action: cardEvents.action,
          reason: cardEvents.reason,
          source: cardEvents.source,
          performedById: cardEvents.performedById,
          performedByName: sql<string | null>`(SELECT name FROM users WHERE users.id = card_events.performedById)`,
          createdAt: cardEvents.createdAt,
        })
        .from(cardEvents)
        .leftJoin(cards, eq(cardEvents.cardId, cards.id))
        .leftJoin(users, eq(cardEvents.userId, users.id))
        .where(where)
        .orderBy(desc(cardEvents.createdAt))
        .limit(500);
      return rows;
    }),

  // ----------------------------------------------------------------- cards: grant history
  listCardGrants: adminQuery
    .input(z.object({ userId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const where = input?.userId ? eq(cardGrants.userId, input.userId) : undefined;
      const rows = await db
        .select({
          id: cardGrants.id,
          userId: cardGrants.userId,
          userName: users.name,
          userUsername: users.username,
          cardId: cardGrants.cardId,
          cardName: cards.name,
          quantity: cardGrants.quantity,
          source: cardGrants.source,
          note: cardGrants.note,
          grantedById: cardGrants.grantedById,
          grantedByName: sql<string | null>`(SELECT name FROM users WHERE users.id = card_grants.grantedById)`,
          createdAt: cardGrants.createdAt,
        })
        .from(cardGrants)
        .innerJoin(cards, eq(cardGrants.cardId, cards.id))
        .leftJoin(users, eq(cardGrants.userId, users.id))
        .where(where)
        .orderBy(desc(cardGrants.createdAt))
        .limit(200);
      return rows;
    }),

  // ------------------------------------------------------------------- analytics
  /**
   * Analytics dashboard data — all sourced from existing tables.
   * `days` controls the lookback window (default 30 days, max 365).
   */
  analytics: adminQuery
    .input(
      z.object({
        days: z.number().int().min(1).max(365).default(30),
      }),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const days = input.days;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      // --- Core counts ---
      const [userCount, activeUserCount, bannedCount, totalXp] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(users),
        db
          .select({ count: sql<number>`count(*)` })
          .from(users)
          .where(gte(users.lastSignInAt, cutoff)),
        db
          .select({ count: sql<number>`count(*)` })
          .from(users)
          .where(eq(users.banned, true)),
        db.select({ total: sql<number>`COALESCE(SUM(xp), 0)` }).from(users),
      ]);

      // New users per day
      const newUsersByDay = await db
        .select({
          date: sql<string>`DATE(createdAt)`,
          count: sql<number>`count(*)`,
        })
        .from(users)
        .where(gte(users.createdAt, cutoff))
        .groupBy(sql`DATE(createdAt)`)
        .orderBy(sql`DATE(createdAt)`);

      // Active users (last sign-in) per day
      const activeByDay = await db
        .select({
          date: sql<string>`DATE(lastSignInAt)`,
          count: sql<number>`count(*)`,
        })
        .from(users)
        .where(gte(users.lastSignInAt, cutoff))
        .groupBy(sql`DATE(lastSignInAt)`)
        .orderBy(sql`DATE(lastSignInAt)`);

      // XP earned per day
      const xpByDay = await db
        .select({
          date: sql<string>`DATE(createdAt)`,
          xp: sql<number>`COALESCE(SUM(amount), 0)`,
          count: sql<number>`count(*)`,
        })
        .from(xpHistory)
        .where(gte(xpHistory.createdAt, cutoff))
        .groupBy(sql`DATE(createdAt)`)
        .orderBy(sql`DATE(createdAt)`);

      // Role distribution
      const roleDistribution = await db
        .select({
          role: users.role,
          count: sql<number>`count(*)`,
        })
        .from(users)
        .groupBy(users.role)
        .orderBy(desc(sql`count`));

      // --- Comments & Community ---
      const [commentCount, commentByDay] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(comments),
        db
          .select({
            date: sql<string>`DATE(createdAt)`,
            count: sql<number>`count(*)`,
          })
          .from(comments)
          .where(gte(comments.createdAt, cutoff))
          .groupBy(sql`DATE(createdAt)`)
          .orderBy(sql`DATE(createdAt)`),
      ]);

      // --- Cards & Collection ---
      const [cardCount, cardGrantStats, popularCards, cardGrantsByDay] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(cards).where(eq(cards.isActive, true)),
        db.select({ count: sql<number>`count(*)`, total: sql<number>`COALESCE(SUM(quantity), 0)` }).from(cardGrants),
        db
          .select({
            cardId: cards.id,
            cardName: cards.name,
            cardCategory: cards.category,
            claimedSupply: cards.claimedSupply,
            totalSupply: cards.totalSupply,
            holders: sql<number>`COALESCE(SUM(CASE WHEN userCards.id IS NOT NULL THEN 1 ELSE 0 END), 0)`,
          })
          .from(cards)
          .leftJoin(userCards, eq(userCards.cardId, cards.id))
          .groupBy(cards.id)
          .orderBy(desc(sql`holders`))
          .limit(20),
        db
          .select({
            date: sql<string>`DATE(createdAt)`,
            grants: sql<number>`count(*)`,
            cards: sql<number>`COALESCE(SUM(quantity), 0)`,
          })
          .from(cardGrants)
          .where(gte(cardGrants.createdAt, cutoff))
          .groupBy(sql`DATE(createdAt)`)
          .orderBy(sql`DATE(createdAt)`),
      ]);

      // --- Achievements ---
      const [achievementCount, userAchievementsByDay] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(achievements).where(eq(achievements.isActive, true)),
        db
          .select({
            date: sql<string>`DATE(earnedAt)`,
            count: sql<number>`count(*)`,
          })
          .from(userAchievements)
          .where(gte(userAchievements.earnedAt, cutoff))
          .groupBy(sql`DATE(earnedAt)`)
          .orderBy(sql`DATE(earnedAt)`),
      ]);

      // --- Quiz ---
      const [quizQuestionCount, quizAttemptStats] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(quizQuestions).where(eq(quizQuestions.isActive, true)),
        db
          .select({
            date: sql<string>`DATE(createdAt)`,
            attempts: sql<number>`count(*)`,
            correct: sql<number>`COALESCE(SUM(CASE WHEN isCorrect THEN 1 ELSE 0 END), 0)`,
          })
          .from(quizAttempts)
          .where(gte(quizAttempts.createdAt, cutoff))
          .groupBy(sql`DATE(createdAt)`)
          .orderBy(sql`DATE(createdAt)`),
      ]);

      // --- Predictions ---
      const [predictionCount, predictionVoteStats] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(predictions),
        db
          .select({
            date: sql<string>`DATE(createdAt)`,
            votes: sql<number>`count(*)`,
          })
          .from(predictionVotes)
          .where(gte(predictionVotes.createdAt, cutoff))
          .groupBy(sql`DATE(createdAt)`)
          .orderBy(sql`DATE(createdAt)`),
      ]);

      // --- Tournaments & Matches ---
      const [tournamentCount, matchCount, tournamentsByStatus, matchesByDay] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(tournaments),
        db.select({ count: sql<number>`count(*)` }).from(matches),
        db
          .select({
            status: tournaments.status,
            count: sql<number>`count(*)`,
          })
          .from(tournaments)
          .groupBy(tournaments.status)
          .orderBy(desc(sql`count`)),
        db
          .select({
            date: sql<string>`DATE(createdAt)`,
            count: sql<number>`count(*)`,
          })
          .from(matches)
          .where(gte(matches.createdAt, cutoff))
          .groupBy(sql`DATE(createdAt)`)
          .orderBy(sql`DATE(createdAt)`),
      ]);

      // --- Weekly Top Fan ---
      const [weeklyTopFanCount] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(weeklyTopFan),
      ]);

      // --- Top XP earners ---
      const topXpEarners = await db
        .select({
          userId: users.id,
          userName: users.name,
          userUsername: users.username,
          userAvatar: users.avatar,
          xp: users.xp,
          xpEvents: sql<number>`count(xp_history.id)`,
        })
        .from(users)
        .leftJoin(xpHistory, eq(xpHistory.userId, users.id))
        .groupBy(users.id)
        .orderBy(desc(users.xp))
        .limit(15);

      const avatarKeys = [...new Set(topXpEarners.map((u) => u.userAvatar).filter(Boolean) as string[])];
      const avatarUrls = avatarKeys.length ? await signKeys(avatarKeys) : {};

      return {
        period: { days, from: cutoff },
        totals: {
          users: Number(userCount[0].count),
          activeUsers: Number(activeUserCount[0].count),
          bannedUsers: Number(bannedCount[0].count),
          totalXp: Number(totalXp[0].total),
          comments: Number(commentCount[0].count),
          activeCards: Number(cardCount[0].count),
          achievementCount: Number(achievementCount[0].count),
          totalCardGrants: Number(cardGrantStats[0].count),
          totalCardsGranted: Number(cardGrantStats[0].total),
          quizQuestions: Number(quizQuestionCount[0].count),
          predictions: Number(predictionCount[0].count),
          tournaments: Number(tournamentCount[0].count),
          matches: Number(matchCount[0].count),
          weeklyTopFans: Number(weeklyTopFanCount[0].count),
        },
        series: {
          newUsersByDay: newUsersByDay.map((r) => ({ date: r.date, count: Number(r.count) })),
          activeUsersByDay: activeByDay.map((r) => ({ date: r.date, count: Number(r.count) })),
          xpByDay: xpByDay.map((r) => ({ date: r.date, xp: Number(r.xp), count: Number(r.count) })),
          commentsByDay: commentByDay.map((r) => ({ date: r.date, count: Number(r.count) })),
          cardGrantsByDay: cardGrantsByDay.map((r) => ({ date: r.date, grants: Number(r.grants), cards: Number(r.cards) })),
          userAchievementsByDay: userAchievementsByDay.map((r) => ({ date: r.date, count: Number(r.count) })),
          quizAttemptsByDay: quizAttemptStats.map((r) => ({ date: r.date, attempts: Number(r.attempts), correct: Number(r.correct) })),
          predictionVotesByDay: predictionVoteStats.map((r) => ({ date: r.date, votes: Number(r.votes) })),
          matchesByDay: matchesByDay.map((r) => ({ date: r.date, count: Number(r.count) })),
        },
        roleDistribution: roleDistribution.map((r) => ({ role: r.role, count: Number(r.count) })),
        popularCards: popularCards.map((c) => ({
          cardId: c.cardId,
          cardName: c.cardName,
          cardCategory: c.cardCategory,
          claimedSupply: Number(c.claimedSupply),
          totalSupply: Number(c.totalSupply),
          holders: Number(c.holders),
        })),
        tournamentsByStatus: tournamentsByStatus.map((t) => ({ status: t.status, count: Number(t.count) })),
        topXpEarners: topXpEarners.map((u) => ({
          userId: u.userId,
          userName: u.userName,
          userUsername: u.userUsername,
          userAvatarUrl: u.userAvatar ? (avatarUrls[u.userAvatar] ?? null) : null,
          xp: Number(u.xp),
          xpEvents: Number(u.xpEvents),
        })),
      };
    }),

  // ---------------------------------------------------------- Comment Reports
  listCommentReports: moderatorQuery.query(async () => {
    const db = getDb();
    const list = await db
      .select({
        id: commentReports.id,
        commentId: commentReports.commentId,
        commentContent: comments.content,
        commentUserId: comments.userId,
        reporterId: commentReports.reporterId,
        reporterName: sql<string | null>`${sql.raw('NULL')}`.mapWith(String),
        commentReporterName: users.name,
        commentReporterUsername: users.username,
        reason: commentReports.reason,
        customReason: commentReports.customReason,
        status: commentReports.status,
        createdAt: commentReports.createdAt,
      })
      .from(commentReports)
      .innerJoin(comments, eq(commentReports.commentId, comments.id))
      .leftJoin(users, eq(commentReports.reporterId, users.id))
      .orderBy(desc(commentReports.createdAt))
      .limit(200);

    return list;
  }),

  resolveCommentReport: moderatorQuery
    .input(
      z.object({
        id: z.number(),
        action: z.enum(["resolve", "dismiss", "delete_comment"]),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const report = await db
        .select({ commentId: commentReports.commentId })
        .from(commentReports)
        .where(eq(commentReports.id, input.id))
        .limit(1);

      if (!report[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Report not found." });
      }

      if (input.action === "delete_comment") {
        await db
          .delete(comments)
          .where(eq(comments.id, report[0].commentId));
      }

      const newStatus =
        input.action === "resolve"
          ? "resolved"
          : input.action === "dismiss"
            ? "dismissed"
            : "resolved";

      await db
        .update(commentReports)
        .set({ status: newStatus })
        .where(eq(commentReports.id, input.id));

      return { ok: true };
    }),

  // ---------------------------------------------------------- Notification Rules
   listNotificationRules: adminQuery.query(async () => {
    const db = getDb();
    const list = await db
      .select({
        id: notificationRules.id,
        name: notificationRules.name,
        description: notificationRules.description,
        notificationTypeId: notificationRules.notificationTypeId,
        notificationTypeName: notificationTypes.name,
        platform: notificationRules.platform,
        triggerRole: notificationRules.triggerRole,
        ownershipType: notificationRules.ownershipType,
        targetType: notificationRules.targetType,
        targetRole: notificationRules.targetRole,
        targetTeamId: notificationRules.targetTeamId,
        targetUserIds: notificationRules.targetUserIds,
        titleTemplate: notificationRules.titleTemplate,
        messageTemplate: notificationRules.messageTemplate,
        buttonText: notificationRules.buttonText,
        linkLabel: notificationRules.linkLabel,
        emoji: notificationRules.emoji,
        cooldownMinutes: notificationRules.cooldownMinutes,
        isActive: notificationRules.isActive,
        createdAt: notificationRules.createdAt,
        updatedAt: notificationRules.updatedAt,
      })
      .from(notificationRules)
      .leftJoin(notificationTypes, eq(notificationRules.notificationTypeId, notificationTypes.id))
      .orderBy(notificationRules.id);

    const types = await db
      .select()
      .from(notificationTypes)
      .orderBy(notificationTypes.id);

    return { rules: list, notificationTypes: types };
  }),

   createNotificationRule: adminQuery
     .input(
       z.object({
         name: z.string().min(1).max(255),
         description: z.string().max(2000).nullish(),
         notificationTypeId: z.number().int().positive(),
          platform: z.enum(["youtube", "instagram", "twitch", "kick", "facebook", "other", "any"]).default("any"),
         triggerRole: z.enum(["player", "co-owner", "owner", "staff", "any"]).default("any"),
         ownershipType: z.enum(["personal", "team", "any"]).default("any"),
         targetType: z.enum(["everyone", "role", "users", "followers", "team"]).default("everyone"),
         targetRole: z.string().max(64).nullish(),
         targetTeamId: z.number().int().positive().nullish(),
         targetUserIds: z.array(z.number().int().positive()).max(100).optional(),
         titleTemplate: z.string().max(255).nullish(),
         messageTemplate: z.string().max(2000).nullish(),
         buttonText: z.string().max(128).nullish(),
         linkLabel: z.string().max(128).nullish(),
         emoji: z.string().max(16).nullish(),
         cooldownMinutes: z.number().int().min(1).max(1440).default(30),
         isActive: z.boolean().default(true),
       }),
     )
     .mutation(async ({ input }) => {
       const db = getDb();
       const typeExists = await db
         .select({ id: notificationTypes.id })
         .from(notificationTypes)
         .where(eq(notificationTypes.id, input.notificationTypeId))
         .limit(1);
       if (!typeExists[0]) {
         throw new TRPCError({ code: "NOT_FOUND", message: "Notification type not found." });
       }

       await db.insert(notificationRules).values({
         name: input.name,
         description: input.description ?? null,
         notificationTypeId: input.notificationTypeId,
         platform: input.platform,
         triggerRole: input.triggerRole,
         ownershipType: input.ownershipType,
         targetType: input.targetType,
         targetRole: input.targetRole ?? null,
         targetTeamId: input.targetTeamId ?? null,
         targetUserIds: input.targetUserIds ? JSON.stringify(input.targetUserIds) : null,
         titleTemplate: input.titleTemplate ?? null,
         messageTemplate: input.messageTemplate ?? null,
         buttonText: input.buttonText ?? null,
         linkLabel: input.linkLabel ?? null,
         emoji: input.emoji ?? null,
         cooldownMinutes: input.cooldownMinutes,
         isActive: input.isActive,
       });
      return { ok: true };
    }),

   updateNotificationRule: adminQuery
     .input(
       z.object({
         id: z.number().int().positive(),
         name: z.string().min(1).max(255),
         description: z.string().max(2000).nullish(),
         notificationTypeId: z.number().int().positive(),
          platform: z.enum(["youtube", "instagram", "twitch", "kick", "facebook", "other", "any"]),
         triggerRole: z.enum(["player", "co-owner", "owner", "staff", "any"]),
         ownershipType: z.enum(["personal", "team", "any"]),
         targetType: z.enum(["everyone", "role", "users", "followers", "team"]),
         targetRole: z.string().max(64).nullish(),
         targetTeamId: z.number().int().positive().nullish(),
         targetUserIds: z.array(z.number().int().positive()).max(100).optional(),
         titleTemplate: z.string().max(255).nullish(),
         messageTemplate: z.string().max(2000).nullish(),
         buttonText: z.string().max(128).nullish(),
         linkLabel: z.string().max(128).nullish(),
         emoji: z.string().max(16).nullish(),
         cooldownMinutes: z.number().int().min(1).max(1440),
         isActive: z.boolean(),
       }),
     )
     .mutation(async ({ input }) => {
       const db = getDb();
       await db
         .update(notificationRules)
         .set({
           name: input.name,
           description: input.description ?? null,
           notificationTypeId: input.notificationTypeId,
           platform: input.platform,
           triggerRole: input.triggerRole,
           ownershipType: input.ownershipType,
           targetType: input.targetType,
           targetRole: input.targetRole ?? null,
           targetTeamId: input.targetTeamId ?? null,
           targetUserIds: input.targetUserIds ? JSON.stringify(input.targetUserIds) : null,
           titleTemplate: input.titleTemplate ?? null,
           messageTemplate: input.messageTemplate ?? null,
           buttonText: input.buttonText ?? null,
           linkLabel: input.linkLabel ?? null,
           emoji: input.emoji ?? null,
           cooldownMinutes: input.cooldownMinutes,
           isActive: input.isActive,
         })
         .where(eq(notificationRules.id, input.id));
       return { ok: true };
     }),

  deleteNotificationRule: adminQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(notificationRuleLogs).where(eq(notificationRuleLogs.ruleId, input.id));
      await db.delete(notificationRules).where(eq(notificationRules.id, input.id));
      return { ok: true };
    }),

  // ------------------------------------------------------- Admin: Live Links
   listLiveLinks: moderatorQuery.query(async () => {
     const db = getDb();
     const list = await db
       .select({
         id: liveLinks.id,
         userId: liveLinks.userId,
         userName: users.name,
         userUsername: users.username,
         userRole: users.role,
         playerId: liveLinks.playerId,
         ign: players.ign,
         teamId: liveLinks.teamId,
         teamName: teams.name,
         ownershipType: liveLinks.ownershipType,
         platform: liveLinks.platform,
         displayPlatform: liveLinks.displayPlatform,
         liveUrl: liveLinks.liveUrl,
         isLive: liveLinks.isLive,
         isManuallyLive: liveLinks.isManuallyLive,
         title: liveLinks.title,
         viewerCount: liveLinks.viewerCount,
         thumbnailKey: liveLinks.thumbnailKey,
         createdAt: liveLinks.createdAt,
         updatedAt: liveLinks.updatedAt,
       })
       .from(liveLinks)
       .leftJoin(users, eq(liveLinks.userId, users.id))
       .leftJoin(players, eq(liveLinks.playerId, players.id))
       .leftJoin(teams, eq(liveLinks.teamId, teams.id))
       .orderBy(desc(liveLinks.isLive), desc(liveLinks.createdAt))
       .limit(500);

    const imageKeys = [...new Set(list.map((l) => l.thumbnailKey).filter(Boolean) as string[])];
    const urls = imageKeys.length ? await signKeys(imageKeys) : {};

    return list.map((l) => ({
      ...l,
      thumbnailUrl: l.thumbnailKey ? (urls[l.thumbnailKey] ?? null) : null,
    }));
  }),

  // ------------------------------------------------------- Admin: Rule Logs
  listNotificationRuleLogs: adminQuery.query(async () => {
    const db = getDb();
    const list = await db
      .select({
        id: notificationRuleLogs.id,
        ruleId: notificationRuleLogs.ruleId,
        ruleName: notificationRules.name,
        liveLinkId: notificationRuleLogs.liveLinkId,
        triggeredAt: notificationRuleLogs.triggeredAt,
        deliveredCount: notificationRuleLogs.deliveredCount,
        skipped: notificationRuleLogs.skipped,
        skipReason: notificationRuleLogs.skipReason,
        createdAt: notificationRuleLogs.createdAt,
      })
      .from(notificationRuleLogs)
      .innerJoin(notificationRules, eq(notificationRuleLogs.ruleId, notificationRules.id))
      .orderBy(desc(notificationRuleLogs.createdAt))
      .limit(200);
    return list;
  }),

  // ----------------------------------------------------- Sponsored Ads: Campaigns
  listAdCampaigns: adminQuery.query(async () => {
    const db = getDb();
    const list = await db.select().from(adCampaigns).orderBy(desc(adCampaigns.createdAt)).limit(200);
    return list;
  }),

  getAdCampaign: adminQuery
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = getDb();
      const campaign = await db.query.adCampaigns.findFirst({ where: eq(adCampaigns.id, input.id) });
      if (!campaign) return null;

      const creatives = await db
        .select()
        .from(adCreatives)
        .where(eq(adCreatives.campaignId, campaign.id))
        .orderBy(desc(adCreatives.createdAt))
        .limit(50);

      const mediaKeys = [
        ...new Set(
          creatives
            .map((c) => [c.mediaKey, c.logoKey, c.previewImageKey].filter(Boolean) as string[])
            .flat(),
        ),
      ];
      const urls = mediaKeys.length ? await signKeys(mediaKeys) : {};

      return {
        ...campaign,
        creatives: creatives.map((c) => ({
          ...c,
          mediaUrl: c.mediaKey ? (urls[c.mediaKey] ?? null) : null,
          logoUrl: c.logoKey ? (urls[c.logoKey] ?? null) : null,
          previewImageUrl: c.previewImageKey ? (urls[c.previewImageKey] ?? null) : null,
        })),
      };
    }),

  createAdCampaign: adminQuery
    .input(
      z.object({
        name: z.string().min(1).max(255),
        advertiser: z.string().max(255).nullish(),
        description: z.string().max(2000).nullish(),
        status: z.enum(["draft", "scheduled", "active", "paused", "completed", "cancelled"]).default("draft"),
        placement: z.enum(["sidebar", "header", "between_media_items", "feed_top", "feed_bottom"]).default("sidebar"),
        targetPages: z.array(z.string().max(128)).max(50).optional(),
        budget: z.number().int().min(0).default(0),
        startDate: z.coerce.date().nullish(),
        endDate: z.coerce.date().nullish(),
        frequencyCap: z.number().int().min(1).max(100).default(3),
        priority: z.number().int().min(0).max(1000).default(0),
        impressionLimit: z.number().int().min(0).nullable().optional(),
        isActive: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const targetPagesJson = input.targetPages ? JSON.stringify(input.targetPages) : null;
      const [{ id }] = await db
        .insert(adCampaigns)
        .values({
          name: input.name,
          advertiser: input.advertiser ?? null,
          description: input.description ?? null,
          status: input.status,
          placement: input.placement,
          targetPages: targetPagesJson,
          budget: input.budget,
          startDate: input.startDate ?? null,
          endDate: input.endDate ?? null,
          frequencyCap: input.frequencyCap,
          priority: input.priority,
          impressionLimit: input.impressionLimit ?? null,
          isActive: input.isActive,
        })
        .$returningId();
      return { id };
    }),

  updateAdCampaign: adminQuery
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).max(255),
        advertiser: z.string().max(255).nullish(),
        description: z.string().max(2000).nullish(),
        status: z.enum(["draft", "scheduled", "active", "paused", "completed", "cancelled"]),
        placement: z.enum(["sidebar", "header", "between_media_items", "feed_top", "feed_bottom"]),
        targetPages: z.array(z.string().max(128)).max(50).optional(),
        budget: z.number().int().min(0),
        startDate: z.coerce.date().nullish(),
        endDate: z.coerce.date().nullish(),
         frequencyCap: z.number().int().min(1).max(100),
        priority: z.number().int().min(0).max(1000),
        impressionLimit: z.number().int().min(0).nullable().optional(),
        isActive: z.boolean(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const targetPagesJson = input.targetPages ? JSON.stringify(input.targetPages) : null;
      await db
        .update(adCampaigns)
        .set({
          name: input.name,
          advertiser: input.advertiser ?? null,
          description: input.description ?? null,
          status: input.status,
          placement: input.placement,
          targetPages: targetPagesJson,
          budget: input.budget,
          startDate: input.startDate ?? null,
          endDate: input.endDate ?? null,
          frequencyCap: input.frequencyCap,
          priority: input.priority,
          impressionLimit: input.impressionLimit ?? null,
          isActive: input.isActive,
        })
        .where(eq(adCampaigns.id, input.id));
      return { ok: true };
    }),

  // ----------------------------------------- Ad Preview / Test Delivery
  previewAdDelivery: adminQuery
    .input(
      z.object({
        campaignId: z.number().int().positive(),
        page: z.string().optional(),
        placement: z.string().optional(),
        isMobile: z.boolean().optional().default(false),
      }),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const now = new Date();

      const campaign = await db.query.adCampaigns.findFirst({
        where: eq(adCampaigns.id, input.campaignId),
      });

      if (!campaign) {
        return { eligible: false, reasons: ["Campaign not found"] };
      }

      const reasons: string[] = [];

      // Status check
      if (campaign.status !== "active" && campaign.status !== "scheduled") {
        reasons.push(`Status is "${campaign.status}" — must be "active" or "scheduled"`);
      }

      // isActive check
      if (!campaign.isActive) {
        reasons.push("Campaign is not active (isActive=false)");
      }

      // Placement check
      if (input.placement && campaign.placement !== input.placement) {
        reasons.push(`Placement mismatch: campaign targets "${campaign.placement}", requested "${input.placement}"`);
      }

      // Date range checks
      if (campaign.startDate && campaign.startDate > now) {
        reasons.push(`Start date (${campaign.startDate.toISOString()}) is in the future`);
      }
      if (campaign.endDate && campaign.endDate < now) {
        reasons.push(`End date (${campaign.endDate.toISOString()}) has passed`);
      }

      // Impression limit check
      if (campaign.impressionLimit && campaign.impressions >= campaign.impressionLimit) {
        reasons.push(
          `Impression limit reached: ${campaign.impressions}/${campaign.impressionLimit}`,
        );
      }

      // Page targeting check
      if (input.page && campaign.targetPages) {
        try {
          const pages = JSON.parse(campaign.targetPages);
          if (Array.isArray(pages) && pages.length > 0 && !pages.includes(input.page)) {
            reasons.push(`Page "${input.page}" not in target pages: ${JSON.stringify(pages)}`);
          }
        } catch {
          reasons.push(`Invalid targetPages JSON: ${campaign.targetPages}`);
        }
      }

      // Creatives check
      const creatives = await db
        .select()
        .from(adCreatives)
        .where(eq(adCreatives.campaignId, campaign.id));

      if (creatives.length === 0) {
        reasons.push("No creatives found for this campaign");
      } else {
        const firstCreative = creatives[0];
         if (!firstCreative.mediaKey) {
           reasons.push("Creative has no mediaKey — media will not display");
         }
        if (!firstCreative.destinationUrl) {
          reasons.push("Creative has no destinationUrl");
        }
        if (firstCreative.isAdminOnly) {
          reasons.push("Creative is admin-only and will not show publicly");
        }
        if (input.isMobile && !firstCreative.mobileVisible) {
          reasons.push("Creative is hidden on mobile");
        }
        if (!input.isMobile && !firstCreative.desktopVisible) {
          reasons.push("Creative is hidden on desktop");
        }
      }

      const mediaKeys = [
        ...new Set(
          creatives
            .map((c) => [c.mediaKey, c.logoKey, c.previewImageKey].filter(Boolean) as string[])
            .flat(),
        ),
      ];
      const urls = mediaKeys.length ? await signKeys(mediaKeys) : {};

      return {
        eligible: reasons.length === 0,
        reasons,
        campaign,
        creatives: creatives.map((c) => ({
          ...c,
          mediaUrl: c.mediaKey ? (urls[c.mediaKey] ?? null) : null,
          logoUrl: c.logoKey ? (urls[c.logoKey] ?? null) : null,
          previewImageUrl: c.previewImageKey ? (urls[c.previewImageKey] ?? null) : null,
        })),
      };
    }),

  deleteAdCampaign: adminQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(adMetrics).where(eq(adMetrics.campaignId, input.id));
      await db.delete(adCreatives).where(eq(adCreatives.campaignId, input.id));
      await db.delete(adCampaigns).where(eq(adCampaigns.id, input.id));
      return { ok: true };
    }),

  // ----------------------------------------------------- Sponsored Ads: Creatives
  createAdCreative: adminQuery
    .input(
      z.object({
         campaignId: z.number().int().positive(),
        title: z.string().min(1).max(255),
        mediaKey: z.string().max(512).nullish(),
        mediaType: z.enum(["image", "video"]).default("image"),
        destinationUrl: z.string().min(1).max(1024).url(),
        buttonText: z.string().max(128).nullish(),
        linkLabel: z.string().max(128).nullish(),
        bodyText: z.string().max(2000).nullish(),
        isAdminOnly: z.boolean().default(false),
        advertiser: z.string().max(255).nullish(),
        logoKey: z.string().max(512).nullish(),
        secondaryLinkUrl: z.string().max(1024).nullish().refine((v) => !v || /^https?:\/\//.test(v as string), {
          message: "Secondary link URL must be a valid http(s) URL",
        }),
        secondaryLinkLabel: z.string().max(128).nullish(),
        layout: z.enum(["banner", "card", "image_only", "video", "native"]).default("card"),
        targetPages: z.array(z.string().max(128)).max(50).optional(),
        desktopVisible: z.boolean().default(true),
        mobileVisible: z.boolean().default(true),
        width: z.string().max(64).nullish(),
        height: z.string().max(64).nullish(),
        aspectRatio: z.string().max(32).nullish(),
        alignment: z.enum(["left", "center", "right"]).default("center"),
        backgroundColor: z.string().max(64).nullish(),
        borderColor: z.string().max(64).nullish(),
        textColor: z.string().max(64).nullish(),
        showBorder: z.boolean().default(false),
        showShadow: z.boolean().default(false),
        textPosition: z.enum(["top", "bottom", "overlay", "outside"]).default("bottom"),
        ctaStyle: z.enum(["filled", "outline", "text"]).default("filled"),
        previewImageKey: z.string().max(512).nullish(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const targetPagesJson = input.targetPages ? JSON.stringify(input.targetPages) : null;

      const [{ id }] = await db
        .insert(adCreatives)
        .values({
          campaignId: input.campaignId,
          title: input.title,
          mediaKey: input.mediaKey ?? null,
          mediaType: input.mediaType,
          destinationUrl: input.destinationUrl,
          buttonText: input.buttonText ?? null,
          linkLabel: input.linkLabel ?? null,
          bodyText: input.bodyText ?? null,
          isAdminOnly: input.isAdminOnly,
          advertiser: input.advertiser ?? null,
          logoKey: input.logoKey ?? null,
          secondaryLinkUrl: input.secondaryLinkUrl ?? null,
          secondaryLinkLabel: input.secondaryLinkLabel ?? null,
          layout: input.layout,
          targetPages: targetPagesJson,
          desktopVisible: input.desktopVisible,
          mobileVisible: input.mobileVisible,
          width: input.width ?? null,
          height: input.height ?? null,
          aspectRatio: input.aspectRatio ?? null,
          alignment: input.alignment,
          backgroundColor: input.backgroundColor ?? null,
          borderColor: input.borderColor ?? null,
          textColor: input.textColor ?? null,
          showBorder: input.showBorder,
          showShadow: input.showShadow,
          textPosition: input.textPosition,
          ctaStyle: input.ctaStyle,
          previewImageKey: input.previewImageKey ?? null,
        })
        .$returningId();
      return { id };
    }),

   updateAdCreative: adminQuery
    .input(
      z.object({
        id: z.number().int().positive(),
        title: z.string().min(1).max(255),
        mediaKey: z.string().max(512).nullish(),
        mediaType: z.enum(["image", "video"]),
        destinationUrl: z.string().min(1).max(1024).url(),
        buttonText: z.string().max(128).nullish(),
        linkLabel: z.string().max(128).nullish(),
        bodyText: z.string().max(2000).nullish(),
        isAdminOnly: z.boolean(),
        advertiser: z.string().max(255).nullish(),
        logoKey: z.string().max(512).nullish(),
        secondaryLinkUrl: z.string().max(1024).nullish().refine((v) => !v || /^https?:\/\//.test(v as string), {
          message: "Secondary link URL must be a valid http(s) URL",
        }),
        secondaryLinkLabel: z.string().max(128).nullish(),
        layout: z.enum(["banner", "card", "image_only", "video", "native"]),
        targetPages: z.array(z.string().max(128)).max(50).optional(),
        desktopVisible: z.boolean(),
        mobileVisible: z.boolean(),
        width: z.string().max(64).nullish(),
        height: z.string().max(64).nullish(),
        aspectRatio: z.string().max(32).nullish(),
        alignment: z.enum(["left", "center", "right"]),
        backgroundColor: z.string().max(64).nullish(),
        borderColor: z.string().max(64).nullish(),
        textColor: z.string().max(64).nullish(),
        showBorder: z.boolean(),
        showShadow: z.boolean(),
        textPosition: z.enum(["top", "bottom", "overlay", "outside"]),
        ctaStyle: z.enum(["filled", "outline", "text"]),
        previewImageKey: z.string().max(512).nullish(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const targetPagesJson = input.targetPages ? JSON.stringify(input.targetPages) : null;

      await db
        .update(adCreatives)
        .set({
          title: input.title,
          mediaKey: input.mediaKey ?? null,
          mediaType: input.mediaType,
          destinationUrl: input.destinationUrl,
          buttonText: input.buttonText ?? null,
          linkLabel: input.linkLabel ?? null,
          bodyText: input.bodyText ?? null,
          isAdminOnly: input.isAdminOnly,
          advertiser: input.advertiser ?? null,
          logoKey: input.logoKey ?? null,
          secondaryLinkUrl: input.secondaryLinkUrl ?? null,
          secondaryLinkLabel: input.secondaryLinkLabel ?? null,
          layout: input.layout,
          targetPages: targetPagesJson,
          desktopVisible: input.desktopVisible,
          mobileVisible: input.mobileVisible,
          width: input.width ?? null,
          height: input.height ?? null,
          aspectRatio: input.aspectRatio ?? null,
          alignment: input.alignment,
          backgroundColor: input.backgroundColor ?? null,
          borderColor: input.borderColor ?? null,
          textColor: input.textColor ?? null,
          showBorder: input.showBorder,
          showShadow: input.showShadow,
          textPosition: input.textPosition,
          ctaStyle: input.ctaStyle,
          previewImageKey: input.previewImageKey ?? null,
        })
        .where(eq(adCreatives.id, input.id));
      return { ok: true };
    }),

  deleteAdCreative: adminQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(adCreatives).where(eq(adCreatives.id, input.id));
      return { ok: true };
    }),

  // ----------------------------------------------------- Sponsored Ads: Analytics
  adCampaignMetrics: adminQuery
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = getDb();
      const campaign = await db.query.adCampaigns.findFirst({
        where: eq(adCampaigns.id, input.id),
      });
      if (!campaign) return null;

      // Get metrics breakdown by day for the last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const daily = await db
        .select({
          date: sql<string>`DATE(${adMetrics.createdAt})`,
          impressions: sql<number>`SUM(CASE WHEN ${adMetrics.eventType} = 'impression' THEN 1 ELSE 0 END)`,
          clicks: sql<number>`SUM(CASE WHEN ${adMetrics.eventType} = 'click' THEN 1 ELSE 0 END)`,
          dismissals: sql<number>`SUM(CASE WHEN ${adMetrics.eventType} = 'dismissal' THEN 1 ELSE 0 END)`,
        })
        .from(adMetrics)
        .where(
          and(
            eq(adMetrics.campaignId, input.id),
            gte(adMetrics.createdAt, thirtyDaysAgo),
          ),
        )
        .groupBy(sql`DATE(${adMetrics.createdAt})`)
        .orderBy(sql`DATE(${adMetrics.createdAt})`);

      return {
        ...campaign,
        metrics: {
          impressions: campaign.impressions,
          clicks: campaign.clicks,
          dismissals: campaign.dismissals,
          spent: campaign.spent,
          budget: campaign.budget,
          ctr: campaign.impressions > 0 ? (campaign.clicks / campaign.impressions) * 100 : 0,
        },
        daily,
      };
    }),

   // --------------------------------------------------------------------- Placement Performance
   getAdPlacementPerformance: adminQuery
     .input(
       z.object({
         campaignId: z.number().int().positive().optional(),
         placement: z
           .enum(["sidebar", "header", "between_media_items", "feed_top", "feed_bottom"])
           .optional(),
       }),
     )
     .query(async ({ input }) => {
       const db = getDb();
       const campaigns = await db
         .select({
           id: adCampaigns.id,
           name: adCampaigns.name,
           placement: adCampaigns.placement,
           status: adCampaigns.status,
           impressions: adCampaigns.impressions,
           clicks: adCampaigns.clicks,
           dismissals: adCampaigns.dismissals,
           budget: adCampaigns.budget,
           spent: adCampaigns.spent,
           startDate: adCampaigns.startDate,
           endDate: adCampaigns.endDate,
           isActive: adCampaigns.isActive,
         })
         .from(adCampaigns)
         .where(
           input.campaignId
             ? eq(adCampaigns.id, input.campaignId)
             : input.placement
               ? eq(adCampaigns.placement, input.placement)
               : undefined,
         )
         .orderBy(desc(adCampaigns.createdAt))
         .limit(200);

       const placementStats = campaigns.reduce(
         (acc, c) => {
           const key = c.placement;
           if (!acc[key]) {
             acc[key] = {
               placement: c.placement,
               campaigns: 0,
               impressions: 0,
               clicks: 0,
               dismissals: 0,
               spent: 0,
             };
           }
           acc[key].campaigns += 1;
           acc[key].impressions += c.impressions ?? 0;
           acc[key].clicks += c.clicks ?? 0;
           acc[key].dismissals += c.dismissals ?? 0;
           acc[key].spent += c.spent ?? 0;
           return acc;
         },
         {} as Record<string, {
           placement: string;
           campaigns: number;
           impressions: number;
           clicks: number;
           dismissals: number;
           spent: number;
         }>,
       );

       const placements = Object.values(placementStats).map((p) => ({
         ...p,
         ctr: p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0,
       }));

       return {
         campaigns: campaigns.map((c) => ({
           ...c,
           ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
         })),
         placements,
       };
      }),

  // --------------------------------------------------------------------- Fan Rewards: CRUD
  listFanRewards: adminQuery.query(async () => {
    const db = getDb();
    const list = await db.select().from(fanRewards).orderBy(asc(fanRewards.category), desc(fanRewards.createdAt));
    const photoKeys = list.map((r) => r.photoKey).filter(Boolean) as string[];
    const urls = photoKeys.length ? await signKeys(photoKeys) : {};
    return list.map((r) => ({
      ...r,
      photoUrl: r.photoKey ? (urls[r.photoKey] ?? null) : null,
      availableStock: r.stock - r.claimedCount,
    }));
  }),

  getFanReward: adminQuery
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = getDb();
      const reward = await db.query.fanRewards.findFirst({ where: eq(fanRewards.id, input.id) });
      if (!reward) return null;
      const urls = reward.photoKey ? await signKeys([reward.photoKey]) : {};
      return {
        ...reward,
        photoUrl: reward.photoKey ? (urls[reward.photoKey] ?? null) : null,
        availableStock: reward.stock - reward.claimedCount,
      };
    }),

  upsertFanReward: adminQuery
    .input(
      z.object({
        id: z.number().optional(),
        name: z.string().min(1).max(255),
        category: z.string().min(1).max(128).default("Merchandise"),
        description: z.string().max(2000).nullish(),
        photoKey: z.string().max(512).nullish(),
        xpCost: z.number().int().min(0),
        stock: z.number().int().min(0),
        isActive: z.boolean().default(true),
        eligibilityJson: z.string().max(4000).nullish(),
        details: z.string().max(4000).nullish(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const { id, ...data } = input;
      if (id) {
        const existing = await db.query.fanRewards.findFirst({ where: eq(fanRewards.id, id) });
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Reward not found." });
        if (data.stock !== undefined && data.stock < existing.claimedCount) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot reduce stock below already-claimed (${existing.claimedCount}).`,
          });
        }
        await db.update(fanRewards).set({ ...data, updatedAt: new Date() }).where(eq(fanRewards.id, id));
        return { id };
      }
      const [{ id: newId }] = await db
        .insert(fanRewards)
        .values({ ...data, createdById: ctx.user.id })
        .$returningId();
      return { id: newId };
    }),

  deleteFanReward: adminQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const existing = await db.query.fanRewards.findFirst({ where: eq(fanRewards.id, input.id) });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Reward not found." });
      if (existing.claimedCount > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "Cannot delete a reward that has been redeemed. Deactivate it instead." });
      }
      await db.delete(fanRewards).where(eq(fanRewards.id, input.id));
      return { ok: true };
    }),

  listRewardRedemptions: adminQuery
    .input(
      z.object({
        category: z.string().optional(),
        status: z.enum(["pending", "approved", "processing", "completed", "rejected"]).optional(),
        limit: z.number().min(1).max(200).default(100),
      }).optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      let whereClause: SQL<unknown> | undefined;
      if (input?.category && input?.status) {
        whereClause = and(eq(fanRewards.category, input.category), eq(rewardRedemptions.status, input.status));
      } else if (input?.category) {
        whereClause = eq(fanRewards.category, input.category);
      } else if (input?.status) {
        whereClause = eq(rewardRedemptions.status, input.status);
      }
      const list = await db
        .select({
          id: rewardRedemptions.id,
          rewardId: rewardRedemptions.rewardId,
          rewardName: fanRewards.name,
          rewardCategory: fanRewards.category,
          userId: rewardRedemptions.userId,
          userName: users.name,
          userUsername: users.username,
          userAvatar: users.avatar,
          instagramUsername: rewardRedemptions.instagramUsername,
          discordUsername: rewardRedemptions.discordUsername,
          xpSpent: rewardRedemptions.xpSpent,
          status: rewardRedemptions.status,
          adminNotes: rewardRedemptions.adminNotes,
          createdAt: rewardRedemptions.createdAt,
          updatedAt: rewardRedemptions.updatedAt,
        })
        .from(rewardRedemptions)
        .innerJoin(fanRewards, eq(rewardRedemptions.rewardId, fanRewards.id))
        .leftJoin(users, eq(rewardRedemptions.userId, users.id))
        .where(whereClause ?? sql`1=1`)
        .orderBy(desc(rewardRedemptions.createdAt))
        .limit(input?.limit ?? 100);
      return list;
    }),

  getRedemptionHistory: adminQuery
    .input(z.object({ redemptionId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = getDb();
      const history = await db
        .select({
          id: rewardRedemptionHistory.id,
          status: rewardRedemptionHistory.status,
          changedById: rewardRedemptionHistory.changedById,
          adminName: users.name,
          adminNotes: rewardRedemptionHistory.adminNotes,
          changedAt: rewardRedemptionHistory.changedAt,
        })
        .from(rewardRedemptionHistory)
        .leftJoin(users, eq(rewardRedemptionHistory.changedById, users.id))
        .where(eq(rewardRedemptionHistory.redemptionId, input.redemptionId))
        .orderBy(desc(rewardRedemptionHistory.changedAt));
      return history;
    }),

  updateRedemptionStatus: adminQuery
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(["pending", "approved", "processing", "completed", "rejected"]),
        adminNotes: z.string().max(2000).nullish(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const redemption = await db.query.rewardRedemptions.findFirst({
        where: eq(rewardRedemptions.id, input.id),
      });
      if (!redemption) throw new TRPCError({ code: "NOT_FOUND", message: "Redemption not found." });

      const prevStatus = redemption.status;
      const newStatus = input.status;

      await db.transaction(async (tx) => {
        await tx.insert(rewardRedemptionHistory).values({
          redemptionId: redemption.id,
          status: newStatus,
          changedById: ctx.user.id,
          adminNotes: input.adminNotes ?? null,
        });

        if (prevStatus !== "rejected" && newStatus === "rejected") {
          await tx
            .update(users)
            .set({ xp: sql`${users.xp} + ${redemption.xpSpent}` })
            .where(eq(users.id, redemption.userId));
          await tx.insert(xpHistory).values({
            userId: redemption.userId,
            amount: redemption.xpSpent,
            reason: `Reward redemption rejected (id ${redemption.id}) — XP refunded`,
          });
          await tx
            .update(fanRewards)
            .set({ claimedCount: sql`${fanRewards.claimedCount} - 1` })
            .where(eq(fanRewards.id, redemption.rewardId));
        } else if (prevStatus === "pending" && (newStatus === "approved" || newStatus === "processing" || newStatus === "completed")) {
          await tx.insert(xpHistory).values({
            userId: redemption.userId,
            amount: -redemption.xpSpent,
            reason: `Reward redemption ${newStatus} (id ${redemption.id}) — XP deducted`,
          });
        }

        await tx
          .update(rewardRedemptions)
          .set({
            status: newStatus,
            adminNotes: input.adminNotes ?? null,
            updatedAt: new Date(),
          })
          .where(eq(rewardRedemptions.id, redemption.id));
      });

      return { ok: true };
    }),

  // ----------------------------------------------- Content Comments moderation
  listContentCommentReports: adminQuery.query(async () => {
    const db = getDb();
    const list = await db
      .select({
        id: contentCommentReports.id,
        commentId: contentCommentReports.commentId,
        refTable: contentComments.refTable,
        refId: contentComments.refId,
        content: contentComments.content,
        commentUserId: contentComments.userId,
        commentUserName: users.name,
        commentUserUsername: users.username,
        reporterId: contentCommentReports.reporterId,
        reporterName: users.name,
        reporterUsername: users.username,
        reason: contentCommentReports.reason,
        customReason: contentCommentReports.customReason,
        status: contentCommentReports.status,
        createdAt: contentCommentReports.createdAt,
      })
      .from(contentCommentReports)
      .innerJoin(contentComments, eq(contentCommentReports.commentId, contentComments.id))
      .leftJoin(users, eq(contentCommentReports.reporterId, users.id))
      .orderBy(desc(contentCommentReports.createdAt))
      .limit(200);
    return list;
  }),

  resolveContentCommentReport: adminQuery
    .input(
      z.object({
        id: z.number().int().positive(),
        action: z.enum(["resolve", "dismiss", "delete_comment"]),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const report = await db.query.contentCommentReports.findFirst({
        where: eq(contentCommentReports.id, input.id),
      });
      if (!report) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Report not found." });
      }

      const newStatus =
        input.action === "resolve" || input.action === "delete_comment"
          ? "resolved"
          : "dismissed";

      await db
        .update(contentCommentReports)
        .set({ status: newStatus })
        .where(eq(contentCommentReports.id, input.id));

      if (input.action === "delete_comment") {
        await db
          .update(contentComments)
          .set({ hidden: true })
          .where(eq(contentComments.id, report.commentId));
      }

      return { ok: true };
    }),

  ...notificationProcedures,
});

async function setPredictionCorrectOption(
  db: ReturnType<typeof getDb>,
  predictionId: number,
  correctOptionId: number,
  awardedById?: number,
) {
  void awardedById;
  const prediction = await db.query.predictions.findFirst({ where: eq(predictions.id, predictionId) });
  if (!prediction) return;
  const previousCorrectId = prediction.correctOptionId;

  // Load all votes for this prediction
  const votes = await db
    .select()
    .from(predictionVotes)
    .where(eq(predictionVotes.predictionId, predictionId));

  // If the correct option is changing, revoke XP from voters of the old correct option
  if (previousCorrectId && previousCorrectId !== correctOptionId) {
    const oldVoters = votes.filter((v) => v.optionId === previousCorrectId);
    for (const vote of oldVoters) {
      const xpReward = prediction.xpReward;
      if (xpReward > 0) {
        const [user] = await db.select().from(users).where(eq(users.id, vote.userId)).limit(1);
        if (user) {
          const currentXp = user.xp ?? 0;
          const newXp = Math.max(0, currentXp - xpReward);
          await db.update(users).set({ xp: newXp }).where(eq(users.id, user.id));
          await db.insert(xpHistory).values({
            userId: user.id,
            amount: -xpReward,
            reason: `Prediction correction: option ${previousCorrectId} was wrong`,
          });
        }
      }
    }
  }

  // Award XP to voters of the new correct option (only if they haven't already been awarded)
  if (prediction.xpReward > 0) {
    const newVoters = votes.filter((v) => v.optionId === correctOptionId);
    for (const vote of newVoters) {
      // Avoid duplicate XP: skip voters who already received XP for this prediction
      const alreadyAwarded = await db.query.xpHistory.findFirst({
        where: and(
          eq(xpHistory.userId, vote.userId),
          like(xpHistory.reason, `%prediction id ${predictionId}%`),
        ),
      });
      if (alreadyAwarded) continue;
      const [user] = await db.select().from(users).where(eq(users.id, vote.userId)).limit(1);
      if (!user) continue;
      const currentXp = user.xp ?? 0;
      const newXp = currentXp + prediction.xpReward;
      await db.update(users).set({ xp: newXp }).where(eq(users.id, user.id));
      await db.insert(xpHistory).values({
        userId: user.id,
        amount: prediction.xpReward,
        reason: `Prediction correct (prediction id ${predictionId})`,
      });
    }
  }

  await db
    .update(predictions)
    .set({ correctOptionId, status: "answered" })
    .where(eq(predictions.id, predictionId));
}

async function deleteTournamentCascade(id: number) {
  const db = getDb();
  const matchList = await db
    .select({ id: matches.id })
    .from(matches)
    .where(eq(matches.tournamentId, id));
  for (const m of matchList) {
    await db.delete(matchPlayers).where(eq(matchPlayers.matchId, m.id));
  }
  await db.delete(matches).where(eq(matches.tournamentId, id));
  const commentList = await db
    .select({ id: comments.id })
    .from(comments)
    .where(eq(comments.tournamentId, id));
  for (const c of commentList) {
    await db.delete(commentReactions).where(eq(commentReactions.commentId, c.id));
  }
  await db.delete(comments).where(eq(comments.tournamentId, id));
  await db.delete(tournaments).where(eq(tournaments.id, id));
}

// ---------------------------------------------------------------------------
// Notification System
// ---------------------------------------------------------------------------

import {
  listNotificationTypeConfigs,
  setNotificationTypeActive,
  setNotificationTypeAutomatic,
  updateNotificationType,
  listNotificationTemplates,
  getNotificationTemplate,
  createNotificationTemplate,
  updateNotificationTemplate,
  archiveNotificationTemplate,
  restoreNotificationTemplate,
  duplicateNotificationTemplate,
  previewNotificationTemplate,
  sendTemplateNotification,
  listAnnouncementsAdmin,
  getAnnouncementAdmin,
  createAnnouncement,
  updateAnnouncement,
  publishAnnouncement,
  setAnnouncementActive,
  deleteAnnouncement,
  searchUsersForTargeting,
  listRolesForTargeting,
  sendManualNotification,
  notifyPlayerLive,
  notifyClutchHighlight,
  runNotificationScheduler,
} from "./queries/notifications";

