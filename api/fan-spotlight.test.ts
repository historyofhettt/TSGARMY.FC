import { describe, expect, it } from "vitest";
import { appRouter } from "./router";
import type { TrpcContext } from "./context";
import { fanSpotlight } from "../db/schema";
import type { Role } from "@contracts/constants";
import type { User } from "../db/schema";

const unauthCtx: TrpcContext = {
  req: new Request("http://localhost/api/trpc/fanSpotlight.list"),
  resHeaders: new Headers(),
};

function makeUser(role: Role): User {
  return {
    id: 999, unionId: "union-999", name: "Test Admin", email: null, avatar: null,
    bio: null, instagram: null, role, banned: false, provider: "local" as const,
    providerId: "test-999", username: "testadmin", passwordHash: "hash",
    emailVerified: false, createdAt: new Date(), updatedAt: new Date(),
    lastSignInAt: new Date(), xp: 0, usernameLower: "testadmin",
    featuredCardIds: null, hiddenCardIds: null,
  };
}

function adminCtx(): TrpcContext {
  return {
    req: new Request("http://localhost/api/trpc/fanSpotlight.create"),
    resHeaders: new Headers(),
    user: makeUser("admin"),
  };
}

describe("fan spotlight procedures - structure", () => {
  it("exposes the fan spotlight procedures on the root router", () => {
    const fs = appRouter.createCaller(unauthCtx).fanSpotlight;
    expect(typeof fs.list).toBe("function");
    expect(typeof fs.featured).toBe("function");
    expect(typeof fs.listAll).toBe("function");
    expect(typeof fs.getById).toBe("function");
    expect(typeof fs.getPublic).toBe("function");
    expect(typeof fs.create).toBe("function");
    expect(typeof fs.update).toBe("function");
    expect(typeof fs.delete).toBe("function");
    expect(typeof fs.reorder).toBe("function");
    // No public submission endpoint — admin-only content management
    expect("submit" in fs).toBe(false);
  });

  it("fan_spotlight table exists in schema", () => {
    expect(fanSpotlight).toBeDefined();
  });

  it("list public query returns a paginated shape", async () => {
    const result = await appRouter.createCaller(unauthCtx).fanSpotlight.list({});
    expect(result).toHaveProperty("items");
    expect(Array.isArray(result.items)).toBe(true);
    expect(result).toHaveProperty("hasMore");
    expect(result).toHaveProperty("nextCursor");
  });
});

describe("fan spotlight admin workflow (live DB)", () => {
  const ctx = adminCtx();
  const caller = () => appRouter.createCaller(ctx).fanSpotlight;
  let createdId: number;

  it("admin can create a spotlight entry", async () => {
    const created = await caller().create({
      userId: 1,
      title: `Test Spotlight ${Date.now()}`,
      description: "A test fan spotlight entry for testing.",
      category: "edit_reel",
      contentUrl: "https://www.youtube.com/watch?v=dQw49dQ1ykE",
      isApproved: true,
      isFeatured: true,
    });
    expect(created.id).toBeGreaterThan(0);
    createdId = created.id;
  });

  it("created entry appears in listAll and list", async () => {
    const all = await caller().listAll();
    expect(all.some((e) => e.id === createdId)).toBe(true);

    const listResult = await appRouter.createCaller(unauthCtx).fanSpotlight.list({});
    expect(listResult.items.some((e) => e.id === createdId)).toBe(true);
  });

  it("admin can get entry by id", async () => {
    const entry = await caller().getById({ id: createdId });
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe(createdId);
    expect(entry!.title).toContain("Test Spotlight");
  });

  it("public can get entry by id", async () => {
    const entry = await appRouter.createCaller(unauthCtx).fanSpotlight.getPublic({ id: createdId });
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe(createdId);
    expect(entry!.title).toContain("Test Spotlight");
    expect(entry!.embedUrl).toContain("youtube.com/embed/");
  });

  it("admin can update entry", async () => {
    await caller().update({
      id: createdId,
      title: "Updated Test Spotlight",
      description: "Updated description.",
      isFeatured: false,
      adminNotes: "Reviewed by test.",
    });
    const entry = await caller().getById({ id: createdId });
    expect(entry!.title).toBe("Updated Test Spotlight");
    expect(entry!.description).toBe("Updated description.");
    expect(entry!.isFeatured).toBe(false);
    expect(entry!.adminNotes).toBe("Reviewed by test.");
  });

  it("admin can publish and unpublish entry", async () => {
    const entry = await caller().getById({ id: createdId });
    expect(entry!.isApproved).toBe(true);

    // Unpublish
    await caller().update({ id: createdId, isApproved: false });
    const unpublished = await caller().getById({ id: createdId });
    expect(unpublished!.isApproved).toBe(false);
    expect(unpublished!.status).toBe("pending");

    // Publish again
    await caller().update({ id: createdId, isApproved: true });
    const published = await caller().getById({ id: createdId });
    expect(published!.isApproved).toBe(true);
    expect(published!.status).toBe("approved");
  });

  it("unpublished entry does not appear in public list", async () => {
    await caller().update({ id: createdId, isApproved: false });
    const listResult = await appRouter.createCaller(unauthCtx).fanSpotlight.list({});
    expect(listResult.items.some((e) => e.id === createdId)).toBe(false);
    // Restore
    await caller().update({ id: createdId, isApproved: true });
  });

  it("admin can reorder entries", async () => {
    const all = await caller().listAll();
    if (all.length >= 2) {
      const ids = [all[1].id, all[0].id];
      await caller().reorder({ ids });
      const reordered = await caller().listAll();
      expect(reordered[0].id).toBe(ids[0]);
    }
  });

  it("admin can delete entry", async () => {
    await caller().delete({ id: createdId });
    const entry = await caller().getById({ id: createdId });
    expect(entry).toBeNull();
  });
});

describe("fan spotlight permissions and validation", () => {
  const ctx = adminCtx();
  const caller = () => appRouter.createCaller(ctx).fanSpotlight;

  it("unauthenticated context cannot access listAll (admin only)", async () => {
    await expect(
      appRouter.createCaller(unauthCtx).fanSpotlight.listAll()
    ).rejects.toThrow();
  });

  it("unauthenticated context cannot access create (admin only)", async () => {
    await expect(
      appRouter.createCaller(unauthCtx).fanSpotlight.create({
        userId: 1,
        title: "Should fail",
        contentUrl: "https://youtube.com",
      })
    ).rejects.toThrow();
  });

  it("unauthenticated context cannot access update (admin only)", async () => {
    await expect(
      appRouter.createCaller(unauthCtx).fanSpotlight.update({
        id: 1,
        title: "Should fail",
      })
    ).rejects.toThrow();
  });

  it("unauthenticated context cannot access delete (admin only)", async () => {
    await expect(
      appRouter.createCaller(unauthCtx).fanSpotlight.delete({ id: 1 })
    ).rejects.toThrow();
  });

  it("create rejects empty title", async () => {
    await expect(
      caller().create({
        userId: 1,
        title: "",
        contentUrl: "https://youtube.com",
      })
    ).rejects.toThrow();
  });

  it("create rejects non-existent user", async () => {
    await expect(
      caller().create({
        userId: 999999,
        title: "Non-existent user test",
        contentUrl: "https://youtube.com",
      })
    ).rejects.toThrow(/not found/i);
  });

  it("create rejects invalid content URL", async () => {
    await expect(
      caller().create({
        userId: 1,
        title: "Invalid URL test",
        contentUrl: "not-a-url",
      })
    ).rejects.toThrow(/invalid/i);
  });
});
