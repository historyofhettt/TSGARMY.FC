import type { Context } from "hono";
import { setCookie } from "hono/cookie";
import { env } from "../lib/env";
import { getSessionCookieOptions } from "../lib/cookies";
import { Session } from "@contracts/constants";
import { signSessionToken } from "../session";
import { upsertUser, findUserByProvider } from "../queries/users";

async function exchangeCodeForTokens(code: string, redirectUri: string) {
  if (!env.discordClientId) {
    throw new Error("Discord OAuth is not configured. Missing DISCORD_CLIENT_ID.");
  }
  if (!env.discordClientSecret) {
    throw new Error("Discord OAuth is not configured. Missing DISCORD_CLIENT_SECRET.");
  }

  const params = new URLSearchParams({
    code,
    client_id: env.discordClientId,
    client_secret: env.discordClientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const resp = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (resp.status === 429) {
    const retryAfterHeader = resp.headers.get("Retry-After");
    let retryAfterSecs: string | undefined = retryAfterHeader ?? undefined;
    let bodyText: string | undefined;
    try {
      bodyText = await resp.text();
    } catch {
      // ignore body read errors
    }
    if (bodyText) {
      try {
        const bodyJson = JSON.parse(bodyText);
        if (typeof bodyJson.retry_after === "number") {
          retryAfterSecs = String(bodyJson.retry_after);
        }
      } catch {
        // not JSON; use header value if available
      }
    }
    if (retryAfterSecs) {
      console.warn(`[Discord OAuth] Rate-limited (429). Retry after ${retryAfterSecs}s.`, { retryAfterSecs, body: bodyText });
    } else {
      console.warn("[Discord OAuth] Rate-limited (429). No retry duration provided by Discord.");
    }
    throw new Error("Discord rate limit reached. Please try signing in again in a moment.");
  }

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Discord token exchange failed (${resp.status}): ${text}`);
  }

  return resp.json() as Promise<{
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token?: string;
    scope: string;
  }>;
}

async function fetchDiscordProfile(accessToken: string) {
  const resp = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Discord profile fetch failed (${resp.status}): ${text}`);
  }

  return resp.json() as Promise<{
    id: string;
    username: string;
    discriminator: string;
    avatar: string;
    global_name?: string;
  }>;
}

export function createDiscordCallbackHandler() {
  return async (c: Context) => {
    const code = c.req.query("code");
    const error = c.req.query("error");

    if (error) {
      return c.redirect("/", 302);
    }

    if (!code) {
      return c.json({ error: "Missing authorization code" }, 400);
    }

    try {
      const state = c.req.query("state");
      const expectedBase = c.req.url.split("/api/oauth/discord")[0];
      const redirectUri = `${expectedBase}/api/oauth/discord/callback`;
      let redirectUriUsed = redirectUri;
      if (state) {
        try {
          const decoded = atob(state);
          const parsed = new URL(decoded);
          if (parsed.origin === new URL(redirectUri).origin) {
            redirectUriUsed = decoded;
          }
        } catch {
          // keep fallback redirectUri
        }
      }
       const tokenResp = await exchangeCodeForTokens(code, redirectUriUsed);
      const profile = await fetchDiscordProfile(tokenResp.access_token);
      if (!profile) {
        throw new Error("Failed to fetch Discord profile");
      }

       const name = profile.global_name || profile.username;
      const avatar = profile.avatar
        ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
        : null;

      const username = c.req.query("username");
      const existingByProvider = await findUserByProvider("discord", profile.id);

      // If no username provided and user doesn't exist yet → redirect to username selection
      if (!username && !existingByProvider) {
        const params = new URLSearchParams();
        params.set("provider", "discord");
        params.set("providerId", profile.id);
        params.set("name", name ?? "");
        params.set("avatar", avatar ?? "");
        return c.redirect(`/username-select?${params.toString()}`, 302);
      }

      try {
        await upsertUser({
          provider: "discord",
          providerId: profile.id,
          name,
          avatar,
          ...(username ? { username } : {}),
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/Username already exists/i.test(msg)) {
          const params = new URLSearchParams();
          params.set("provider", "discord");
          params.set("providerId", profile.id);
          params.set("name", name ?? "");
          params.set("avatar", avatar ?? "");
          params.set("error", "Username already exists");
          return c.redirect(`/username-select?${params.toString()}`, 302);
        }
        throw err;
      }

      const user = await findUserByProvider("discord", profile.id);
      if (!user) {
        throw new Error("Failed to create or load Discord user");
      }

      const session = await signSessionToken({
        kind: "discord",
        userId: user.id,
      });

      const cookieOpts = getSessionCookieOptions(c.req.raw.headers);
      setCookie(c, Session.cookieName, session, {
        ...cookieOpts,
        maxAge: Session.maxAgeMs / 1000,
      });

      const headers = new Headers(c.res.headers);
      headers.set("Location", "/");
      const response = new Response(null, { status: 302, headers });
      return response;
    } catch (error) {
      console.error("[Discord OAuth] Callback failed", error);
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("Discord rate limit")) {
        return c.json({ error: "Discord rate limit reached. Please try signing in again in a few moments." }, 429);
      }
      return c.json({ error: "Discord OAuth callback failed" }, 500);
    }
  };
}
