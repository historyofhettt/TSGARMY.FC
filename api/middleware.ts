import { ErrorMessages, hasAtLeastRole, hasRole, isRole, type Permission } from "@contracts/constants";
import type { Role } from "@contracts/constants";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const createRouter = t.router;
export const publicQuery = t.procedure;

const requireAuth = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: ErrorMessages.unauthenticated,
    });
  }

  return next({ ctx: { ...ctx, user: ctx.user } });
});

/**
 * Server-side role guard: passes only when the authenticated user's role is
 * exactly one of `allowed`. The check always runs on the server against the
 * role stored in the database — never against client-supplied input.
 */
export function requireRole(...allowed: Role[]) {
  return t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (!ctx.user || !hasRole(ctx.user.role, ...allowed)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: ErrorMessages.insufficientRole,
      });
    }

    return next({ ctx: { ...ctx, user: ctx.user } });
  });
}

/**
 * Server-side hierarchy guard: passes when the authenticated user's role is
 * `min` or higher (admin > moderator > player > fan).
 *
 * Works for both built-in roles and custom roles. Custom roles are treated
 * as below the built-in hierarchy unless they possess the admin-only
 * permission that the built-in role would grant.
 */
function requireMinRole(min: Role) {
  return t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: ErrorMessages.unauthenticated,
      });
    }

    // Built-in role hierarchy check
    if (isBuiltInRole(ctx.user.role)) {
      if (!hasAtLeastRole(ctx.user.role, min)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: ErrorMessages.insufficientRole,
        });
      }
    } else {
      // Custom role: only admin has access to admin/moderator areas
      if (min === "admin" || min === "moderator") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: ErrorMessages.insufficientRole,
        });
      }
    }

    return next({ ctx: { ...ctx, user: ctx.user } });
  });
}

/**
 * Server-side permission guard: passes when the authenticated user's role
 * has the specified permission. Works for both built-in and custom roles.
 */
export function requirePermission(...allowed: Permission[]) {
  return t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: ErrorMessages.unauthenticated,
      });
    }

    const userPerms = ctx.user.permissions ?? [];
    const has = allowed.some((p) => (userPerms as readonly string[]).includes(p));

    // Admin built-in role always passes
    if (ctx.user.role === "admin") {
      return next({ ctx: { ...ctx, user: ctx.user } });
    }

    if (!has) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: ErrorMessages.insufficientRole,
      });
    }

    return next({ ctx: { ...ctx, user: ctx.user } });
  });
}

function isBuiltInRole(role: string | null | undefined): boolean {
  return !!role && isRole(role);
}

export const authedQuery = t.procedure.use(requireAuth);
/** Administrators only. */
export const adminQuery = authedQuery.use(requireMinRole("admin"));
/** Moderators and administrators. */
export const moderatorQuery = authedQuery.use(requireMinRole("moderator"));
