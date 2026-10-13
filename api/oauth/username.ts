import type { Context } from "hono";
import { setCookie } from "hono/cookie";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "../lib/cookies";
import { signSessionToken } from "../session";
import { upsertUser, findUserByProvider, usernameExists } from "../queries/users";

interface OAuthUsernameBody {
  provider: "google" | "discord";
  providerId: string;
  username: string;
  name?: string;
  email?: string;
  avatar?: string;
}

export function createUsernameSelectHandler() {
  return async (c: Context) => {
    try {
      const body = await c.req.json().catch(() => null) as OAuthUsernameBody | null;

      if (!body || !body.provider || !body.providerId || !body.username) {
        return c.json({ error: "Missing required fields" }, 400);
      }

      const { provider, providerId, username, name, email, avatar } = body;

      if (!/^[a-zA-Z0-9_-]{3,255}$/.test(username)) {
        return c.json({ error: "Invalid username format. Use 3-255 alphanumeric characters, hyphens, or underscores." }, 400);
      }

      const existingByProvider = await findUserByProvider(provider, providerId);
      if (await usernameExists(username, existingByProvider?.id)) {
        return c.json({ error: "Username already exists" }, 409);
      }

      try {
        await upsertUser({
          provider,
          providerId,
          name,
          email,
          avatar,
          username,
          role: "fan",
        });
      } catch (err: any) {
        if (/Username already exists/i.test(err?.message ?? "")) {
          return c.json({ error: "Username already exists" }, 409);
        }
        throw err;
      }

      const user = await findUserByProvider(provider as "google" | "discord", providerId);
      if (!user) {
        return c.json({ error: "Failed to create or load user" }, 500);
      }

      const session = await signSessionToken({
        kind: provider,
        userId: user.id,
      });

      const cookieOpts = getSessionCookieOptions(c.req.raw.headers);
      setCookie(c, Session.cookieName, session, {
        ...cookieOpts,
        maxAge: Session.maxAgeMs / 1000,
      });

      return c.json({ success: true, userId: user.id });
    } catch (error) {
      console.error("[OAuth Username] Failed", error);
      const message = error instanceof Error ? error.message : "Internal server error";
      const status = message.includes("Username already exists") ? 409 : 500;
      return c.json({ error: message }, status);
    }
  };
}
