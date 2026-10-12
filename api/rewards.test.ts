import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { appRouter } from "./router";
import type { TrpcContext } from "./context";
import { getDb } from "./queries/connection";
import { fanRewards, rewardRedemptions, users } from "../db/schema";
import { eq } from "drizzle-orm";
import type { Role } from "@contracts/constants";

const unauthCtx: TrpcContext = {
  req: new Request("http://localhost/api/trpc/public.activeRewards"),
  resHeaders: new Headers(),
};

function makeUserCtx(userId: number, role: Role = "fan"): TrpcContext {
  return {
    req: new Request("http://localhost/api/trpc/user.redeemReward"),
    resHeaders: new Headers(),
    user: {
      id: userId,
      unionId: `union-${userId}`,
      name: "Test User",
      email: null,
      avatar: null,
      bio: null,
      instagram: null,
      role,
      banned: false,
      provider: "local" as const,
      providerId: `provider-${userId}`,
      username: "testuser",
      passwordHash: "hash",
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignInAt: new Date(),
      xp: 5000,
      usernameLower: "testuser",
      featuredCardIds: null,
      hiddenCardIds: null,
    },
  };
}

function makeAdminCtx(): TrpcContext {
  return {
    req: new Request("http://localhost/api/trpc/admin.listFanRewards"),
    resHeaders: new Headers(),
    user: {
      id: 999,
      unionId: "union-999",
      name: "Test Admin",
      email: null,
      avatar: null,
      bio: null,
      instagram: null,
      role: "admin",
      banned: false,
      provider: "local" as const,
      providerId: "test-999",
      username: "testadmin",
      passwordHash: "hash",
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignInAt: new Date(),
      xp: 0,
      usernameLower: "testadmin",
      featuredCardIds: null,
      hiddenCardIds: null,
    },
  };
}

const TEST_REWARD = {
  name: "Test Reward",
  category: "Merchandise",
  description: "A test reward for testing",
  photoKey: null,
  xpCost: 100,
  stock: 10,
  isActive: true,
  eligibilityJson: null,
  details: "Limit 1 per user",
};

describe("public.activeRewards", () => {
  it("returns active rewards", async () => {
    const caller = appRouter.createCaller(unauthCtx).public;
    const rewards = await caller.activeRewards({ category: "Merchandise" });
    expect(Array.isArray(rewards)).toBe(true);
    for (const r of rewards) {
      expect(r).toHaveProperty("id");
      expect(r).toHaveProperty("name");
      expect(r).toHaveProperty("category");
      expect(r).toHaveProperty("xpCost");
      expect(r).toHaveProperty("availableStock");
      expect(r).toHaveProperty("isActive");
      expect(r.isActive).toBe(true);
    }
  });
});

describe("admin.listFanRewards", () => {
  it("requires admin role", async () => {
    const fanCtx = makeUserCtx(123, "fan");
    const caller = appRouter.createCaller(fanCtx).admin;
    await expect(caller.listFanRewards()).rejects.toThrow();
  });
});

