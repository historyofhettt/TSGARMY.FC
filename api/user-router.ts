import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { storage } from "./lib/storage";
import { getOrgSettings, getXpEnabledRoles } from "./queries/orgSettings";
import { usernameExists } from "./queries/users";
import { signKeys } from "./lib/images";
import {
  grantCard,
  hasMilestoneReward,
  recordMilestoneReward,
  getClaimableStreakCardRewards,
  getClaimableXpCardMilestones,
  getUserCardCollection,
  checkAndGrantXpMilestoneCards,
} from "./queries/cards";
import {
  countUnread,
  listUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  recordNotificationClick,
} from "./queries/notifications";

const USERNAME_MIN = 3;
const USERNAME_MAX = 30;
const BIO_MAX = 500;
const INSTAGRAM_MAX = 512;

function sanitizeInstagram(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  return trimmed.slice(0, INSTAGRAM_MAX);
}

async function ensureUserStreak(db: ReturnType<typeof getDb>, userId: number) {
  const existing = await db.query.userStreaks.findFirst({ where: eq(schema.userStreaks.userId, userId) });
  if (!existing) {
    await db.insert(schema.userStreaks).values({ userId, currentStreak: 0, longestStreak: 0 });
  }
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export const userRouter = createRouter({
  getProfile: publicQuery
    .input(z.object({ username: z.string().min(1).max(255) }))
    .query(async ({ input }) => {
      const db = getDb();
      const settings = await getOrgSettings();
      const enabledRoles = getXpEnabledRoles(settings);
      const [user] = await db
        .select({
          id: schema.users.id,
          username: schema.users.username,
          name: schema.users.name,
          bio: schema.users.bio,
          instagram: schema.users.instagram,
          avatar: schema.users.avatar,
          role: schema.users.role,
          createdAt: schema.users.createdAt,
          xp: schema.users.xp,
          featuredCardIds: schema.users.featuredCardIds,
          hiddenCardIds: schema.users.hiddenCardIds,
        })
        .from(schema.users)
        .where(eq(schema.users.username, input.username))
        .limit(1);

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      let avatarUrl: string | null = null;
      if (user.avatar) {
        const { url } = await storage.getPresignedUrl({ key: user.avatar });
        avatarUrl = url;
      }

      return { user: { ...user, avatarUrl, xpVisible: enabledRoles.includes(user.role) } };
    }),

  myAchievements: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select({
        id: schema.achievements.id,
        name: schema.achievements.name,
        description: schema.achievements.description,
        iconKey: schema.achievements.iconKey,
        badge: schema.achievements.badge,
        tag: schema.achievements.tag,
        category: schema.achievements.category,
        requirementType: schema.achievements.requirementType,
        requirementValue: schema.achievements.requirementValue,
        xpReward: schema.achievements.xpReward,
        isActive: schema.achievements.isActive,
        earnedAt: schema.userAchievements.earnedAt,
        progress: schema.userAchievements.progress,
        linkedCardId: schema.achievementCardRewards.cardId,
        cardName: schema.cards.name,
        cardImageKey: schema.cards.imageKey,
      })
      .from(schema.userAchievements)
      .innerJoin(schema.achievements, eq(schema.userAchievements.achievementId, schema.achievements.id))
      .leftJoin(schema.achievementCardRewards, eq(schema.achievementCardRewards.achievementId, schema.achievements.id))
      .leftJoin(schema.cards, eq(schema.cards.id, schema.achievementCardRewards.cardId))
      .where(eq(schema.userAchievements.userId, ctx.user.id))
      .orderBy(desc(schema.userAchievements.earnedAt));

    const keys = [...new Set([...rows.map((r) => r.iconKey), ...rows.map((r) => r.cardImageKey)].filter(Boolean) as string[])];
    const urls = keys.length ? await signKeys(keys) : {};

    return rows.map((r) => ({
      ...r,
      iconUrl: r.iconKey ? (urls[r.iconKey] ?? null) : null,
      cardImageUrl: r.cardImageKey ? (urls[r.cardImageKey] ?? null) : null,
    }));
  }),

  achievementProgress: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const allAchievements = await db
      .select()
      .from(schema.achievements)
      .where(eq(schema.achievements.isActive, true))
      .orderBy(schema.achievements.category, schema.achievements.name);

    const earned = await db
      .select({ achievementId: schema.userAchievements.achievementId })
      .from(schema.userAchievements)
      .where(eq(schema.userAchievements.userId, ctx.user.id));

    const earnedSet = new Set(earned.map((e) => Number(e.achievementId)));

    const cardLinks = await db
      .select({ achievementId: schema.achievementCardRewards.achievementId, cardId: schema.achievementCardRewards.cardId, cardName: schema.cards.name, cardImageKey: schema.cards.imageKey })
      .from(schema.achievementCardRewards)
      .leftJoin(schema.cards, eq(schema.cards.id, schema.achievementCardRewards.cardId));

    const cardLinkMap = new Map<number, typeof cardLinks[0]>();
    for (const cl of cardLinks) cardLinkMap.set(Number(cl.achievementId), cl);

    const imageKeys = [...new Set([...allAchievements.filter((a) => a.iconKey).map((a) => a.iconKey!), ...cardLinks.filter((c) => c.cardImageKey).map((c) => c.cardImageKey!)])];
    const imageUrls = imageKeys.length ? await signKeys(imageKeys) : {};

    let userXp = ctx.user.xp ?? 0;
    let currentStreak = 0;
    const streak = await db.query.userStreaks.findFirst({ where: eq(schema.userStreaks.userId, ctx.user.id) });
    if (streak) currentStreak = streak.currentStreak ?? 0;

    return allAchievements.map((a) => {
      let progress = 0;
      let target: number | null = null;
      let earnedFlag = earnedSet.has(a.id);

      if (a.requirementType === "xp_milestone" && a.requirementValue) {
        target = a.requirementValue;
        progress = Math.min(Math.floor((userXp / target) * 100), 100);
        earnedFlag = userXp >= target;
      } else if (a.requirementType === "login_streak" && a.requirementValue) {
        target = a.requirementValue;
        progress = Math.min(Math.floor((currentStreak / target) * 100), 100);
        earnedFlag = currentStreak >= target;
      } else if (a.requirementType === "quiz_completion" && a.requirementValue) {
        target = a.requirementValue;
        progress = 0;
      } else if (a.requirementType === "task_completion" && a.requirementValue) {
        target = a.requirementValue;
        progress = 0;
      }

      const link = cardLinkMap.get(a.id);

      return {
        id: a.id,
        name: a.name,
        description: a.description,
        iconKey: a.iconKey,
        iconUrl: a.iconKey ? (imageUrls[a.iconKey] ?? null) : null,
        badge: a.badge,
        tag: a.tag,
        category: a.category,
        requirementType: a.requirementType,
        requirementValue: a.requirementValue,
        xpReward: a.xpReward,
        isActive: a.isActive,
        earned: earnedFlag,
        progress,
        target,
        linkedCardId: link?.cardId ?? null,
        cardName: link?.cardName ?? null,
        cardImageUrl: link?.cardImageKey ? (imageUrls[link.cardImageKey] ?? null) : null,
      };
    });
  }),

  updateProfile: authedQuery
    .input(
      z.object({
        username: z.string().min(USERNAME_MIN).max(USERNAME_MAX).optional(),
        bio: z.string().max(BIO_MAX).optional(),
        avatar: z.string().max(512).nullable().optional(),
        instagram: z.string().max(INSTAGRAM_MAX).nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();

       if (input.username !== undefined) {
         if (await usernameExists(input.username, ctx.user.id)) {
           throw new TRPCError({
             code: "CONFLICT",
             message: "Username already exists",
           });
         }
       }

      const updateData: Record<string, unknown> = {};
      if (input.username !== undefined) updateData.username = input.username;
      if (input.bio !== undefined) updateData.bio = input.bio;
      if (input.avatar !== undefined) updateData.avatar = input.avatar;
      if (input.instagram !== undefined) updateData.instagram = sanitizeInstagram(input.instagram);

      if (Object.keys(updateData).length > 0) {
        await db
          .update(schema.users)
          .set(updateData)
          .where(eq(schema.users.id, ctx.user.id));
      }

      const [updated] = await db
        .select({
          id: schema.users.id,
          username: schema.users.username,
          name: schema.users.name,
          bio: schema.users.bio,
          avatar: schema.users.avatar,
          role: schema.users.role,
          createdAt: schema.users.createdAt,
        })
        .from(schema.users)
        .where(eq(schema.users.id, ctx.user.id))
        .limit(1);

      let avatarUrl: string | null = null;
      if (updated.avatar) {
        const { url } = await storage.getPresignedUrl({ key: updated.avatar });
        avatarUrl = url;
      }

      return { user: { ...updated, avatarUrl } };
    }),

  uploadAvatar: authedQuery
    .input(
      z.object({
        name: z.string().min(1).max(400),
        contentBase64: z.string(),
        contentType: z.string().max(128).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
      const ALLOWED_TYPES = new Set([
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/gif",
        "image/avif",
        "image/svg+xml",
      ]);

      const bytes = Uint8Array.from(Buffer.from(input.contentBase64, "base64"));
      if (bytes.byteLength > MAX_IMAGE_BYTES) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Image is too large. Maximum size is 8 MB.",
        });
      }

      const contentType = input.contentType ?? "image/png";
      if (!ALLOWED_TYPES.has(contentType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only image files (PNG, JPG, WebP, GIF, AVIF, SVG) are allowed.",
        });
      }

      const safeName = input.name.replace(/[\\/]/g, "_").slice(0, 200);
      const saved = await storage.uploadFile({
        fileContent: bytes,
        fileName: `tsg/user-avatars/${Date.now()}-${safeName}`,
        contentType,
      });

      await getDb().insert(schema.media).values({
        fileKey: saved.key,
        fileName: safeName,
        category: "user-avatars",
        size: saved.size,
        contentType,
      });

      await getDb()
        .update(schema.users)
        .set({ avatar: saved.key })
        .where(eq(schema.users.id, ctx.user.id));

      const { url } = await storage.getPresignedUrl({ key: saved.key });
      return { key: saved.key, size: saved.size, url };
    }),

  removeAvatar: authedQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    await db
      .update(schema.users)
      .set({ avatar: null })
      .where(eq(schema.users.id, ctx.user.id));
    return { success: true };
  }),

  myXpHistory: authedQuery
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }).optional())
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const target = await db.query.users.findFirst({ where: eq(schema.users.id, ctx.user.id) });
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      }
      const settings = await getOrgSettings();
      const enabledRoles = getXpEnabledRoles(settings);
      if (!enabledRoles.includes(target.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `XP history is hidden for the ${target.role} role.`,
        });
      }
      const list = await db
        .select()
        .from(schema.xpHistory)
        .where(eq(schema.xpHistory.userId, ctx.user.id))
        .orderBy(desc(schema.xpHistory.createdAt))
        .limit(input?.limit ?? 50);
      return list;
    }),

  // --------------------------------------------------------------- xp features: daily login streak
  streakStatus: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    await ensureUserStreak(db, ctx.user.id);
    const streak = await db.query.userStreaks.findFirst({ where: eq(schema.userStreaks.userId, ctx.user.id) });
    const settings = await getOrgSettings();
    return {
      currentStreak: streak?.currentStreak ?? 0,
      longestStreak: streak?.longestStreak ?? 0,
      lastLoginDate: streak?.lastLoginDate ?? null,
      dailyLoginXp: settings?.dailyLoginXp ?? 10,
      streakBonusXp: settings?.streakBonusXp ?? 5,
      maxStreakDays: settings?.maxStreakDays ?? 7,
    };
  }),

  claimStreak: authedQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    await ensureUserStreak(db, ctx.user.id);
    const streak = await db.query.userStreaks.findFirst({ where: eq(schema.userStreaks.userId, ctx.user.id) });
    if (!streak) throw new TRPCError({ code: "NOT_FOUND", message: "Streak record not found." });
    const settings = await getOrgSettings();
    if (settings && settings.streakEnabled === false) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Daily streak is currently disabled." });
    }
    const enabledRoles = getXpEnabledRoles(settings);
    if (!enabledRoles.includes(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: `XP rewards are disabled for the ${ctx.user.role} role.` });
    }
    const now = new Date();
    const today = startOfDay(now);
    const lastLogin = streak.lastLoginDate ? startOfDay(new Date(streak.lastLoginDate)) : null;
    if (lastLogin && isSameDay(lastLogin, today)) {
      throw new TRPCError({ code: "CONFLICT", message: "You have already claimed your daily streak today." });
    }
    let currentStreak = streak.currentStreak;
    if (lastLogin) {
      const yesterday = addDays(lastLogin, 1);
      if (isSameDay(yesterday, today)) {
        currentStreak += 1;
      } else {
        currentStreak = 1;
      }
    } else {
      currentStreak = 1;
    }
    const maxStreak = settings?.maxStreakDays ?? 7;
    const capped = Math.min(currentStreak, maxStreak);
    const baseXp = settings?.dailyLoginXp ?? 10;
    const bonusXp = settings?.streakBonusXp ?? 5;
    const totalXp = baseXp + (capped > 1 ? (capped - 1) * bonusXp : 0);
    const newXp = (ctx.user.xp ?? 0) + totalXp;
    await db.update(schema.users).set({ xp: newXp }).where(eq(schema.users.id, ctx.user.id));
    await db.insert(schema.xpHistory).values({
      userId: ctx.user.id,
      amount: totalXp,
      reason: `Daily streak (day ${currentStreak})`,
    });
    const newLongest = Math.max(currentStreak, streak.longestStreak);
    await db.update(schema.userStreaks).set({ currentStreak, longestStreak: newLongest, lastLoginDate: now }).where(eq(schema.userStreaks.id, streak.id));

    // Check for streak card rewards
    let cardReward: { name: string; category: string } | null = null;
    const rewardRecords = await db
      .select()
      .from(schema.streakCardRewards)
      .where(eq(schema.streakCardRewards.streakDays, currentStreak));
    if (rewardRecords.length) {
      const record = rewardRecords[0];
      const card = await db.query.cards.findFirst({ where: eq(schema.cards.id, record.cardId) });
      if (card && card.isActive) {
        const alreadyClaimed = await hasMilestoneReward(ctx.user.id, "streak", record.id);
        if (!alreadyClaimed) {
          const grantResult = await grantCard({
            userId: ctx.user.id,
            cardId: card.id,
            source: `streak milestone (${currentStreak} days)`,
          });
          if (!grantResult.wasSoldOut) {
            await recordMilestoneReward({
              userId: ctx.user.id,
              rewardType: "streak",
              rewardId: record.id,
              cardId: card.id,
            });
            cardReward = { name: card.name, category: card.category };
          }
        }
      }
    }

    // Check for XP milestone card rewards (streak also increases XP)
    await checkAndGrantXpMilestoneCards(ctx.user.id);

    return { currentStreak, longestStreak: newLongest, xpAwarded: totalXp, newXp, cardReward };
  }),

  // --------------------------------------------------------------- xp features: tournament predictions
  votePrediction: authedQuery
    .input(z.object({ predictionId: z.number(), optionId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const prediction = await db.query.predictions.findFirst({ where: eq(schema.predictions.id, input.predictionId) });
      if (!prediction) throw new TRPCError({ code: "NOT_FOUND", message: "Prediction not found." });
      if (prediction.status === "closed" || prediction.status === "answered") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This prediction is no longer accepting votes." });
      }
      const now = new Date();
      // Effective close time: if a timer (seconds) is set, it overrides the static closesAt
      // because the timer counts down from the moment the prediction was created.
      const effectiveClose = prediction.timerSeconds && prediction.timerSeconds > 0
        ? new Date(prediction.createdAt.getTime() + prediction.timerSeconds * 1000)
        : (prediction.closesAt ? new Date(prediction.closesAt) : null);
      if (effectiveClose && now > effectiveClose) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This prediction has closed." });
      }
      const option = await db.query.predictionOptions.findFirst({ where: and(eq(schema.predictionOptions.id, input.optionId), eq(schema.predictionOptions.predictionId, input.predictionId)) });
      if (!option) throw new TRPCError({ code: "NOT_FOUND", message: "Invalid option." });
      const existing = await db.query.predictionVotes.findFirst({ where: and(eq(schema.predictionVotes.predictionId, input.predictionId), eq(schema.predictionVotes.userId, ctx.user.id)) });
      if (existing) {
        if (existing.optionId === input.optionId) return { ok: true, changed: false };
        await db.update(schema.predictionVotes).set({ optionId: input.optionId }).where(eq(schema.predictionVotes.id, existing.id));
        return { ok: true, changed: true };
      }
      await db.insert(schema.predictionVotes).values({ predictionId: input.predictionId, optionId: input.optionId, userId: ctx.user.id });
      return { ok: true, changed: true };
    }),

  listMyPredictionVotes: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select({
        predictionId: schema.predictionVotes.predictionId,
        optionId: schema.predictionVotes.optionId,
        optionText: schema.predictionOptions.text,
        createdAt: schema.predictionVotes.createdAt,
      })
      .from(schema.predictionVotes)
      .innerJoin(schema.predictionOptions, eq(schema.predictionVotes.optionId, schema.predictionOptions.id))
      .where(eq(schema.predictionVotes.userId, ctx.user.id))
      .orderBy(desc(schema.predictionVotes.createdAt));
    return rows;
  }),

  // --------------------------------------------------------------- xp features: TSG Quiz
  submitQuizAttempt: authedQuery
    .input(z.object({ questionId: z.number(), optionId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const question = await db.query.quizQuestions.findFirst({ where: eq(schema.quizQuestions.id, input.questionId) });
      if (!question || !question.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "Question not found or inactive." });
      const existing = await db.query.quizAttempts.findFirst({ where: and(eq(schema.quizAttempts.questionId, input.questionId), eq(schema.quizAttempts.userId, ctx.user.id)) });
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "You have already attempted this question." });
      const option = await db.query.quizOptions.findFirst({ where: and(eq(schema.quizOptions.id, input.optionId), eq(schema.quizOptions.questionId, input.questionId)) });
      if (!option) throw new TRPCError({ code: "NOT_FOUND", message: "Invalid option." });
      const isCorrect = option.isCorrect;
      const settings = await getOrgSettings();
      const enabledRoles = getXpEnabledRoles(settings);
      let xpAwarded = 0;
      let cardGranted = false;
      let cardId: number | null = null;

      if (isCorrect && enabledRoles.includes(ctx.user.role)) {
        xpAwarded = question.xpReward;
        const newXp = (ctx.user.xp ?? 0) + xpAwarded;
        await db.update(schema.users).set({ xp: newXp }).where(eq(schema.users.id, ctx.user.id));
        await db.insert(schema.xpHistory).values({ userId: ctx.user.id, amount: xpAwarded, reason: `Quiz correct: ${question.question.slice(0, 50)}` });
        await checkAndGrantXpMilestoneCards(ctx.user.id);

        if (question.cardRewardId) {
          try {
            const result = await grantCard({
              userId: ctx.user.id,
              cardId: question.cardRewardId,
              quantity: 1,
              source: "quiz correct",
              note: `Quiz: ${question.question.slice(0, 80)}`,
              grantedById: ctx.user.id,
            });
            cardGranted = result.granted > 0;
            cardId = question.cardRewardId;
          } catch {
            cardGranted = false;
          }
        }
      }
      await db.insert(schema.quizAttempts).values({ questionId: input.questionId, userId: ctx.user.id, optionId: input.optionId, isCorrect, xpAwarded });
      return { isCorrect, xpAwarded, cardGranted, cardId };
    }),

  // --------------------------------------------------------------- xp features: XP Tasks
  completeXpTask: authedQuery
    .input(z.object({ taskId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const task = await db.query.xpTasks.findFirst({ where: eq(schema.xpTasks.id, input.taskId) });
      if (!task || !task.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found or inactive." });
      if (task.deadlineAt && new Date() > new Date(task.deadlineAt)) throw new TRPCError({ code: "BAD_REQUEST", message: "Task deadline has passed." });
      const existing = await db.query.userTaskCompletions.findFirst({ where: and(eq(schema.userTaskCompletions.taskId, input.taskId), eq(schema.userTaskCompletions.userId, ctx.user.id)) });
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "You have already completed this task." });
      const settings = await getOrgSettings();
      const enabledRoles = getXpEnabledRoles(settings);
      let xpAwarded = 0;
      if (enabledRoles.includes(ctx.user.role)) {
        xpAwarded = task.xpReward;
        const newXp = (ctx.user.xp ?? 0) + xpAwarded;
        await db.update(schema.users).set({ xp: newXp }).where(eq(schema.users.id, ctx.user.id));
        await db.insert(schema.xpHistory).values({ userId: ctx.user.id, amount: xpAwarded, reason: `Task completed: ${task.title}` });
        await checkAndGrantXpMilestoneCards(ctx.user.id);
      }
      await db.insert(schema.userTaskCompletions).values({ taskId: input.taskId, userId: ctx.user.id, xpAwarded });
      return { xpAwarded };
    }),

  // --------------------------------------------------------------- card collection
  myCardCollection: authedQuery.query(async ({ ctx }) => {
    return getUserCardCollection(ctx.user.id);
  }),

  cardBySlug: publicQuery
    .input(z.object({ slug: z.string().min(1).max(255) }))
    .query(async ({ input }) => {
      const db = getDb();
      const card = await db.query.cards.findFirst({ where: eq(schema.cards.slug, input.slug) });
      if (!card) return null;
      const { url } = await storage.getPresignedUrl({ key: card.imageKey! });
      const holderCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.userCards)
        .where(eq(schema.userCards.cardId, card.id));
      return {
        ...card,
        imageUrl: card.imageKey ? url : null,
        holderCount: Number(holderCount[0]?.count ?? 0),
        remainingSupply: card.totalSupply - card.claimedSupply,
      };
    }),

  // --------------------------------------------------------------- card milestones
  claimableCardRewards: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const user = await db.query.users.findFirst({ where: eq(schema.users.id, ctx.user.id) });
    if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });

    const streak = await db.query.userStreaks.findFirst({ where: eq(schema.userStreaks.userId, user.id) });
    const longestStreak = streak?.longestStreak ?? streak?.currentStreak ?? 0;

    const [streakRewards, xpMilestones] = await Promise.all([
      getClaimableStreakCardRewards(user.id, longestStreak),
      getClaimableXpCardMilestones(user.id, user.xp ?? 0),
    ]);

    const allCards = [...streakRewards.map(r => r.card), ...xpMilestones.map(m => m.card)];
    const urls = await signKeys(allCards.map(c => c.imageKey).filter(Boolean) as string[]);

    return {
      streak: streakRewards.map((r) => ({
        type: "streak" as const,
        streakDays: r.streakDays,
        card: { ...r.card, imageUrl: r.card.imageKey ? (urls[r.card.imageKey] ?? null) : null },
      })),
      xp: xpMilestones.map((m) => ({
        type: "xp" as const,
        xpThreshold: m.xpThreshold,
        card: { ...m.card, imageUrl: m.card.imageKey ? (urls[m.card.imageKey] ?? null) : null },
      })),
    };
  }),

  claimStreakCardReward: authedQuery
    .input(z.object({ streakDays: z.number().int().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const reward = await db
        .select()
        .from(schema.streakCardRewards)
        .where(eq(schema.streakCardRewards.streakDays, input.streakDays))
        .limit(1);
      if (!reward.length) throw new TRPCError({ code: "NOT_FOUND", message: "No card reward for this streak milestone." });

      const record = reward[0];
      if (await hasMilestoneReward(ctx.user.id, "streak", record.id)) {
        throw new TRPCError({ code: "CONFLICT", message: "You have already claimed this reward." });
      }

      const card = await db.query.cards.findFirst({ where: eq(schema.cards.id, record.cardId) });
      if (!card || !card.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "Card not available." });

      const result = await grantCard({
        userId: ctx.user.id,
        cardId: record.cardId,
        source: `streak milestone (${input.streakDays} days)`,
      });
      if (result.wasSoldOut) throw new TRPCError({ code: "CONFLICT", message: "This card is sold out." });

      await recordMilestoneReward({
        userId: ctx.user.id,
        rewardType: "streak",
        rewardId: record.id,
        cardId: record.cardId,
      });
      return { card, granted: result.granted, remainingSupply: result.remainingSupply };
    }),

  claimXpCardReward: authedQuery
    .input(z.object({ xpThreshold: z.number().int().min(0) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const milestone = await db
        .select()
        .from(schema.xpCardMilestones)
        .where(eq(schema.xpCardMilestones.xpThreshold, input.xpThreshold))
        .limit(1);
      if (!milestone.length) throw new TRPCError({ code: "NOT_FOUND", message: "No card reward for this XP milestone." });

      const record = milestone[0];
      if (await hasMilestoneReward(ctx.user.id, "xp", record.id)) {
        throw new TRPCError({ code: "CONFLICT", message: "You have already claimed this reward." });
      }

      const card = await db.query.cards.findFirst({ where: eq(schema.cards.id, record.cardId) });
      if (!card || !card.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "Card not available." });

      const result = await grantCard({
        userId: ctx.user.id,
        cardId: record.cardId,
        source: `XP milestone (${input.xpThreshold} XP)`,
      });
      if (result.wasSoldOut) throw new TRPCError({ code: "CONFLICT", message: "This card is sold out." });

      await recordMilestoneReward({
        userId: ctx.user.id,
        rewardType: "xp",
        rewardId: record.id,
        cardId: record.cardId,
      });
      return { card, granted: result.granted, remainingSupply: result.remainingSupply };
    }),

  // --------------------------------------------------------------- public fan profile
  getFanProfile: publicQuery
    .input(z.object({ username: z.string().min(1).max(255) }))
    .query(async ({ input }) => {
      const db = getDb();
      const settings = await getOrgSettings();
      const enabledRoles = getXpEnabledRoles(settings);

      const [user] = await db
        .select({
          id: schema.users.id,
          username: schema.users.username,
          name: schema.users.name,
          bio: schema.users.bio,
          instagram: schema.users.instagram,
          avatar: schema.users.avatar,
          role: schema.users.role,
          createdAt: schema.users.createdAt,
          xp: schema.users.xp,
          featuredCardIds: schema.users.featuredCardIds,
          hiddenCardIds: schema.users.hiddenCardIds,
        })
        .from(schema.users)
        .where(eq(schema.users.username, input.username))
        .limit(1);

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      let avatarUrl: string | null = null;
      if (user.avatar) {
        const { url } = await storage.getPresignedUrl({ key: user.avatar });
        avatarUrl = url;
      }

      // Get XP rank
      const [xpRank] = await db
        .select({ rank: sql<number>`count(*) + 1` })
        .from(schema.users)
        .where(
          and(
            eq(schema.users.banned, false),
            sql`${schema.users.xp} > ${user.xp}`,
          ),
        );

      // Get streak
      const streak = await db.query.userStreaks.findFirst({
        where: eq(schema.userStreaks.userId, user.id),
      });
      const currentStreak = streak?.currentStreak ?? 0;
      const longestStreak = streak?.longestStreak ?? 0;

      // Get weekly top fan status
      const weeklyTopFan = await db.query.weeklyTopFan.findFirst({
        where: eq(schema.weeklyTopFan.userId, user.id),
        orderBy: desc(schema.weeklyTopFan.weekStart),
      });

      // Get achievements
      const achievementRows = await db
        .select({
          id: schema.achievements.id,
          name: schema.achievements.name,
          description: schema.achievements.description,
          iconKey: schema.achievements.iconKey,
          badge: schema.achievements.badge,
          tag: schema.achievements.tag,
          category: schema.achievements.category,
          requirementType: schema.achievements.requirementType,
          requirementValue: schema.achievements.requirementValue,
          xpReward: schema.achievements.xpReward,
          isActive: schema.achievements.isActive,
          earnedAt: schema.userAchievements.earnedAt,
          progress: schema.userAchievements.progress,
          linkedCardId: schema.achievementCardRewards.cardId,
          cardName: schema.cards.name,
          cardImageKey: schema.cards.imageKey,
        })
        .from(schema.userAchievements)
        .innerJoin(schema.achievements, eq(schema.userAchievements.achievementId, schema.achievements.id))
        .leftJoin(schema.achievementCardRewards, eq(schema.achievementCardRewards.achievementId, schema.achievements.id))
        .leftJoin(schema.cards, eq(schema.cards.id, schema.achievementCardRewards.cardId))
        .where(eq(schema.userAchievements.userId, user.id))
        .orderBy(desc(schema.userAchievements.earnedAt));

      const achievementKeys = [...new Set([...achievementRows.map((r) => r.iconKey), ...achievementRows.map((r) => r.cardImageKey)].filter(Boolean) as string[])];
      const achievementUrls = achievementKeys.length ? await signKeys(achievementKeys) : {};

      const achievements = achievementRows.map((r) => ({
        ...r,
        iconUrl: r.iconKey ? (achievementUrls[r.iconKey] ?? null) : null,
        cardImageUrl: r.cardImageKey ? (achievementUrls[r.cardImageKey] ?? null) : null,
      }));

      // Get card collection
      const collectionRows = await db
        .select({
          id: schema.userCards.id,
          cardId: schema.userCards.cardId,
          quantity: schema.userCards.quantity,
          copyNumber: schema.userCards.copyNumber,
          acquiredAt: schema.userCards.acquiredAt,
          source: schema.userCards.source,
          card: schema.cards,
        })
        .from(schema.userCards)
        .innerJoin(schema.cards, eq(schema.userCards.cardId, schema.cards.id))
        .where(eq(schema.userCards.userId, user.id))
        .orderBy(desc(schema.cards.category), desc(schema.userCards.acquiredAt));

      const collectionCardKeys = [...new Set(collectionRows.map((r) => r.card.imageKey).filter(Boolean) as string[])];
      const collectionCardUrls = collectionCardKeys.length ? await signKeys(collectionCardKeys) : {};

      const collection = collectionRows.map((r) => ({
        ...r,
        card: {
          ...r.card,
          imageUrl: r.card.imageKey ? (collectionCardUrls[r.card.imageKey] ?? null) : null,
        },
      }));

      // Get all cards for completion stats
      const allCards = await db.select().from(schema.cards).where(eq(schema.cards.isActive, true));
      const allCardIds = allCards.map((c) => c.id);
      const ownedCardIds = new Set(collection.map((c) => c.cardId));
      const totalCards = allCardIds.length;
      const collectedCards = ownedCardIds.size;
      const completionPercent = totalCards > 0 ? Math.round((collectedCards / totalCards) * 100) : 0;

      // Parse featured/hidden card IDs
      const featuredIds = user.featuredCardIds ? user.featuredCardIds.split(",").map(Number).filter(Boolean) : [];
      const hiddenIds = user.hiddenCardIds ? user.hiddenCardIds.split(",").map(Number).filter(Boolean) : [];

      // Featured cards
      const featuredCards = collection.filter((c) => featuredIds.includes(c.cardId));

      // Hidden cards
      const hiddenCards = collection.filter((c) => hiddenIds.includes(c.cardId));

      // Visible cards (not hidden)
      const visibleCards = collection.filter((c) => !hiddenIds.includes(c.cardId));

      // Rarest card (lowest totalSupply among owned)
      const rarestCard = [...visibleCards].sort((a, b) => a.card.totalSupply - b.card.totalSupply)[0] ?? null;

      // Recent acquisitions (last 5)
      const recentAcquisitions = collection.slice(0, 5);

      // Category stats
      const categoryStats = Object.entries({
        common: { label: "Common", count: 0, total: 0 },
        rare: { label: "Rare", count: 0, total: 0 },
        epic: { label: "Epic", count: 0, total: 0 },
        legendary: { label: "Legendary", count: 0, total: 0 },
        event: { label: "Event", count: 0, total: 0 },
        exclusive: { label: "Exclusive", count: 0, total: 0 },
      }).map(([key, val]) => {
        const catTotal = allCards.filter((c) => c.category === key).length;
        const catOwned = visibleCards.filter((c) => c.card.category === key).length;
        return { key: key as typeof key, label: val.label, count: catOwned, total: catTotal };
      });

      return {
        user: {
          ...user,
          avatarUrl,
          xpVisible: enabledRoles.includes(user.role),
          xpRank: xpRank?.rank ?? null,
          currentStreak,
          longestStreak,
          weeklyTopFan: weeklyTopFan ?? null,
        },
        achievements,
        collection: {
          cards: visibleCards,
          featuredCards,
          hiddenCards,
          rarestCard,
          recentAcquisitions,
          totalCards,
          collectedCards,
          completionPercent,
          categoryStats,
        },
      };
    }),

  // User profile updates
  updateBio: authedQuery
    .input(z.object({ bio: z.string().max(500).nullable() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await db.update(schema.users).set({ bio: input.bio }).where(eq(schema.users.id, ctx.user.id));
      return { ok: true };
    }),

  updateInstagram: authedQuery
    .input(z.object({ instagram: z.string().max(512).nullable() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await db.update(schema.users).set({ instagram: input.instagram }).where(eq(schema.users.id, ctx.user.id));
      return { ok: true };
    }),

  updateFeaturedCards: authedQuery
    .input(z.object({ cardIds: z.array(z.number()) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const ids = input.cardIds.join(",");
      await db.update(schema.users).set({ featuredCardIds: ids || null }).where(eq(schema.users.id, ctx.user.id));
      return { ok: true };
    }),

  updateHiddenCards: authedQuery
    .input(z.object({ cardIds: z.array(z.number()) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const ids = input.cardIds.join(",");
      await db.update(schema.users).set({ hiddenCardIds: ids || null }).where(eq(schema.users.id, ctx.user.id));
      return { ok: true };
    }),

  // -----------------------------------------------------------------------
  // Notifications
  // -----------------------------------------------------------------------

  /** Unread notification count for the current user. */
  notificationUnreadCount: authedQuery.query(async ({ ctx }) => {
    const count = await countUnread(ctx.user.id);
    return { count };
  }),

  /** Notification history for the current user. */
  notificationHistory: authedQuery
    .input(z.object({ limit: z.number().int().min(1).max(100).optional() }))
    .query(async ({ input, ctx }) => {
      return listUserNotifications(ctx.user.id, input.limit ?? 50);
    }),

  /** Mark a single notification as read. */
  markNotificationRead: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const result = await markNotificationRead(input.id, ctx.user.id);
      if (!result) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Notification not found." });
      }
      return { ok: true };
    }),

  /** Mark all notifications as read. */
  markAllNotificationsRead: authedQuery.mutation(async ({ ctx }) => {
    const count = await markAllNotificationsRead(ctx.user.id);
    return { ok: true, count };
  }),

  /** Record a notification click (click-through tracking). */
  recordNotificationClick: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const result = await recordNotificationClick(input.id, ctx.user.id);
      if (!result) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Notification not found." });
      }
      return { ok: true };
    }),

   // --------------------------------------------------------------- fan rewards: user reedemptions
   myRedemptions: authedQuery.query(async ({ ctx }) => {
     const db = getDb();
     const list = await db
       .select({
         id: schema.rewardRedemptions.id,
         rewardId: schema.rewardRedemptions.rewardId,
         rewardName: schema.fanRewards.name,
         xpSpent: schema.rewardRedemptions.xpSpent,
         instagramUsername: schema.rewardRedemptions.instagramUsername,
         discordUsername: schema.rewardRedemptions.discordUsername,
         status: schema.rewardRedemptions.status,
         adminNotes: schema.rewardRedemptions.adminNotes,
         createdAt: schema.rewardRedemptions.createdAt,
         updatedAt: schema.rewardRedemptions.updatedAt,
       })
       .from(schema.rewardRedemptions)
       .innerJoin(schema.fanRewards, eq(schema.rewardRedemptions.rewardId, schema.fanRewards.id))
       .where(eq(schema.rewardRedemptions.userId, ctx.user.id))
       .orderBy(desc(schema.rewardRedemptions.createdAt))
       .limit(50);
     return list;
   }),
});
