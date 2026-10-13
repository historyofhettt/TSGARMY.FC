import { describe, expect, it } from "vitest";
import { appRouter } from "./router";
import type { TrpcContext } from "./context";
import type { Role } from "@contracts/constants";
import type { User } from "@db/schema";

function makeUser(role: Role): User {
  return {
    id: 999,
    unionId: "union-999",
    name: "Test Admin",
    email: null,
    avatar: null,
    bio: null,
    instagram: null,
    role,
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
  };
}

function adminCtx(): TrpcContext {
  return {
    req: new Request("http://localhost/api/trpc/admin.listTeams"),
    resHeaders: new Headers(),
    user: makeUser("admin"),
  };
}

describe("tournament team-selection flow (live DB)", () => {
  let createdTournamentId: number | undefined;

  it("listTeams returns available teams for the dropdown", async () => {
    const teams = await appRouter.createCaller(adminCtx()).admin.listTeams();
    expect(Array.isArray(teams)).toBe(true);
    expect(teams.length).toBeGreaterThan(0);
    for (const t of teams) {
      expect(t).toHaveProperty("id");
      expect(t).toHaveProperty("name");
      expect(t).toHaveProperty("slug");
    }
  });

  it("unauthenticated context cannot access listTeams (admin only)", async () => {
    const unauthCtx: TrpcContext = {
      req: new Request("http://localhost/api/trpc/admin.listTeams"),
      resHeaders: new Headers(),
    };
    await expect(appRouter.createCaller(unauthCtx).admin.listTeams()).rejects.toThrow();
  });

  it("upsertTournament creates a tournament with a valid teamId", async () => {
    const teams = await appRouter.createCaller(adminCtx()).admin.listTeams();
    const firstTeam = teams[0];
    expect(firstTeam).toBeDefined();

    const created = await appRouter.createCaller(adminCtx()).admin.upsertTournament({
      teamId: firstTeam.id,
      name: `Test Tournament ${Date.now()}`,
      description: "Automated test tournament",
      startDate: new Date(),
      startTime: "7:00 PM IST",
      status: "upcoming",
      numberOfMatches: 6,
      logoKey: null,
    });
    expect(created.id).toBeGreaterThan(0);
    expect(created.slug).toBeTruthy();
    createdTournamentId = created.id;
  });

  it("created tournament has correct teamId persisted", async () => {
    expect(createdTournamentId).toBeDefined();
    const teams = await appRouter.createCaller(adminCtx()).admin.listTeams();
    const firstTeam = teams[0];

    const tournament = await appRouter.createCaller(adminCtx()).admin.getTournamentAdmin({
      id: createdTournamentId!,
    });
    expect(tournament).toBeDefined();
    expect(tournament.id).toBe(createdTournamentId);
    expect(tournament.teamId).toBe(firstTeam.id);
    expect(tournament.name).toContain("Test Tournament");
  });

  it("upsertTournament rejects invalid teamId (0)", async () => {
    await expect(
      appRouter.createCaller(adminCtx()).admin.upsertTournament({
        teamId: 0,
        name: `Invalid Team Test ${Date.now()}`,
      }),
    ).rejects.toThrow();
  });

  it("upsertTournament rejects missing name", async () => {
    const teams = await appRouter.createCaller(adminCtx()).admin.listTeams();
    await expect(
      appRouter.createCaller(adminCtx()).admin.upsertTournament({
        teamId: teams[0].id,
        name: "",
      }),
    ).rejects.toThrow();
  });

  it("upsertTournament updates an existing tournament's teamId", async () => {
    expect(createdTournamentId).toBeDefined();
    const teams = await appRouter.createCaller(adminCtx()).admin.listTeams();
    if (teams.length > 1) {
      const secondTeam = teams[1];
      await appRouter.createCaller(adminCtx()).admin.upsertTournament({
        id: createdTournamentId!,
        teamId: secondTeam.id,
        name: `Updated Tournament ${Date.now()}`,
      });

      const updated = await appRouter.createCaller(adminCtx()).admin.getTournamentAdmin({
        id: createdTournamentId!,
      });
      expect(updated.teamId).toBe(secondTeam.id);
    }
  });

  it("cleanup: delete the test tournament", async () => {
    expect(createdTournamentId).toBeDefined();
    const result = await appRouter.createCaller(adminCtx()).admin.deleteTournament({
      id: createdTournamentId!,
    });
    expect(result.ok).toBe(true);
    await expect(
      appRouter.createCaller(adminCtx()).admin.getTournamentAdmin({
        id: createdTournamentId!,
      }),
    ).rejects.toThrow();
  });
});