describe("admin.upsertFanReward", () => {
  let rewardId: number;

  beforeEach(async () => {
    const db = getDb();
    const result = await db
      .insert(fanRewards)
      .values(TEST_REWARD)
      .$returningId();
    rewardId = (result as Array<{ id: number }>)[0]?.id ?? 0;
  });

  afterEach(async () => {
    const db = getDb();
    await db.delete(rewardRedemptions).where(eq(rewardRedemptions.rewardId, rewardId));
    await db.delete(fanRewards).where(eq(fanRewards.id, rewardId));
  });

  it("creates a new reward", async () => {
    const caller = appRouter.createCaller(makeAdminCtx()).admin;
    const result = await caller.upsertFanReward({
      name: "New Test Reward",
      category: "Digital",
      description: "A new test",
      xpCost: 500,
      stock: 5,
      isActive: true,
      photoKey: null,
      eligibilityJson: null,
      details: null,
    });
    expect(result).toHaveProperty("id");
    expect(result.id).toBeGreaterThan(0);

    // Cleanup
    const db = getDb();
    await db.delete(fanRewards).where(eq(fanRewards.id, result.id));
  });

  it("updates an existing reward", async () => {
    const caller = appRouter.createCaller(makeAdminCtx()).admin;
    const result = await caller.upsertFanReward({
      id: rewardId,
      name: "Updated Reward Name",
      category: "Gaming",
      xpCost: 200,
      stock: 5,
      isActive: true,
    });
    expect(result.id).toBe(rewardId);

    // Verify
    const db = getDb();
    const updated = await db.query.fanRewards.findFirst({ where: eq(fanRewards.id, rewardId) });
    expect(updated?.name).toBe("Updated Reward Name");
    expect(updated?.xpCost).toBe(200);
  });
});

describe("admin.updateRedemptionStatus", () => {
  let rewardId: number;
  let redemptionId: number;
  let testUserId: number;

  beforeEach(async () => {
    const db = getDb();

    // Create user with high XP
    const userResult = await db
      .insert(users)
      .values({
         name: "Redemption Test User",
        username: "redemptest",
        email: null,
        role: "fan",
        xp: 1000,
        provider: "local",
        emailVerified: false,
      })
      .$returningId();
    testUserId = (userResult as Array<{ id: number }>)[0]?.id ?? 0;

    // Create reward
    const rewardResult = await db
      .insert(fanRewards)
      .values({ ...TEST_REWARD, xpCost: 100 })
      .$returningId();
    rewardId = (rewardResult as Array<{ id: number }>)[0]?.id ?? 0;

    // Create redemption
    const redemptionResult = await db
      .insert(rewardRedemptions)
      .values({
        rewardId,
        userId: testUserId,
        instagramUsername: "testig",
        discordUsername: "testdiscord",
        xpSpent: 100,
        status: "pending",
      })
      .$returningId();
    redemptionId = (redemptionResult as Array<{ id: number }>)[0]?.id ?? 0;
  });

  afterEach(async () => {
    const db = getDb();
    await db.delete(rewardRedemptions).where(eq(rewardRedemptions.id, redemptionId));
    await db.delete(fanRewards).where(eq(fanRewards.id, rewardId));
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
  });

  it("rejects a pending redemption and refunds XP", async () => {
    const db = getDb();
    const caller = appRouter.createCaller(makeAdminCtx()).admin;

    await caller.updateRedemptionStatus({
      id: redemptionId,
      status: "rejected",
      adminNotes: "Testing rejection",
    });

    // Check redemption status
    const redemption = await db.query.rewardRedemptions.findFirst({ where: eq(rewardRedemptions.id, redemptionId) });
    expect(redemption?.status).toBe("rejected");
    expect(redemption?.adminNotes).toBe("Testing rejection");

    // Check XP was refunded
    const user = await db.query.users.findFirst({ where: eq(users.id, testUserId) });
    expect((user?.xp ?? 0)).toBe(1100);

    // Check claimedCount was decremented
    const reward = await db.query.fanRewards.findFirst({ where: eq(fanRewards.id, rewardId) });
    expect(reward?.claimedCount).toBe(-1);
  });
});

