import type { Context } from "hono";
import { setCookie } from "hono/cookie";
import { env } from "../lib/env";
import { getSessionCookieOptions } from "../lib/cookies";
import { Session } from "@contracts/constants";
import { signSessionToken } from "../session";
import { upsertUser, findUserByProvider } from "../queries/users";

async function exchangeCodeForTokens(code: string, redirectUri: string) {
  if (!env.googleClientId) {
    throw new Error("Google OAuth is not configured. Missing GOOGLE_CLIENT_ID.");
  }
  if (!env.googleClientSecret) {
    throw new Error("Google OAuth is not configured. Missing GOOGLE_CLIENT_SECRET.");
  }

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
      console.warn(`[Google OAuth] Rate-limited (429). Retry after ${retryAfterSecs}s.`, { retryAfterSecs });
    } else {
      console.warn("[Google OAuth] Rate-limited (429). No retry duration provided by Google.");
    }
    console.warn("[Google OAuth] Token exchange rate-limited. Provider URL: oauth2.googleapis.com/token");
    throw new Error("Google rate limit reached. Please try signing in again in a moment.");
  }

  if (!resp.ok) {
    const text = await resp.text();
    let safeDetail = "";
    try {
      const bodyJson = JSON.parse(text);
      safeDetail = JSON.stringify(bodyJson);
    } catch {
      safeDetail = `[non-JSON response, ${text.length} chars]`;
    }
    console.error(`[Google OAuth] Token exchange failed. Status: ${resp.status}`, {
      provider: "google",
      endpoint: "oauth2.googleapis.com/token",
      status: resp.status,
      detail: safeDetail,
    });
    if (resp.status === 400 && /invalid_grant/i.test(text)) {
      throw new Error("Google OAuth authorization code expired or already used. Please restart sign-in.");
    }
    if (resp.status === 401) {
      throw new Error("Google OAuth credentials invalid. Contact support.");
    }
    throw new Error(`Google token exchange failed (${resp.status}).`);
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
    let safeDetail = "";
    try {
      const bodyJson = JSON.parse(text);
      safeDetail = JSON.stringify(bodyJson);
    } catch {
      safeDetail = `[non-JSON response, ${text.length} chars]`;
    }
    console.error(`[Google OAuth] Profile fetch failed. Status: ${resp.status}`, {
      provider: "google",
      endpoint: "www.googleapis.com/oauth2/v3/userinfo",
      status: resp.status,
      detail: safeDetail,
    });
    throw new Error(`Google profile fetch failed (${resp.status}).`);
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
      console.warn("[Google OAuth] Redirected with error parameter:", { error: error.substring(0, 100) });
      return c.redirect("/", 302);
    }

    if (!code) {
      return c.json({ error: "Missing authorization code" }, 400);
    }

    try {
      if (!env.googleRedirectUri) {
        console.error("[Google OAuth] GOOGLE_REDIRECT_URI is not configured");
        throw new Error("Google OAuth is not configured. Missing GOOGLE_REDIRECT_URI.");
      }
      const redirectUriUsed = env.googleRedirectUri;
      console.info("[Google OAuth] Using redirect_uri for token exchange", { redirectUri: redirectUriUsed });
      const tokenResp = await exchangeCodeForTokens(code, redirectUriUsed);
      const profile = await fetchGoogleProfile(tokenResp.access_token);
      if (!profile) {
        throw new Error("Failed to fetch Google profile");
      }

      const username = c.req.query("username");
      const existingByProvider = await findUserByProvider("google", profile.sub);

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
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/Username already exists/i.test(msg)) {
          const params = new URLSearchParams();
          params.set("provider", "google");
          params.set("providerId", profile.sub);
          params.set("email", profile.email ?? "");
          params.set("name", profile.name ?? "");
          params.set("avatar", profile.picture ?? "");
          params.set("error", "Username already exists");
          return c.redirect(`/username-select?${params.toString()}`, 302);
        }
        console.error("[Google OAuth] Database upsert failed:", { providerId: profile.sub, error: msg.substring(0, 200) });
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
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("rate limit")) {
        return c.json({ error: "Google rate limit reached. Please try signing in again in a few moments." }, 429);
      }
      if (msg.includes("not configured")) {
        return c.json({ error: "Google OAuth is not configured on the server." }, 503);
      }
      if (msg.includes("authorization code")) {
        return c.json({ error: "Google OAuth session expired. Please sign in again." }, 400);
      }
      if (msg.includes("credentials invalid")) {
        return c.json({ error: "Google OAuth credentials are invalid. Please contact support." }, 502);
      }
      return c.json({ error: "Google OAuth callback failed" }, 500);
    }
  };
}
