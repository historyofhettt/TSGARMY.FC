import * as cookie from "cookie";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "./lib/cookies";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { signSessionToken } from "./session";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, comparePassword } from "./lib/password";
import { findLocalUserByIdentifier, updatePassword, findUserByEmail, usernameExists } from "./queries/users";

function setSessionCookie(ctx: { req: Request; resHeaders: Headers }, token: string) {
  const opts = getSessionCookieOptions(ctx.req.headers);
  ctx.resHeaders.append(
    "set-cookie",
    cookie.serialize(Session.cookieName, token, {
      httpOnly: opts.httpOnly,
      path: opts.path,
      sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
      secure: opts.secure,
      maxAge: Session.maxAgeMs / 1000,
    }),
  );
}

export const authRouter = createRouter({
  me: authedQuery.query((opts) => opts.ctx.user),

  logout: authedQuery.mutation(async ({ ctx }) => {
    const opts = getSessionCookieOptions(ctx.req.headers);
    ctx.resHeaders.append(
      "set-cookie",
      cookie.serialize(Session.cookieName, "", {
        httpOnly: opts.httpOnly,
        path: opts.path,
        sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
        secure: opts.secure,
        maxAge: 0,
      }),
    );
    return { success: true };
  }),

  register: publicQuery
    .input(
      z.object({
        username: z.string().min(3).max(255),
        email: z.string().email(),
        password: z.string().min(6),
        confirmPassword: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (input.password !== input.confirmPassword) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Passwords do not match",
        });
      }

      const db = getDb();

      if (await usernameExists(input.username)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Username already exists",
        });
      }

      const existingEmail = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, input.email))
        .limit(1);
      if (existingEmail.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Email already registered",
        });
      }

      const passwordHash = await hashPassword(input.password);

      try {
        const [user] = await db
          .insert(schema.users)
          .values({
            username: input.username,
            email: input.email,
            passwordHash,
            provider: "local",
            emailVerified: false,
            role: "fan",
          })
          .$returningId();

        const [fullUser] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, user.id))
          .limit(1);

        const session = await signSessionToken({
          kind: "local",
          userId: fullUser.id,
        });

        setSessionCookie(ctx, session);

        return {
          success: true,
          user: {
            id: fullUser.id,
            username: fullUser.username,
            email: fullUser.email,
            role: fullUser.role,
            name: fullUser.name,
            avatar: fullUser.avatar,
          },
        };
      } catch (err: unknown) {
        if (err && typeof err === "object" && "code" in err && (err as { code: unknown }).code === "ER_DUP_ENTRY") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Username already exists",
          });
        }
        const msg = err instanceof Error ? err.message : String(err);
        if (/duplicate/i.test(msg)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Username already exists",
          });
        }
        throw err;
      }
    }),

  login: publicQuery
    .input(
      z.object({
        identifier: z.string().min(1),
        password: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const user = await findLocalUserByIdentifier(input.identifier);
      if (!user || !user.passwordHash) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid username or password",
        });
      }

      const valid = await comparePassword(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid username or password",
        });
      }

      await getDb()
        .update(schema.users)
        .set({ lastSignInAt: new Date() })
        .where(eq(schema.users.id, user.id));

      const session = await signSessionToken({
        kind: "local",
        userId: user.id,
      });

      setSessionCookie(ctx, session);

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          name: user.name,
          avatar: user.avatar,
        },
      };
    }),

  changePassword: authedQuery
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(6),
        confirmPassword: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (input.newPassword !== input.confirmPassword) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Passwords do not match",
        });
      }

      const user = await findUserByEmail(ctx.user.email ?? "");
      if (!user || !user.passwordHash) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Password authentication is not enabled for this account",
        });
      }

      const valid = await comparePassword(input.currentPassword, user.passwordHash);
      if (!valid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Current password is incorrect",
        });
      }

      const newHash = await hashPassword(input.newPassword);
      await updatePassword(user.id, newHash);

      return { success: true };
    }),

  checkUsername: publicQuery
    .input(z.object({ username: z.string().min(1).max(255) }))
    .query(async ({ input }) => {
      const db = getDb();
      const existing = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.username, input.username))
        .limit(1);
      return {
        available: existing.length === 0,
        username: input.username,
      };
    }),
});