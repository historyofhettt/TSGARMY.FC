import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { appRouter } from "./router";
import type { TrpcContext } from "./context";
import { getDb } from "./queries/connection";
import { players, teams } from "../db/schema";
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

    // The targeted player should be "former" with null teamId
    expect(deleted.at(0)?.status).toBe("former");
    expect(deleted.at(0)?.teamId).toBe(null);
    expect(deleted.at(0)?.userId).toBe(null);

    // The other player must remain unchanged — still "active" and still on the team
    expect(kept.at(0)?.status).toBe("active");
    expect(kept.at(0)?.teamId).toBe(testTeamId);
    expect(kept.at(0)?.ign).toContain("TestPlayer_Keep");
  });
});
