import { describe, expect, it } from "vitest";
import { appRouter } from "./router";
import type { TrpcContext } from "./context";

const unauthCtx: TrpcContext = {
  req: new Request("http://localhost/api/trpc/public.search"),
  resHeaders: new Headers(),
};

describe("public.search", () => {
  it("rejects empty query", async () => {
    const caller = appRouter.createCaller(unauthCtx).public;
    await expect(caller.search({ q: "" })).rejects.toThrow();
  });

  it("returns empty arrays for short unique query", async () => {
    const caller = appRouter.createCaller(unauthCtx).public;
    const result = await caller.search({ q: "zzz_nonexistent_xyz_12345" });
    expect(result).toHaveProperty("players");
    expect(result).toHaveProperty("teams");
    expect(result).toHaveProperty("tournaments");
    expect(result).toHaveProperty("albums");
    expect(result).toHaveProperty("spotlight");
    expect(Array.isArray(result.players)).toBe(true);
    expect(Array.isArray(result.teams)).toBe(true);
    expect(Array.isArray(result.tournaments)).toBe(true);
    expect(Array.isArray(result.albums)).toBe(true);
    expect(Array.isArray(result.spotlight)).toBe(true);
    expect(result.players).toHaveLength(0);
    expect(result.teams).toHaveLength(0);
    expect(result.tournaments).toHaveLength(0);
    expect(result.albums).toHaveLength(0);
    expect(result.spotlight).toHaveLength(0);
  });

  it("returns results with correct shape when matches exist", async () => {
    const caller = appRouter.createCaller(unauthCtx).public;
    const result = await caller.search({ q: "TSG" });
    if (result.players.length > 0) {
      const player = result.players[0];
      expect(player).toHaveProperty("id");
      expect(player).toHaveProperty("ign");
      expect(player).toHaveProperty("slug");
      expect(player).toHaveProperty("photoUrl");
      expect(player).toHaveProperty("team");
    }
    if (result.teams.length > 0) {
      const team = result.teams[0];
      expect(team).toHaveProperty("id");
      expect(team).toHaveProperty("name");
      expect(team).toHaveProperty("slug");
      expect(team).toHaveProperty("logoUrl");
    }
    if (result.tournaments.length > 0) {
      const t = result.tournaments[0];
      expect(t).toHaveProperty("id");
      expect(t).toHaveProperty("name");
      expect(t).toHaveProperty("slug");
      expect(t).toHaveProperty("logoUrl");
    }
    if (result.albums.length > 0) {
      const album = result.albums[0];
      expect(album).toHaveProperty("id");
      expect(album).toHaveProperty("title");
      expect(album).toHaveProperty("coverUrl");
    }
    if (result.spotlight.length > 0) {
      const s = result.spotlight[0];
      expect(s).toHaveProperty("id");
      expect(s).toHaveProperty("title");
      expect(s).toHaveProperty("thumbnailUrl");
    }
  });

  it("limits results per category", async () => {
    const caller = appRouter.createCaller(unauthCtx).public;
    const result = await caller.search({ q: "TSG" });
    expect(result.players.length).toBeLessThanOrEqual(10);
    expect(result.teams.length).toBeLessThanOrEqual(5);
    expect(result.tournaments.length).toBeLessThanOrEqual(10);
    expect(result.albums.length).toBeLessThanOrEqual(10);
    expect(result.spotlight.length).toBeLessThanOrEqual(10);
  });
});
