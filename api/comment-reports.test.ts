import { describe, expect, it } from "vitest";
import { appRouter } from "./router";
import type { TrpcContext } from "./context";
import type { Role } from "@contracts/constants";

const unauthCtx: TrpcContext = {
  req: new Request("http://localhost/api/trpc/commentReports.resolveReport"),
  resHeaders: new Headers(),
};

function makeUserCtx(userId: number, role: Role = "fan"): TrpcContext {
  return {
    req: new Request("http://localhost/api/trpc/commentReports.resolveReport"),
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

describe("commentReports.resolveReport access control", () => {
  it("rejects unauthenticated requests", async () => {
    const caller = appRouter.createCaller(unauthCtx).commentReports;
    await expect(
      caller.resolveReport({ id: 1, action: "resolve" }),
    ).rejects.toThrow();
  });

  it("rejects regular fans (requires moderator+)", async () => {
    const fanCtx = makeUserCtx(123, "fan");
    const caller = appRouter.createCaller(fanCtx).commentReports;
    await expect(
      caller.resolveReport({ id: 1, action: "resolve" }),
    ).rejects.toThrow();
  });

  it("allows moderators", async () => {
    const modCtx = makeUserCtx(456, "moderator");
    const caller = appRouter.createCaller(modCtx).commentReports;
    // This will likely fail on NOT_FOUND (report doesn't exist) but NOT on FORBIDDEN
    try {
      await caller.resolveReport({ id: 999999, action: "resolve" });
    } catch (e: unknown) {
      const err = e as { data?: { code?: string } };
      expect(err.data?.code).not.toBe("FORBIDDEN");
    }
  });

  it("allows admins", async () => {
    const adminCtx = makeUserCtx(999, "admin");
    const caller = appRouter.createCaller(adminCtx).commentReports;
    try {
      await caller.resolveReport({ id: 999999, action: "resolve" });
    } catch (e: unknown) {
      const err = e as { data?: { code?: string } };
      expect(err.data?.code).not.toBe("FORBIDDEN");
    }
  });
});

describe("public.search refTable validation", () => {
  it("rejects invalid refTable", async () => {
    const caller = appRouter.createCaller(unauthCtx).public;
    await expect(
      caller.listComments({ refTable: "evil_table", refId: 1 } as never),
    ).rejects.toThrow();
  });
});
