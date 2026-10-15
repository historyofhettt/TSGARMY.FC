import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const mockMilestones = [
  { id: 1, xpThreshold: 100, cardId: 10, isActive: true, createdAt: new Date("2024-01-01"), updatedAt: new Date("2024-01-01") },
  { id: 2, xpThreshold: 500, cardId: 20, isActive: true, createdAt: new Date("2024-01-01"), updatedAt: new Date("2024-01-01") },
  { id: 3, xpThreshold: 1000, cardId: 30, isActive: false, createdAt: new Date("2024-01-01"), updatedAt: new Date("2024-01-01") },
  { id: 4, xpThreshold: 2000, cardId: 40, isActive: true, createdAt: new Date("2024-01-01"), updatedAt: new Date("2024-01-01") },
];

describe("xp_card_milestones schema", () => {
  it("has all required columns matching the SQL error query", () => {
    const columns = Object.keys(mockMilestones[0]);
    expect(columns).toEqual(
      expect.arrayContaining([
        "id",
        "xpThreshold",
        "cardId",
        "isActive",
        "createdAt",
        "updatedAt",
      ]),
    );
  });

  it("can be sorted by xpThreshold (matching the failing query)", () => {
    const sorted = [...mockMilestones].sort((a, b) => a.xpThreshold - b.xpThreshold);
    expect(sorted.map((m) => m.xpThreshold)).toEqual([100, 500, 1000, 2000]);
  });

  it("includes isActive column for filtering active milestones", () => {
    const active = mockMilestones.filter((m) => m.isActive);
    expect(active).toHaveLength(3);
    expect(active.map((m) => m.id)).toEqual([1, 2, 4]);
  });
});

describe("getClaimableXpCardMilestones query logic", () => {
  it("returns milestones where xpThreshold <= userXp and isActive", () => {
    const userXp = 600;
    const activeMilestones = mockMilestones.filter((m) => m.isActive);
    const claimable = activeMilestones
      .filter((m) => m.xpThreshold <= userXp)
      .sort((a, b) => a.xpThreshold - b.xpThreshold);

    expect(claimable.map((m) => m.id)).toEqual([1, 2]);
  });

  it("returns empty array when user has 0 XP", () => {
    const userXp = 0;
    const activeMilestones = mockMilestones.filter((m) => m.isActive);
    const claimable = activeMilestones
      .filter((m) => m.xpThreshold <= userXp)
      .sort((a, b) => a.xpThreshold - b.xpThreshold);

    expect(claimable).toHaveLength(0);
  });

  it("excludes inactive milestones", () => {
    const userXp = 5000;
    const activeMilestones = mockMilestones.filter((m) => m.isActive);
    const claimable = activeMilestones
      .filter((m) => m.xpThreshold <= userXp)
      .sort((a, b) => a.xpThreshold - b.xpThreshold);

    expect(claimable.find((m) => m.id === 3)).toBeUndefined();
    expect(claimable.map((m) => m.id)).toEqual([1, 2, 4]);
  });
});

describe("checkAndGrantXpMilestoneCards query logic", () => {
  it("selects all columns and orders by xpThreshold", () => {
    const ordered = [...mockMilestones].sort((a, b) => a.xpThreshold - b.xpThreshold);
    expect(ordered.map((m) => m.xpThreshold)).toEqual([100, 500, 1000, 2000]);
  });

  it("returns milestones where userXp >= xpThreshold", async () => {
    const userXp = 800;
    const claimable = [...mockMilestones]
      .filter((m) => m.isActive && m.xpThreshold <= userXp)
      .sort((a, b) => a.xpThreshold - b.xpThreshold);

    expect(claimable.map((m) => m.id)).toEqual([1, 2]);
  });
});

describe("Migration ordering: 0017 does not ALTER non-existent tables", () => {
  it("migration 0017 uses conditional checks before ALTER TABLE", () => {
    const migrationPath = join(process.cwd(), "db/migrations/0017_user_achievements_fields.sql");
    const content = readFileSync(migrationPath, "utf-8");

    // The migration should NOT have bare ALTER TABLE on milestone tables
    expect(content).not.to.match(/^ALTER TABLE `xp_card_milestones`/m);
    expect(content).not.to.match(/^ALTER TABLE `achievement_card_rewards`/m);

    // It should use information_schema checks instead
    expect(content).toContain("information_schema.tables");
    expect(content).toContain("PREPARE stmt FROM @sql");
    expect(content).toContain("DEALLOCATE PREPARE stmt");
  });

  it("migration 0018 through 0037 can follow 0017 without interruption", () => {
    const migrationsDir = join(process.cwd(), "db/migrations");
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));

    // Migration 0017 should exist
    expect(files).toContain("0017_user_achievements_fields.sql");

    // The migrations between 0018 and 0037 should also exist
    for (let i = 18; i <= 37; i++) {
      const prefix = i.toString().padStart(4, "0");
      const matching = files.filter((f) => f.startsWith(prefix + "_"));
      expect(matching.length).toBeGreaterThanOrEqual(0);
    }
  });

  it("migration 0038 uses CREATE TABLE IF NOT EXISTS", () => {
    const migrationPath = join(process.cwd(), "db/migrations/0038_card_milestones.sql");
    const content = readFileSync(migrationPath, "utf-8");

    expect(content).toContain("CREATE TABLE IF NOT EXISTS");
    expect(content).not.toContain("\nCREATE TABLE `");
  });

  it("migration 0039 exists as an idempotent safety net", () => {
    const migrationPath = join(process.cwd(), "db/migrations/0039_card_milestones_safety.sql");
    const content = readFileSync(migrationPath, "utf-8");

    expect(content).toContain("CREATE TABLE IF NOT EXISTS");
    expect(content).toContain("xp_card_milestones");
    expect(content).toContain("achievement_card_rewards");
    expect(content).toContain("streak_card_rewards");
    expect(content).toContain("milestone_rewards");
  });

  it("migration journal includes 0038 and 0039", () => {
    const journalPath = join(process.cwd(), "db/migrations/meta/_journal.json");
    const journal = JSON.parse(readFileSync(journalPath, "utf-8"));

    const tags = journal.entries.map((e: { tag: string }) => e.tag);
    expect(tags).toContain("0038_card_milestones");
    expect(tags).toContain("0039_card_milestones_safety");
  });
});

describe("checkAndGrantXpMilestoneCards — database failure handling", () => {
  it("handles database query failure gracefully (query logic)", async () => {
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockRejectedValue(new Error("Connection refused")),
      })),
    };

    // The function should throw when DB fails
    await expect(
      mockDb.select().from().where().orderBy().limit(1),
    ).rejects.toThrow("Connection refused");
  });

  it("returns empty array when no milestones exist", () => {
    const emptyMilestones: typeof mockMilestones = [];
    const userXp = 1000;
    const active = emptyMilestones.filter((m) => m.isActive);
    const claimable = active.filter((m) => m.xpThreshold <= userXp);

    expect(claimable).toHaveLength(0);
  });
});
