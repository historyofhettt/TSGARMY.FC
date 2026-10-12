import type { Context } from "hono";
import { setCookie } from "hono/cookie";
import * as cookie from "cookie";
import { env } from "../lib/env";
import { getSessionCookieOptions } from "../lib/cookies";
import { Session } from "@contracts/constants";
import { signSessionToken } from "../session";
import { upsertUser, findUserByProvider } from "../queries/users";

async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const params = new URLSearchParams({
    code,
    client_id: env.googleClientId,
    client_secret: env.googleClientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Google token exchange failed (${resp.status}): ${text}`);
  }

  return resp.json() as Promise<{
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token?: string;
    scope: string;
  }>;
}

async function fetchGoogleProfile(accessToken: string) {
  const resp = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Google profile fetch failed (${resp.status}): ${text}`);
  }

  return resp.json() as Promise<{
    sub: string;
    name: string;
    email: string;
    picture: string;
  }>;
}

export function createGoogleCallbackHandler() {
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
      const expectedBase = c.req.url.split("/api/oauth/google")[0];
      const redirectUri = `${expectedBase}/api/oauth/google/callback`;
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
      const profile = await fetchGoogleProfile(tokenResp.access_token);
      if (!profile) {
        throw new Error("Failed to fetch Google profile");
      }

      const username = c.req.query("username");
      const existingByProvider = await findUserByProvider("google", profile.sub);

      // If no username provided and user doesn't exist yet → redirect to username selection
      if (!username && !existingByProvider) {
        const params = new URLSearchParams();
        params.set("provider", "google");
        params.set("providerId", profile.sub);
        params.set("email", profile.email ?? "");
        params.set("name", profile.name ?? "");
        params.set("avatar", profile.picture ?? "");
        return c.redirect(`/username-select?${params.toString()}`, 302);
      }

      try {
        await upsertUser({
          provider: "google",
          providerId: profile.sub,
          name: profile.name,
          email: profile.email,
          avatar: profile.picture,
          ...(username ? { username } : {}),
        });
      } catch (err: any) {
        if (/Username already exists/i.test(err?.message ?? "")) {
          const params = new URLSearchParams();
          params.set("provider", "google");
          params.set("providerId", profile.sub);
          params.set("email", profile.email ?? "");
          params.set("name", profile.name ?? "");
          params.set("avatar", profile.picture ?? "");
          params.set("error", "Username already exists");
          return c.redirect(`/username-select?${params.toString()}`, 302);
        }
        throw err;
      }

      const user = await findUserByProvider("google", profile.sub);
      if (!user) {
        throw new Error("Failed to create or load Google user");
      }

      const session = await signSessionToken({
        kind: "google",
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
      console.error("[Google OAuth] Callback failed", error);
      return c.json({ error: "Google OAuth callback failed" }, 500);
    }
  };
}
