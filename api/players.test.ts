import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { appRouter } from "./router";
import type { TrpcContext } from "./context";
import { getDb } from "./queries/connection";
import { players, teams, teamStaff } from "../db/schema";
import { eq } from "drizzle-orm";

function adminCtx(): TrpcContext {
  return {
    req: new Request("http://localhost/api/trpc/admin.deletePlayer"),
    resHeaders: new Headers(),
    user: {
      id: 999, unionId: "union-999", name: "Test Admin", email: null, avatar: null,
      bio: null, instagram: null, role: "admin" as const, banned: false, provider: "local" as const,
      providerId: "test-999", username: "testadmin", passwordHash: "hash",
      emailVerified: false, createdAt: new Date(), updatedAt: new Date(),
      lastSignInAt: new Date(), xp: 0, usernameLower: "testadmin",
      featuredCardIds: null, hiddenCardIds: null,
    },
  };
}

function nonAdminCtx(): TrpcContext {
  return {
    req: new Request("http://localhost/api/trpc/admin.deletePlayer"),
    resHeaders: new Headers(),
    user: {
      id: 888, unionId: "union-888", name: "Regular User", email: null, avatar: null,
      bio: null, instagram: null, role: "fan" as const, banned: false, provider: "local" as const,
      providerId: "test-888", username: "testuser", passwordHash: "hash",
      emailVerified: false, createdAt: new Date(), updatedAt: new Date(),
      lastSignInAt: new Date(), xp: 0, usernameLower: "testuser",
      featuredCardIds: null, hiddenCardIds: null,
    },
  };
}

