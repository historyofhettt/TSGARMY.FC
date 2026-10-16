import type { Context } from "hono";
import { setCookie } from "hono/cookie";
import { env } from "../lib/env";
import { getSessionCookieOptions } from "../lib/cookies";
import { Session } from "@contracts/constants";
import { signSessionToken } from "../session";
import { upsertUser, findUserByProvider } from "../queries/users";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 1000;
const FETCH_TIMEOUT_MS = 10000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface DiscordFetchOptions extends RequestInit {
  retryOn429?: boolean;
}

function parseRetryAfter(headerValue: string | null): number | undefined {
  if (!headerValue) return undefined;
  const parsed = Number.parseFloat(headerValue);
  if (!Number.isNaN(parsed) && parsed >= 0) {
    return parsed * 1000;
  }
  const dateMs = Date.parse(headerValue);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }
  return undefined;
}

function endpointLabel(url: string): string {
  return url.replace(/^https:\/\/discord\.com\//, "");
}

async function discordFetch(url: string, opts: DiscordFetchOptions = {}): Promise<Response> {
  const { retryOn429 = true, ...init } = opts;
  let attempt = 0;
  while (true) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const signal = controller.signal;
    let resp: Response;
    try {
      console.info("[Discord OAuth] Sending API request", {
        endpoint: endpointLabel(url),
        method: init.method || "GET",
      });
      resp = await fetch(url, { ...init, signal });
    } finally {
      clearTimeout(timeoutId);
    }
    if (resp.status !== 429 || !retryOn429 || attempt >= MAX_RETRIES) {
      console.info("[Discord OAuth] API request completed", {
        endpoint: endpointLabel(url),
        status: resp.status,
      });
      return resp;
    }
    const retryAfterHeader = resp.headers.get("Retry-After");
    let retryAfterMs: number | undefined;
    try {
      const bodyText = await resp.text();
      try {
        const bodyJson = JSON.parse(bodyText);
        if (typeof bodyJson.retry_after === "number") {
          retryAfterMs = bodyJson.retry_after * 1000;
        }
      } catch {
        void 0;
      }
    } catch {
      void 0;
    }
    if (retryAfterMs === undefined) {
      retryAfterMs = parseRetryAfter(retryAfterHeader);
    }
    const waitMs = retryAfterMs ?? INITIAL_BACKOFF_MS * Math.pow(2, attempt);
    console.warn(`[Discord OAuth] Rate-limited (429) on attempt ${attempt + 1}/${MAX_RETRIES}. Retrying after ${Math.round(waitMs)}ms.`, {
      endpoint: endpointLabel(url),
      retryAfterHeader: retryAfterHeader ?? undefined,
      bodyRetryAfter: retryAfterMs !== undefined ? retryAfterMs : undefined,
    });
    await sleep(waitMs);
    attempt++;
  }
}

function getCookieValue(c: Context, key: string): string | undefined {
  const cookieHeader = c.req.header("cookie");
  if (!cookieHeader) return undefined;
  const cookies = Object.fromEntries(
    cookieHeader
      .split(";")
      .map((c) => c.trim())
      .filter((c) => c.includes("="))
      .map((c) => {
        const [k, ...v] = c.split("=");
        return [k, v.join("=")];
      }),
  );
  return cookies[key];
}

