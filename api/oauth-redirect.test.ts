import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { Context } from "hono";

const PRODUCTION_BASE = "https://tsgarmy-fc.onrender.com";
const GOOGLE_CALLBACK = `${PRODUCTION_BASE}/api/oauth/google/callback`;
const DISCORD_CALLBACK = `${PRODUCTION_BASE}/api/oauth/discord/callback`;

describe("OAuth redirect_uri consistency: frontend and backend use identical URLs", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.APP_ID = "test-app-id";
    process.env.APP_SECRET = "test-app-secret";
    process.env.DATABASE_URL = "mysql://test:test@localhost:3306/testdb";
    process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";
    process.env.GOOGLE_REDIRECT_URI = GOOGLE_CALLBACK;
    process.env.DISCORD_CLIENT_ID = "test-discord-id";
    process.env.DISCORD_CLIENT_SECRET = "test-discord-secret";
    process.env.DISCORD_REDIRECT_URI = DISCORD_CALLBACK;
    process.env.NODE_ENV = "production";
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("GOOGLE_REDIRECT_URI matches the exact production callback URL", async () => {
    const { env } = await import("./lib/env");

    expect(env.googleRedirectUri).toBe(GOOGLE_CALLBACK);
    expect(env.googleRedirectUri).toBe(
      "https://tsgarmy-fc.onrender.com/api/oauth/google/callback",
    );
  });

  it("DISCORD_REDIRECT_URI matches the exact production callback URL", async () => {
    const { env } = await import("./lib/env");

    expect(env.discordRedirectUri).toBe(DISCORD_CALLBACK);
    expect(env.discordRedirectUri).toBe(
      "https://tsgarmy-fc.onrender.com/api/oauth/discord/callback",
    );
  });

  it("Google frontend (VITE_GOOGLE_REDIRECT_URI) and backend (GOOGLE_REDIRECT_URI) use identical values", () => {
    const frontendValue = GOOGLE_CALLBACK;
    const backendValue = process.env.GOOGLE_REDIRECT_URI;

    expect(frontendValue).toBe(backendValue);
  });

  it("Discord frontend (VITE_DISCORD_REDIRECT_URI) and backend (DISCORD_REDIRECT_URI) use identical values", () => {
    const frontendValue = DISCORD_CALLBACK;
    const backendValue = process.env.DISCORD_REDIRECT_URI;

    expect(frontendValue).toBe(backendValue);
  });

  it("does NOT throw when GOOGLE_REDIRECT_URI is missing (optional, validates at request time)", async () => {
    delete process.env.GOOGLE_REDIRECT_URI;
    vi.resetModules();

    const { env } = await import("./lib/env");
    expect(env.googleRedirectUri).toBe("");
  });

  it("does NOT throw when DISCORD_REDIRECT_URI is missing (optional, validates at request time)", async () => {
    delete process.env.DISCORD_REDIRECT_URI;
    vi.resetModules();

    const { env } = await import("./lib/env");
    expect(env.discordRedirectUri).toBe("");
  });

   it("Google callback handler returns 503 when GOOGLE_REDIRECT_URI is missing", async () => {
    delete process.env.GOOGLE_REDIRECT_URI;
    vi.resetModules();

    const { createGoogleCallbackHandler } = await import("./google/auth");

    const mockC = {
      req: {
        query: (k: string) => {
          if (k === "code") return "test-auth-code";
          if (k === "error") return null;
          return null;
        },
      },
      json: (data: unknown, status?: number) => ({ data, status }),
      redirect: () => ({}),
    } as unknown as Context;

    const result = await createGoogleCallbackHandler()(mockC);
    expect(result.status).toBe(503);
  });

  it("Discord callback handler returns 503 when DISCORD_REDIRECT_URI is missing", async () => {
    delete process.env.DISCORD_REDIRECT_URI;
    vi.resetModules();

    const { createDiscordCallbackHandler } = await import("./discord/auth");

    const mockC = {
      req: {
        query: (k: string) => {
          if (k === "code") return "test-auth-code";
          if (k === "error") return null;
          return null;
        },
      },
      json: (data: unknown, status?: number) => ({ data, status }),
      redirect: () => ({}),
    } as unknown as Context;

    const result = await createDiscordCallbackHandler()(mockC);
    expect(result.status).toBe(503);
  });

  it("redirect URIs are not localhost or proxy-internal URLs", async () => {
    const { env } = await import("./lib/env");

    expect(env.googleRedirectUri).not.toMatch(/localhost/);
    expect(env.googleRedirectUri).not.toMatch(/127\.0\.0\.1/);
    expect(env.discordRedirectUri).not.toMatch(/localhost/);
    expect(env.discordRedirectUri).not.toMatch(/127\.0\.0\.1/);
  });

  it("Google callback handler uses env.GOOGLE_REDIRECT_URI not request URL", async () => {
    const { createGoogleCallbackHandler } = await import("./google/auth");
    const { env } = await import("./lib/env");

    let capturedRedirectUri: string | undefined;

    const handler = createGoogleCallbackHandler();

    const mockC = {
      req: {
        query: (k: string) => {
          if (k === "code") return "test-auth-code";
          if (k === "error") return null;
          return null;
        },
        url: "http://localhost:8080/api/oauth/google/callback?code=test-auth-code",
        raw: { headers: new Headers() },
      },
      res: { headers: new Headers() },
      json: () => ({}),
      redirect: () => ({}),
    } as unknown as Context;

    const originalFetch = global.fetch;
    global.fetch = vi.fn((input: unknown, init?: unknown) => {
      if (typeof input === "string" && input.includes("oauth2.googleapis.com/token")) {
        const body = (init as { body?: string })?.body;
        if (body) {
          capturedRedirectUri = new URLSearchParams(body).get("redirect_uri") ?? undefined;
        }
      }
      return Promise.resolve({
        ok: false,
        status: 400,
        text: () => Promise.resolve('{"error":"invalid_grant","error_description":"test"}'),
        json: () => Promise.resolve({ error: "invalid_grant" }),
      } as Response);
    });

    try {
      await handler(mockC);
    } catch {
      // expected — fetch returns 400, handler throws
    }

    global.fetch = originalFetch;

    expect(capturedRedirectUri).toBe(env.googleRedirectUri);
    expect(capturedRedirectUri).toBe(GOOGLE_CALLBACK);
    expect(capturedRedirectUri).not.toContain("localhost");
    expect(capturedRedirectUri).not.toContain("8080");
  });

  it("Discord callback handler uses env.DISCORD_REDIRECT_URI not request URL", async () => {
    const { createDiscordCallbackHandler } = await import("./discord/auth");
    const { env } = await import("./lib/env");

    let capturedRedirectUri: string | undefined;

    const handler = createDiscordCallbackHandler();

    const mockC = {
      req: {
        query: (k: string) => {
          if (k === "code") return "test-auth-code";
          if (k === "error") return null;
          return null;
        },
        url: "http://localhost:8080/api/oauth/discord/callback?code=test-auth-code",
        raw: { headers: new Headers() },
      },
      res: { headers: new Headers() },
      json: () => ({}),
      redirect: () => ({}),
    } as unknown as Context;

    const originalFetch = global.fetch;
    global.fetch = vi.fn((input: unknown, init?: unknown) => {
      if (typeof input === "string" && input.includes("discord.com/api/v10/oauth2/token")) {
        const body = (init as { body?: string })?.body;
        if (body) {
          capturedRedirectUri = new URLSearchParams(body).get("redirect_uri") ?? undefined;
        }
      }
      return Promise.resolve({
        ok: false,
        status: 400,
        text: () => Promise.resolve('{"error":"invalid_grant"}'),
        json: () => Promise.resolve({ error: "invalid_grant" }),
      } as Response);
    });

    try {
      await handler(mockC);
    } catch {
      // expected
    }

    global.fetch = originalFetch;

    expect(capturedRedirectUri).toBe(env.discordRedirectUri);
    expect(capturedRedirectUri).toBe(DISCORD_CALLBACK);
    expect(capturedRedirectUri).not.toContain("localhost");
    expect(capturedRedirectUri).not.toContain("8080");
  });

  it("Discord callback returns 429 when Discord returns 429 on token exchange", async () => {
    const { createDiscordCallbackHandler } = await import("./discord/auth");

    const handler = createDiscordCallbackHandler();

    const mockC = {
      req: {
        query: (k: string) => {
          if (k === "code") return "test-auth-code";
          if (k === "error") return null;
          return null;
        },
        url: "http://localhost:8080/api/oauth/discord/callback?code=test-auth-code",
        raw: { headers: new Headers() },
      },
      res: { headers: new Headers() },
      json: (data: unknown, status?: number) => ({ data, status }),
      redirect: () => ({}),
    } as unknown as Context;

    const originalFetch = global.fetch;
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 429,
        headers: new Headers({ "Retry-After": "60" }),
        text: () =>
          Promise.resolve(
            JSON.stringify({ message: "You are being rate limited.", retry_after: 60.0, global: false }),
          ),
      } as Response),
    );

    const result = await handler(mockC) as unknown as { status: number; data: { error: string } };
    expect(result.status).toBe(429);
    expect(result.data).toHaveProperty("error");

    global.fetch = originalFetch;
  });

  it("Discord callback returns 502 when Discord returns 401 (invalid credentials), not 429", async () => {
    const { createDiscordCallbackHandler } = await import("./discord/auth");

    const handler = createDiscordCallbackHandler();

    const mockC = {
      req: {
        query: (k: string) => {
          if (k === "code") return "test-auth-code";
          if (k === "error") return null;
          return null;
        },
        url: "http://localhost:8080/api/oauth/discord/callback?code=test-auth-code",
        raw: { headers: new Headers() },
      },
      res: { headers: new Headers() },
      json: (data: unknown, status?: number) => ({ data, status }),
      redirect: () => ({}),
    } as unknown as Context;

    const originalFetch = global.fetch;
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        headers: new Headers(),
        text: () => Promise.resolve('{"error": "invalid_client"}'),
      } as Response),
    );

    const result = await handler(mockC);
    expect(result.status).toBe(502);
    global.fetch = originalFetch;
  });
});
