import { describe, expect, it } from "vitest";
import {
  allRoles,
  hasAtLeastRole,
  hasRole,
  isRole,
  Roles,
  PERMISSIONS,
  ADMIN_ONLY_PERMISSIONS,
  BUILTIN_ROLE_PERMISSIONS,
  userHasPermission,
  isAdminOnlyPermission,
} from "@contracts/constants";
import type { Role } from "@contracts/constants";
import type { User } from "@db/schema";
import { createRouter, authedQuery, adminQuery, moderatorQuery } from "./middleware";
import type { TrpcContext } from "./context";

// ---------------------------------------------------------------------------
// Pure role helpers
// ---------------------------------------------------------------------------

describe("role helpers", () => {
  it("exposes exactly the four roles, lowest to highest", () => {
    expect(allRoles).toEqual(["fan", "player", "moderator", "admin"]);
  });

  it("isRole accepts only valid role values", () => {
    for (const role of allRoles) expect(isRole(role)).toBe(true);
    expect(isRole("user")).toBe(false);
    expect(isRole("superadmin")).toBe(false);
    expect(isRole(undefined)).toBe(false);
    expect(isRole(null)).toBe(false);
    expect(isRole(42)).toBe(false);
  });

  it("hasRole checks exact membership", () => {
    expect(hasRole("admin", "admin")).toBe(true);
    expect(hasRole("moderator", "admin")).toBe(false);
    expect(hasRole("fan", "player", "fan")).toBe(true);
    expect(hasRole(undefined, "admin")).toBe(false);
    expect(hasRole(null, "admin")).toBe(false);
  });

  it("hasAtLeastRole enforces the hierarchy", () => {
    expect(hasAtLeastRole("fan", "fan")).toBe(true);
    expect(hasAtLeastRole("player", "fan")).toBe(true);
    expect(hasAtLeastRole("moderator", "fan")).toBe(true);
    expect(hasAtLeastRole("admin", "admin")).toBe(true);
    expect(hasAtLeastRole("moderator", "admin")).toBe(false);
    expect(hasAtLeastRole("player", "moderator")).toBe(false);
    expect(hasAtLeastRole("fan", "player")).toBe(false);
  });

  it("legacy 'user' values are not granted staff privileges", () => {
    expect(hasAtLeastRole("user", "moderator")).toBe(false);
    expect(hasAtLeastRole("user", "fan")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Server-side middleware guards (no database required)
// ---------------------------------------------------------------------------

function makeUser(role: Role): User {
  return {
    id: 1,
    unionId: "union-1",
    name: "Test",
    email: null,
    avatar: null,
    bio: null,
    instagram: null,
    role,
    banned: false,
    provider: "local",
    providerId: "test-1",
    username: "testuser",
    passwordHash: "hash",
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignInAt: new Date(),
    xp: 0,
    usernameLower: "testuser",
    featuredCardIds: null,
    hiddenCardIds: null,
  };
}

function makeCtx(role: Role | null): TrpcContext {
  return {
    req: new Request("http://localhost/api/trpc/test"),
    resHeaders: new Headers(),
    user: role ? makeUser(role) : undefined,
  };
}

const guardRouter = createRouter({
  profile: authedQuery.query(({ ctx }) => ({ role: ctx.user.role })),
  moderate: moderatorQuery.mutation(({ ctx }) => ({ role: ctx.user.role })),
  manage: adminQuery.mutation(({ ctx }) => ({ role: ctx.user.role })),
});

async function call(proc: "profile" | "moderate" | "manage", role: Role | null) {
  const caller = guardRouter.createCaller(makeCtx(role));
  return caller[proc]();
}

describe("tRPC role guards (server-side)", () => {
  it("authedQuery rejects unauthenticated requests", async () => {
    await expect(call("profile", null)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("authedQuery accepts every role including fan", async () => {
    for (const role of allRoles) {
      await expect(call("profile", role)).resolves.toEqual({ role });
    }
  });

  it("moderatorQuery rejects fans and players, accepts moderator and admin", async () => {
    await expect(call("moderate", "fan")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(call("moderate", "player")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(call("moderate", "moderator")).resolves.toEqual({
      role: "moderator",
    });
    await expect(call("moderate", "admin")).resolves.toEqual({ role: "admin" });
  });

  it("adminQuery rejects non-admins including moderators", async () => {
    await expect(call("manage", "fan")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(call("manage", "player")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(call("manage", "moderator")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(call("manage", "admin")).resolves.toEqual({ role: "admin" });
  });

  it("Roles constant matches the DB schema values", () => {
    expect(Roles).toEqual({
      Fan: "fan",
      Player: "player",
      Moderator: "moderator",
      Admin: "admin",
    });
  });
});

// ---------------------------------------------------------------------------
// Permission model
// ---------------------------------------------------------------------------

describe("permissions", () => {
  it("permits a full registry of permission strings", () => {
    expect(Object.values(PERMISSIONS)).toContain("content:manage_teams");
    expect(Object.values(PERMISSIONS)).toContain("community:moderate_comments");
    expect(Object.values(PERMISSIONS)).toContain("roles:manage_roles");
    expect(Object.values(PERMISSIONS)).toContain("xp:adjust_user_xp");
  });

  it("admin-only permissions are a subset of all permissions", () => {
    const allPerms = new Set(Object.values(PERMISSIONS));
    for (const p of ADMIN_ONLY_PERMISSIONS) {
      expect(allPerms.has(p)).toBe(true);
    }
  });

  it("built-in roles have the expected permission sets", () => {
    expect(BUILTIN_ROLE_PERMISSIONS.fan).toEqual([]);
    expect(BUILTIN_ROLE_PERMISSIONS.player).toEqual([]);
    expect(BUILTIN_ROLE_PERMISSIONS.moderator).toEqual([
      "community:moderate_comments",
    ]);
    // Admin implicitly has ALL permissions
    expect(BUILTIN_ROLE_PERMISSIONS.admin.length).toBe(Object.keys(PERMISSIONS).length);
  });

  it("isAdminOnlyPermission correctly identifies admin-only perms", () => {
    expect(isAdminOnlyPermission("roles:manage_roles")).toBe(true);
    expect(isAdminOnlyPermission("org:manage_settings")).toBe(true);
    expect(isAdminOnlyPermission("content:manage_media")).toBe(true);
    expect(isAdminOnlyPermission("community:manage_users")).toBe(true);
    expect(isAdminOnlyPermission("xp:adjust_user_xp")).toBe(true);
    expect(isAdminOnlyPermission("community:moderate_comments")).toBe(false);
    expect(isAdminOnlyPermission("content:manage_teams")).toBe(false);
  });

  it("userHasPermission works for built-in roles", () => {
    expect(userHasPermission("fan", PERMISSIONS.CONTENT_MANAGE_TEAMS)).toBe(false);
    expect(userHasPermission("moderator", PERMISSIONS.COMMUNITY_MODERATE_COMMENTS)).toBe(true);
    expect(userHasPermission("moderator", PERMISSIONS.CONTENT_MANAGE_TEAMS)).toBe(false);
    expect(userHasPermission("admin", PERMISSIONS.CONTENT_MANAGE_TEAMS)).toBe(true);
    expect(userHasPermission("admin", PERMISSIONS.COMMUNITY_MANAGE_USERS)).toBe(true);
    expect(userHasPermission(null, PERMISSIONS.CONTENT_MANAGE_TEAMS)).toBe(false);
    expect(userHasPermission(undefined, PERMISSIONS.CONTENT_MANAGE_TEAMS)).toBe(false);
  });

  it("userHasPermission works for custom roles with passed-in permissions", () => {
    const customPerms = [PERMISSIONS.CONTENT_MANAGE_TEAMS, PERMISSIONS.CONTENT_MANAGE_MAPS];
    expect(userHasPermission("content-manager", PERMISSIONS.CONTENT_MANAGE_TEAMS, customPerms)).toBe(true);
    expect(userHasPermission("content-manager", PERMISSIONS.XP_ADJUST_USER_XP, customPerms)).toBe(false);
    expect(userHasPermission("content-manager", PERMISSIONS.ROLES_MANAGE_ROLES, customPerms)).toBe(false);
  });
});