describe("admin.deletePlayer — targets single record only", () => {
  const ts = Date.now();
  let testPlayerId: number;
  let otherPlayerId: number;
  let testTeamId: number;

  beforeEach(async () => {
    const db = getDb();
    const [team] = await db
      .insert(teams)
      .values({
        name: `TestTeam_${ts}`,
        slug: `testteam_${ts}`,
        category: "Esports Team",
        accent: "blue",
        displayOrder: 999,
      })
      .$returningId();
    testTeamId = team.id;

    const [p1] = await db
      .insert(players)
      .values({
        teamId: testTeamId,
        ign: `TestPlayer_Delete_${ts}`,
        slug: `testplayer_delete_${ts}_${Math.random().toString(36).slice(2, 7)}`,
        role: "Carry",
        status: "active",
        displayOrder: 0,
      })
      .$returningId();
    testPlayerId = p1.id;

    const [p2] = await db
      .insert(players)
      .values({
        teamId: testTeamId,
        ign: `TestPlayer_Keep_${ts}`,
        slug: `testplayer_keep_${ts}_${Math.random().toString(36).slice(2, 7)}`,
        role: "Support",
        status: "active",
        displayOrder: 1,
      })
      .$returningId();
    otherPlayerId = p2.id;
  });

  afterEach(async () => {
    const db = getDb();
    if (testPlayerId) {
      await db.delete(players).where(eq(players.id, testPlayerId));
    }
    if (otherPlayerId) {
      await db.delete(players).where(eq(players.id, otherPlayerId));
    }
    if (testTeamId) {
      await db.delete(teams).where(eq(teams.id, testTeamId));
    }
  });

  it("soft-deletes only the targeted player (status=former, teamId=null), not all players", async () => {
    const caller = appRouter.createCaller(adminCtx()).admin;

    await caller.deletePlayer({ id: testPlayerId });

    const db = getDb();
    const deleted = await db.select().from(players).where(eq(players.id, testPlayerId));
    const kept = await db.select().from(players).where(eq(players.id, otherPlayerId));

    // The targeted player should be "former" with null teamId and userId
    expect(deleted.at(0)?.status).toBe("former");
    expect(deleted.at(0)?.teamId).toBe(null);
    expect(deleted.at(0)?.userId).toBe(null);

    // The other player must remain unchanged — still "active" and still on the team
    expect(kept.at(0)?.status).toBe("active");
    expect(kept.at(0)?.teamId).toBe(testTeamId);
    expect(kept.at(0)?.ign).toContain("TestPlayer_Keep");
  });

  it("returns NOT_FOUND when deleting a non-existent ID", async () => {
    const caller = appRouter.createCaller(adminCtx()).admin;

    await expect(caller.deletePlayer({ id: 999999 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("does not affect any players when a non-existent ID is used", async () => {
    const caller = appRouter.createCaller(adminCtx()).admin;

    await expect(caller.deletePlayer({ id: 999999 })).rejects.toThrow();

    const db = getDb();
    const target = await db.select().from(players).where(eq(players.id, testPlayerId));
    const other = await db.select().from(players).where(eq(players.id, otherPlayerId));

    expect(target.at(0)?.status).toBe("active");
    expect(target.at(0)?.teamId).toBe(testTeamId);
    expect(other.at(0)?.status).toBe("active");
    expect(other.at(0)?.teamId).toBe(testTeamId);
  });
});

describe("admin.deletePlayer — unauthorized access is rejected", () => {
  it("rejects a non-admin user with FORBIDDEN", async () => {
    const caller = appRouter.createCaller(nonAdminCtx()).admin;
    await expect(caller.deletePlayer({ id: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects an unauthenticated context (no user)", async () => {
    const caller = appRouter.createCaller({
      req: new Request("http://localhost/api/trpc/admin.deletePlayer"),
      resHeaders: new Headers(),
    }).admin;
    await expect(caller.deletePlayer({ id: 1 })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

describe("admin.upsertPlayer — IGN handling for active and former players", () => {
  const ts = Date.now();
  let testTeamId: number;
  let novaPlayerId: number;
  let secondPlayerId: number | undefined;
  let thirdPlayerId: number | undefined;

  beforeEach(async () => {
    const db = getDb();
    const [team] = await db
      .insert(teams)
      .values({
        name: `TestTeam_Nova_${ts}`,
        slug: `testteam_nova_${ts}`,
        category: "Esports Team",
        accent: "blue",
        displayOrder: 999,
      })
      .$returningId();
    testTeamId = team.id;

    const [novaPlayer] = await db
      .insert(players)
      .values({
        teamId: testTeamId,
        ign: `TSG NOVA ${ts}`,
        slug: `tsg-nova-${ts}-${Math.random().toString(36).slice(2, 7)}`,
        role: "Carry",
        status: "active",
        displayOrder: 0,
      })
      .$returningId();
    novaPlayerId = novaPlayer.id;
  });

  afterEach(async () => {
    const db = getDb();
    if (secondPlayerId) {
      await db.delete(players).where(eq(players.id, secondPlayerId));
    }
    if (thirdPlayerId) {
      await db.delete(players).where(eq(players.id, thirdPlayerId));
    }
    if (novaPlayerId) {
      await db.delete(players).where(eq(players.id, novaPlayerId));
    }
    if (testTeamId) {
      await db.delete(teams).where(eq(teams.id, testTeamId));
    }
  });

  it("allows creating a second active player with the same IGN as an existing active player", async () => {
    const caller = appRouter.createCaller(adminCtx()).admin;

    const res = await caller.upsertPlayer({
      teamId: testTeamId,
      ign: `TSG NOVA ${ts}`,
      status: "active",
      displayOrder: 0,
    });
    secondPlayerId = res.id;
    expect(res.id).toBeDefined();
    expect(res.id).not.toBe(novaPlayerId);
  });

  it("allows re-adding an IGN from a former (soft-deleted) player", async () => {
    const caller = appRouter.createCaller(adminCtx()).admin;

    const db = getDb();
    const formerId = novaPlayerId;
    await db
      .update(players)
      .set({ status: "former", teamId: null, userId: null })
      .where(eq(players.id, formerId));

    const res = await caller.upsertPlayer({
      teamId: testTeamId,
      ign: `TSG NOVA ${ts}`,
      status: "active",
      displayOrder: 0,
    });
    secondPlayerId = res.id;
    expect(res.id).toBeDefined();
    expect(res.id).not.toBe(formerId);

    const [oldPlayer] = await db.select().from(players).where(eq(players.id, formerId));
    expect(oldPlayer.status).toBe("former");
    expect(oldPlayer.id).toBe(formerId);

    const [newPlayer] = await db.select().from(players).where(eq(players.id, res.id));
    expect(newPlayer.ign).toBe(`TSG NOVA ${ts}`);
    expect(newPlayer.status).toBe("active");
    expect(newPlayer.id).not.toBe(formerId);
  });

  it("allows two former players to share the same IGN", async () => {
    const caller = appRouter.createCaller(adminCtx()).admin;

    const db = getDb();
    await db
      .update(players)
      .set({ status: "former", teamId: null, userId: null })
      .where(eq(players.id, novaPlayerId));

    const res = await caller.upsertPlayer({
      teamId: testTeamId,
      ign: `TSG NOVA ${ts}`,
      status: "active",
      displayOrder: 0,
    });
    secondPlayerId = res.id;
    expect(res.id).toBeDefined();

    await db
      .update(players)
      .set({ status: "former", teamId: null, userId: null })
      .where(eq(players.id, res.id));

    const res2 = await caller.upsertPlayer({
      teamId: testTeamId,
      ign: `TSG NOVA ${ts}`,
      status: "active",
      displayOrder: 0,
    });
    thirdPlayerId = res2.id;
    expect(res2.id).toBeDefined();
    expect(res2.id).not.toBe(res.id);
    expect(res2.id).not.toBe(novaPlayerId);
  });

  it("preserves the old (former) player record's identity and other fields", async () => {
    const caller = appRouter.createCaller(adminCtx()).admin;

    const db = getDb();
    const originalSlug = (await db.select({ slug: players.slug }).from(players).where(eq(players.id, novaPlayerId)))[0].slug;

    await db
      .update(players)
      .set({ status: "former", teamId: null, userId: null })
      .where(eq(players.id, novaPlayerId));

    const res = await caller.upsertPlayer({
      teamId: testTeamId,
      ign: `TSG NOVA ${ts}`,
      status: "active",
      displayOrder: 0,
    });
    secondPlayerId = res.id;

    const [former] = await db.select().from(players).where(eq(players.id, novaPlayerId));
    expect(former.status).toBe("former");
    expect(former.slug).toBe(originalSlug);
    expect(former.id).toBe(novaPlayerId);
    expect(res.id).not.toBe(novaPlayerId);
  });
});

describe("admin.upsertStaff — allows duplicate staff names", () => {
  const ts = Date.now();
  let testTeamId: number;
  let staffId: number | undefined;

  beforeEach(async () => {
    const db = getDb();
    const [team] = await db
      .insert(teams)
      .values({
        name: `TestTeam_Staff_${ts}`,
        slug: `testteam_staff_${ts}`,
        category: "Esports Team",
        accent: "blue",
        displayOrder: 999,
      })
      .$returningId();
    testTeamId = team.id;
  });

  afterEach(async () => {
    const db = getDb();
    if (staffId) {
      await db.delete(teamStaff).where(eq(teamStaff.id, staffId));
    }
    if (testTeamId) {
      await db.delete(teams).where(eq(teams.id, testTeamId));
    }
  });

  it("allows creating two staff members with the same name", async () => {
    const caller = appRouter.createCaller(adminCtx()).admin;

    const res1 = await caller.upsertStaff({
      teamId: testTeamId,
      name: "Same Name",
      role: "Coach",
      status: "active",
      displayOrder: 0,
    });
    staffId = res1.id;
    expect(res1.id).toBeDefined();

    const res2 = await caller.upsertStaff({
      teamId: testTeamId,
      name: "Same Name",
      role: "Analyst",
      status: "active",
      displayOrder: 1,
    });
    expect(res2.id).toBeDefined();
    expect(res2.id).not.toBe(res1.id);
  });
});