describe("public.redeemReward", () => {
  let rewardId: number;
  let testUserId: number;

  beforeEach(async () => {
    const db = getDb();

    // Create user
    const userResult = await db
      .insert(users)
      .values({
         name: "Redeem Test User",
        username: "redeemtest",
        email: null,
        role: "fan",
        xp: 5000,
        provider: "local",
        emailVerified: false,
      })
      .$returningId();
    testUserId = (userResult as Array<{ id: number }>)[0]?.id ?? 0;

    // Create reward
    const rewardResult = await db
      .insert(fanRewards)
      .values({ ...TEST_REWARD, xpCost: 100, stock: 10 })
      .$returningId();
    rewardId = (rewardResult as Array<{ id: number }>)[0]?.id ?? 0;
  });

  afterEach(async () => {
    const db = getDb();
    await db
      .delete(rewardRedemptions)
      .where(eq(rewardRedemptions.userId, testUserId));
    await db.delete(fanRewards).where(eq(fanRewards.id, rewardId));
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
  });

  it("redeems a reward successfully and deducts XP", async () => {
    const caller = appRouter.createCaller(makeUserCtx(testUserId, "fan")).public;
    const result = await caller.redeemReward({
      rewardId,
      instagramUsername: "testig",
    });
    expect(result.ok).toBe(true);
    expect(result.remainingXp).toBe(4900);

    // Verify DB state
    const db = getDb();
    const user = await db.query.users.findFirst({ where: eq(users.id, testUserId) });
    expect(user?.xp).toBe(4900);

    const reward = await db.query.fanRewards.findFirst({ where: eq(fanRewards.id, rewardId) });
    expect(reward?.claimedCount).toBe(1);

    const redemptions = await db
      .select()
      .from(rewardRedemptions)
      .where(eq(rewardRedemptions.userId, testUserId));
    expect(redemptions.length).toBe(1);
    expect(redemptions[0].status).toBe("pending");
    expect(redemptions[0].instagramUsername).toBe("testig");
  });

  it("rejects when XP is insufficient", async () => {
    const caller = appRouter.createCaller(makeUserCtx(testUserId, "fan")).public;
    // Temporarily set user XP to 0
    const db = getDb();
    await db.update(users).set({ xp: 0 }).where(eq(users.id, testUserId));

    await expect(
      caller.redeemReward({ rewardId, discordUsername: "testdisc" }),
    ).rejects.toThrow(/Insufficient XP/);

    // Verify XP was not changed
    const user = await db.query.users.findFirst({ where: eq(users.id, testUserId) });
    expect(user?.xp).toBe(0);
  });

  it("rejects when contact info is missing", async () => {
    const caller = appRouter.createCaller(makeUserCtx(testUserId, "fan")).public;
    await expect(
      caller.redeemReward({ rewardId }),
    ).rejects.toThrow(/at least an Instagram or Discord username/);
  });

  it("rejects when out of stock", async () => {
    const db = getDb();
    await db.update(fanRewards).set({ stock: 1, claimedCount: 1 }).where(eq(fanRewards.id, rewardId));

    const caller = appRouter.createCaller(makeUserCtx(testUserId, "fan")).public;
    await expect(
      caller.redeemReward({ rewardId, instagramUsername: "testig" }),
    ).rejects.toThrow(/out of stock/);
  });

  it("rejects when reward is inactive", async () => {
    const db = getDb();
    await db.update(fanRewards).set({ isActive: false }).where(eq(fanRewards.id, rewardId));

    const caller = appRouter.createCaller(makeUserCtx(testUserId, "fan")).public;
    await expect(
      caller.redeemReward({ rewardId, instagramUsername: "testig" }),
    ).rejects.toThrow(/no longer available/);
  });

  it("rejects duplicate pending redemptions", async () => {
    const caller = appRouter.createCaller(makeUserCtx(testUserId, "fan")).public;
    await caller.redeemReward({ rewardId, instagramUsername: "testig" });

    // Reset XP for second attempt
    const db = getDb();
    await db.update(users).set({ xp: 5000 }).where(eq(users.id, testUserId));

    await expect(
      caller.redeemReward({ rewardId, discordUsername: "testdisc" }),
    ).rejects.toThrow(/pending redemption/);
  });

  it("requires authentication", async () => {
    const caller = appRouter.createCaller(unauthCtx).public;
    await expect(
      caller.redeemReward({ rewardId, instagramUsername: "testig" }),
    ).rejects.toThrow();
  });
});
