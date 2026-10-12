import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { User } from "@db/schema";
import { users, roles, rolePermissions } from "@db/schema";
import { getDb } from "./queries/connection";
import { eq } from "drizzle-orm";
import { verifySessionToken } from "./session";
import { isRole, type Permission } from "@contracts/constants";
import { BUILTIN_ROLE_PERMISSIONS } from "@contracts/constants";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: User & { permissions?: readonly Permission[] };
};

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  const ctx: TrpcContext = { req: opts.req, resHeaders: opts.resHeaders };
  try {
    const cookies = opts.req.headers.get("cookie") || "";
    const token = cookies.split(";").find((c) => c.trim().startsWith("tsg_sid="))?.split("=")[1];
    if (token) {
      const claim = await verifySessionToken(decodeURIComponent(token));
      if (claim) {
        const db = getDb();
        const user = await db.query.users.findFirst({
          where: eq(users.id, claim.userId),
        });
        if (user) {
          // Resolve permissions for the user's role
          const permissions = await resolveUserPermissions(db, user);
          ctx.user = { ...user, permissions };
        }
      }
    }
  } catch {
    // Authentication is optional here
  }
  return ctx;
}

/**
 * Resolve the full set of permissions for a user based on their role.
 * Built-in roles get fixed permissions from BUILTIN_ROLE_PERMISSIONS.
 * Custom roles look up their permissions from the roles/role_permissions tables.
 */
async function resolveUserPermissions(
  db: ReturnType<typeof getDb>,
  user: User,
): Promise<readonly Permission[]> {
  const role = user.role;

  // Built-in roles: return fixed permission set
  if (isRole(role)) {
    return BUILTIN_ROLE_PERMISSIONS[role];
  }

  // Custom role: look up from DB
  const roleRow = await db.query.roles.findFirst({
    where: eq(roles.slug, role),
  });
  if (!roleRow || !roleRow.isActive) {
    // Unknown or inactive role → no permissions
    return [];
  }

  const permRows = await db
    .select({ permission: rolePermissions.permission })
    .from(rolePermissions)
    .where(eq(rolePermissions.roleId, roleRow.id));

  return permRows.map((r) => r.permission as Permission);
}
