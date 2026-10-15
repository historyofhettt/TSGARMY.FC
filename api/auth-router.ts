import * as cookie from "cookie";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "./lib/cookies";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { signSessionToken } from "./session";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import { eq, and, sql } from "drizzle-orm";
import { hashPassword, comparePassword } from "./lib/password";
import {
  generateOtp,
  hashOtp,
  verifyOtp,
} from "./lib/otp";
import { sendOtpEmail } from "./lib/email";
import { findLocalUserByIdentifier, updatePassword, findUserByEmail, usernameExists } from "./queries/users";

const OTP_EXPIRY_MS = 10 * 60 * 1000;

const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_CLEANUP_MS = 60 * 1000;

let rateLimitCleanupTimer: ReturnType<typeof setInterval> | null = null;
if (rateLimitCleanupTimer === null) {
  rateLimitCleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, attempts] of rateLimitMap.entries()) {
      const valid = attempts.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
      if (valid.length === 0) {
        rateLimitMap.delete(key);
      } else {
        rateLimitMap.set(key, valid);
      }
    }
  }, RATE_LIMIT_CLEANUP_MS);
  rateLimitCleanupTimer.unref?.();
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const attempts = rateLimitMap.get(key) ?? [];
  const valid = attempts.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (valid.length >= RATE_LIMIT_MAX) {
    return false;
  }
  valid.push(now);
  rateLimitMap.set(key, valid);
  return true;
}

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
      } catch (err: any) {
        if (err?.code === "ER_DUP_ENTRY" || /duplicate/i.test(err?.message ?? "")) {
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

  forgotPassword: publicQuery
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const rateLimitKey = `forgot:${input.email}`;
      if (!checkRateLimit(rateLimitKey)) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many attempts. Please try again later.",
        });
      }

      const user = await findUserByEmail(input.email);
      if (!user || user.provider !== "local") {
        return { success: true, message: "If an account exists, an OTP has been sent." };
      }

      const otp = generateOtp();
      const otpHash = await hashOtp(otp);
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

      await getDb()
        .insert(schema.passwordResets)
        .values({
          email: input.email,
          token: otpHash,
          expiresAt,
          used: false,
        });

      try {
        await sendOtpEmail(input.email, otp);
      } catch (emailError: unknown) {
        const msg = emailError instanceof Error ? emailError.message : String(emailError);
        console.error("[auth] forgotPassword: failed to send OTP email", {
          email: input.email,
          error: msg.substring(0, 200),
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send verification email. Please try again.",
        });
      }

      return { success: true, message: "If an account exists, an OTP has been sent." };
    }),

  verifyOtp: publicQuery
    .input(
      z.object({
        email: z.string().email(),
        otp: z.string().length(6),
      }),
    )
    .mutation(async ({ input }) => {
      if (!checkRateLimit(`otp:${input.email}`)) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many verification attempts. Please try again later.",
        });
      }

      const user = await findUserByEmail(input.email);
      if (!user || user.provider !== "local") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid OTP" });
      }

      const resetRecord = await getDb()
        .select()
        .from(schema.passwordResets)
        .where(
          and(
            eq(schema.passwordResets.email, input.email),
            eq(schema.passwordResets.used, false),
            sql`${schema.passwordResets.expiresAt} > ${new Date()}`,
          ),
        )
        .orderBy(sql`${schema.passwordResets.createdAt} DESC`)
        .limit(1);

      if (!resetRecord.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired OTP" });
      }

      const valid = await verifyOtp(input.otp, resetRecord[0].token);
      if (!valid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid OTP" });
      }

      await getDb()
        .update(schema.passwordResets)
        .set({ used: true })
        .where(eq(schema.passwordResets.id, resetRecord[0].id));

      return { success: true };
    }),

  resetPassword: publicQuery
    .input(
      z.object({
        email: z.string().email(),
        otp: z.string().length(6),
        newPassword: z.string().min(6),
        confirmPassword: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      if (!checkRateLimit(`reset:${input.email}`)) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many attempts. Please try again later.",
        });
      }

      if (input.newPassword !== input.confirmPassword) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Passwords do not match",
        });
      }

      const user = await findUserByEmail(input.email);
      if (!user || user.provider !== "local") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid OTP" });
      }

      const resetRecord = await getDb()
        .select()
        .from(schema.passwordResets)
        .where(
          and(
            eq(schema.passwordResets.email, input.email),
            eq(schema.passwordResets.used, false),
            sql`${schema.passwordResets.expiresAt} > ${new Date()}`,
          ),
        )
        .orderBy(sql`${schema.passwordResets.createdAt} DESC`)
        .limit(1);

      if (!resetRecord.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired OTP" });
      }

      const valid = await verifyOtp(input.otp, resetRecord[0].token);
      if (!valid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid OTP" });
      }

      const passwordHash = await hashPassword(input.newPassword);

      await updatePassword(user.id, passwordHash);

      await getDb()
        .update(schema.passwordResets)
        .set({ used: true })
        .where(eq(schema.passwordResets.id, resetRecord[0].id));

      return { success: true };
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