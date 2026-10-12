import { and, eq, desc, sql } from "drizzle-orm";
import * as schema from "@db/schema";
import { getDb } from "./connection";

export type CardCategory = "common" | "rare" | "epic" | "legendary" | "event" | "exclusive";

export type UnlockMethod = "daily_streak" | "xp_milestone" | "achievement" | "event" | "manual" | "exclusive";

/**
 * Grant a card to a user with full safety:
 * - Checks the card is active and not sold out
 * - Prevents exceeding supply
 * - Uses a transaction to avoid race conditions
 * - Returns { granted, remainingSupply, wasSoldOut }
 */
export async function grantCard(params: {
  userId: number;
  cardId: number;
  quantity?: number;
  source: string;
  note?: string;
  grantedById?: number;
}): Promise<{ granted: number; remainingSupply: number; wasSoldOut: boolean }> {
  const quantity = params.quantity ?? 1;
  const db = getDb();

  return db.transaction(async (tx) => {
    const card = await tx
      .select()
      .from(schema.cards)
      .where(eq(schema.cards.id, params.cardId))
      .for("update")
      .limit(1);

    if (!card.length) {
      throw new Error("Card not found");
    }
    const c = card[0];

    if (!c.isActive) {
      throw new Error("Card is not active");
    }

    const remaining = c.totalSupply - c.claimedSupply;
    if (remaining <= 0) {
      return { granted: 0, remainingSupply: 0, wasSoldOut: true };
    }

    const grantQty = Math.min(quantity, remaining);

    await tx
      .update(schema.cards)
      .set({
        claimedSupply: sql`${schema.cards.claimedSupply} + ${grantQty}`,
        updatedAt: new Date(),
      })
      .where(eq(schema.cards.id, params.cardId));

    const existingMax = await tx
      .select({ maxCopy: sql<number>`MAX(${schema.userCards.copyNumber})` })
      .from(schema.userCards)
      .where(
        and(eq(schema.userCards.userId, params.userId), eq(schema.userCards.cardId, params.cardId)),
      );

    const currentMax = existingMax[0]?.maxCopy ?? 0;

    for (let i = 0; i < grantQty; i++) {
      const copyNum = currentMax + i + 1;
      const existingRow = await tx
        .select()
        .from(schema.userCards)
        .where(
          and(
            eq(schema.userCards.userId, params.userId),
            eq(schema.userCards.cardId, params.cardId),
            eq(schema.userCards.copyNumber, copyNum),
          ),
        )
        .limit(1);

      if (existingRow.length) {
        await tx
          .update(schema.userCards)
          .set({ quantity: sql`${schema.userCards.quantity} + 1` })
          .where(
            and(
              eq(schema.userCards.userId, params.userId),
              eq(schema.userCards.cardId, params.cardId),
              eq(schema.userCards.copyNumber, copyNum),
            ),
          );
      } else {
        await tx.insert(schema.userCards).values({
          userId: params.userId,
          cardId: params.cardId,
          quantity: 1,
          copyNumber: copyNum,
          source: params.source,
        });
      }
    }

    await tx.insert(schema.cardGrants).values({
      userId: params.userId,
      cardId: params.cardId,
      quantity: grantQty,
      source: params.source,
      note: params.note ?? null,
      grantedById: params.grantedById ?? null,
    });

    const newRemaining = remaining - grantQty;
    return { granted: grantQty, remainingSupply: newRemaining, wasSoldOut: false };
  }) as Promise<{ granted: number; remainingSupply: number; wasSoldOut: boolean }>;
}

/**
 * Check whether a user already has a milestone reward claimed.
 * Used to prevent duplicate rewards.
 */
export async function hasMilestoneReward(
  userId: number,
  rewardType: "streak" | "xp" | "achievement",
  rewardId: number,
): Promise<boolean> {
  const db = getDb();
  const row = await db
    .select({ id: schema.milestoneRewards.id })
    .from(schema.milestoneRewards)
    .where(
      and(
        eq(schema.milestoneRewards.userId, userId),
        eq(schema.milestoneRewards.rewardType, rewardType),
        eq(schema.milestoneRewards.rewardId, rewardId),
      ),
    )
    .limit(1);
  return row.length > 0;
}

/**
 * Record a milestone reward as claimed (after card is granted).
 */
export async function recordMilestoneReward(params: {
  userId: number;
  rewardType: "streak" | "xp" | "achievement";
  rewardId: number;
  cardId: number;
}): Promise<void> {
  const db = getDb();
  await db.insert(schema.milestoneRewards).values({
    userId: params.userId,
    rewardType: params.rewardType,
    rewardId: params.rewardId,
    cardId: params.cardId,
  });
}

/**
 * Check streak card rewards that a user is eligible for based on current streak.
 * Returns rewards where streakDays <= currentLongestStreak and not yet claimed.
 */