function clearOauthCookie(c: Context, key: string) {
  if (c.res?.headers) {
    c.res.headers.append(
      "Set-Cookie",
      `${key}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
    );
  }
}

function validateOauthState(c: Context): { nonce: string; username?: string } | null {
  const returnedState = c.req.query("state");
  if (!returnedState) return null;

  const cookieState = getCookieValue(c, "oauth_state");
  if (!cookieState || cookieState !== returnedState) return null;

  let payload: { nonce?: string; username?: string };
  try {
    payload = JSON.parse(atob(returnedState));
  } catch {
    return null;
  }

  if (!payload.nonce) return null;

  const cookieNonce = getCookieValue(c, "oauth_nonce");
  if (!cookieNonce || cookieNonce !== payload.nonce) return null;

  clearOauthCookie(c, "oauth_state");
  clearOauthCookie(c, "oauth_nonce");

  return { nonce: payload.nonce, ...(payload.username ? { username: payload.username } : {}) };
}

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

  const resp = await discordFetch(`${DISCORD_API_BASE}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (resp.status === 429) {
    console.warn("[Discord OAuth] Rate-limited (429) on token exchange after retries exhausted.", { endpoint: "discord.com/api/v10/oauth2/token" });
    throw new Error("Discord rate limit reached. Please try signing in again in a few moments.");
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
    console.error(`[Discord OAuth] Token exchange failed. Status: ${resp.status}`, {
      provider: "discord",
      endpoint: "discord.com/api/v10/oauth2/token",
      status: resp.status,
      detail: safeDetail,
    });
    if (resp.status === 400 && /invalid_grant/i.test(text)) {
      throw new Error("Discord OAuth authorization code expired or already used. Please restart sign-in.");
    }
    if (resp.status === 401) {
      throw new Error("Discord OAuth credentials invalid. Contact support.");
    }
    throw new Error(`Discord token exchange failed (${resp.status}).`);
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
  const resp = await discordFetch(`${DISCORD_API_BASE}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (resp.status === 429) {
    console.warn("[Discord OAuth] Rate-limited (429) on profile fetch after retries exhausted.", { endpoint: "discord.com/api/v10/users/@me" });
    throw new Error("Discord rate limit reached. Please try signing in again in a few moments.");
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
    console.error(`[Discord OAuth] Profile fetch failed. Status: ${resp.status}`, {
      provider: "discord",
      endpoint: "discord.com/api/v10/users/@me",
      status: resp.status,
      detail: safeDetail,
    });
    throw new Error(`Discord profile fetch failed (${resp.status}).`);
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

    console.info("[Discord OAuth] Callback triggered", {
      hasCode: !!code,
      hasError: !!error,
      error: error ? error.substring(0, 50) : null,
    });

    if (error) {
      console.warn("[Discord OAuth] Redirected with error parameter:", { error: error.substring(0, 100) });
      return c.redirect("/", 302);
    }

    if (!code) {
      return c.json({ error: "Missing authorization code" }, 400);
    }

    const state = validateOauthState(c);
    if (!state) {
      return c.json({ error: "Invalid OAuth state. Possible CSRF attempt." }, 400);
    }

    try {
      if (!env.discordRedirectUri) {
        console.error("[Discord OAuth] DISCORD_REDIRECT_URI is not configured");
        throw new Error("Discord OAuth is not configured. Missing DISCORD_REDIRECT_URI.");
      }
      const redirectUriUsed = env.discordRedirectUri;
      console.info("[Discord OAuth] Using redirect_uri for token exchange", { redirectUri: redirectUriUsed });
      console.info("[Discord OAuth] Exchange token started");
      const tokenResp = await exchangeCodeForTokens(code, redirectUriUsed);
      console.info("[Discord OAuth] Token exchange succeeded");
      console.info("[Discord OAuth] Fetch profile started");
      const profile = await fetchDiscordProfile(tokenResp.access_token);
      console.info("[Discord OAuth] Profile fetch succeeded", { providerId: profile.id });
      if (!profile) {
        throw new Error("Failed to fetch Discord profile");
      }

      const name = profile.global_name || profile.username;
      const avatar = profile.avatar
        ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
        : null;

      const username = state.username;
      const existingByProvider = await findUserByProvider("discord", profile.id);

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
        console.error("[Discord OAuth] Database upsert failed:", { providerId: profile.id, error: msg.substring(0, 200) });
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
      console.info("[Discord OAuth] Session created, redirecting to /", { userId: user.id });
      return response;
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === "AbortError";
      console.error("[Discord OAuth] Callback failed", error instanceof Error ? error.message : String(error), {
        isAbort,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      });
      const msg = error instanceof Error ? error.message : String(error);
      if (isAbort || msg.includes("timeout") || msg.includes("aborted")) {
        return c.redirect("/?oauth_error=timeout", 302);
      }
      if (msg.includes("rate limit")) {
        return c.redirect("/?oauth_error=rate_limited", 302);
      }
      if (msg.includes("not configured")) {
        return c.redirect("/?oauth_error=not_configured", 302);
      }
      if (msg.includes("authorization code")) {
        return c.redirect("/?oauth_error=code_expired", 302);
      }
      if (msg.includes("credentials invalid")) {
        return c.redirect("/?oauth_error=credentials_invalid", 302);
      }
      return c.redirect("/?oauth_error=unknown", 302);
    }
  };
}