export async function getClaimableStreakCardRewards(userId: number, longestStreak: number) {
  const db = getDb();
  const rewards = await db
    .select({
      id: schema.streakCardRewards.id,
      streakDays: schema.streakCardRewards.streakDays,
      cardId: schema.streakCardRewards.cardId,
      card: schema.cards,
    })
    .from(schema.streakCardRewards)
    .innerJoin(schema.cards, eq(schema.streakCardRewards.cardId, schema.cards.id))
    .where(and(eq(schema.cards.isActive, true), eq(schema.streakCardRewards.isActive, true)))
    .orderBy(schema.streakCardRewards.streakDays);

  const result: typeof rewards = [];
  for (const r of rewards) {
    if (r.streakDays > longestStreak) continue;
    const alreadyClaimed = await hasMilestoneReward(userId, "streak", r.id);
    if (alreadyClaimed) continue;
    result.push(r);
  }
  return result;
}

/**
 * Check XP card milestones that a user is eligible for based on current XP.
 * Returns milestones where xpThreshold <= userXp and not yet claimed.
 */
export async function getClaimableXpCardMilestones(userId: number, userXp: number) {
  const db = getDb();
  const milestones = await db
    .select({
      id: schema.xpCardMilestones.id,
      xpThreshold: schema.xpCardMilestones.xpThreshold,
      cardId: schema.xpCardMilestones.cardId,
      card: schema.cards,
    })
    .from(schema.xpCardMilestones)
    .innerJoin(schema.cards, eq(schema.xpCardMilestones.cardId, schema.cards.id))
    .where(and(eq(schema.cards.isActive, true), eq(schema.xpCardMilestones.isActive, true)))
    .orderBy(schema.xpCardMilestones.xpThreshold);

  const result: typeof milestones = [];
  for (const m of milestones) {
    if (m.xpThreshold > userXp) continue;
    const alreadyClaimed = await hasMilestoneReward(userId, "xp", m.id);
    if (alreadyClaimed) continue;
    result.push(m);
  }
  return result;
}

/**
 * Check achievement card rewards a user can claim.
 * Called after a user earns an achievement — checks if there's a card reward
 * and if it hasn't been claimed yet.
 */
export async function getClaimableAchievementCardReward(
  userId: number,
  achievementId: number,
): Promise<
  | {
      milestoneId: number;
      card: typeof schema.cards.$inferSelect;
    }
  | undefined
> {
  const db = getDb();
  const reward = await db
    .select({
      achievementId: schema.achievementCardRewards.achievementId,
      cardId: schema.achievementCardRewards.cardId,
      id: schema.achievementCardRewards.id,
      card: schema.cards,
    })
    .from(schema.achievementCardRewards)
    .innerJoin(schema.cards, eq(schema.achievementCardRewards.cardId, schema.cards.id))
    .where(eq(schema.achievementCardRewards.achievementId, achievementId))
    .limit(1);

  if (!reward.length || !reward[0].card.isActive) return undefined;

  const alreadyClaimed = await hasMilestoneReward(userId, "achievement", achievementId);
  if (alreadyClaimed) return undefined;

  return {
    milestoneId: achievementId,
    card: reward[0].card,
  };
}

/**
 * After XP is awarded, check all XP milestones the user is eligible for and grant cards.
 * Called after XP changes in streak claim, quiz, prediction, and XP tasks.
 * Returns list of card names granted.
 */
export async function checkAndGrantXpMilestoneCards(userId: number): Promise<string[]> {
  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (!user) return [];

  const userXp = user.xp ?? 0;
  const milestones = await db
    .select()
    .from(schema.xpCardMilestones)
    .orderBy(schema.xpCardMilestones.xpThreshold);

  const grantedNames: string[] = [];

  for (const milestone of milestones) {
    if (userXp < milestone.xpThreshold) continue;

    const alreadyClaimed = await hasMilestoneReward(userId, "xp", milestone.id);
    if (alreadyClaimed) continue;

    const card = await db.query.cards.findFirst({ where: eq(schema.cards.id, milestone.cardId) });
    if (!card || !card.isActive) continue;

    const result = await grantCard({
      userId,
      cardId: card.id,
      source: `XP milestone (${milestone.xpThreshold} XP)`,
    });
    if (result.wasSoldOut) continue;

    await recordMilestoneReward({
      userId,
      rewardType: "xp",
      rewardId: milestone.id,
      cardId: card.id,
    });
    grantedNames.push(card.name);
  }

  return grantedNames;
}

export async function getUserCardCollection(userId: number) {
  const db = getDb();
  const rows = await db
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
    .where(eq(schema.userCards.userId, userId))
    .orderBy(desc(schema.cards.category), desc(schema.userCards.acquiredAt));

  const { signKeys } = await import("../lib/images");
  const urls = await signKeys(rows.map((r) => r.card.imageKey).filter(Boolean) as string[]);

  return rows.map((r) => ({
    ...r,
    card: {
      ...r.card,
      imageUrl: r.card.imageKey ? (urls[r.card.imageKey] ?? null) : null,
    },
  }));
}
