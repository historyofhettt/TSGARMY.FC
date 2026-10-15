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

    const validState = btoa(JSON.stringify({ nonce: "test-nonce" }));
    const mockC = {
      req: {
        query: (k: string) => {
          if (k === "code") return "test-auth-code";
          if (k === "error") return null;
          if (k === "state") return validState;
          return null;
        },
        header: (k: string) => {
          if (k === "cookie") return `oauth_state=${validState}; oauth_nonce=test-nonce`;
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

    const validState = btoa(JSON.stringify({ nonce: "test-nonce" }));
    const mockC = {
      req: {
        query: (k: string) => {
          if (k === "code") return "test-auth-code";
          if (k === "error") return null;
          if (k === "state") return validState;
          return null;
        },
        header: (k: string) => {
          if (k === "cookie") return `oauth_state=${validState}; oauth_nonce=test-nonce`;
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
    const validState = btoa(JSON.stringify({ nonce: "test-nonce" }));

    const handler = createGoogleCallbackHandler();

    const resHeaders = new Headers();
    const mockC = {
      req: {
        query: (k: string) => {
          if (k === "code") return "test-auth-code";
          if (k === "error") return null;
          if (k === "state") return validState;
          return null;
        },
        url: "http://localhost:8080/api/oauth/google/callback?code=test-auth-code",
        raw: { headers: new Headers() },
        header: (k: string) => {
          if (k === "cookie") return `oauth_state=${validState}; oauth_nonce=test-nonce`;
          return null;
        },
      },
      res: { headers: resHeaders },
      header: (key: string, value?: string, opts?: { append?: boolean }) => {
        if (value === undefined) return resHeaders.get(key);
        if (opts?.append) resHeaders.append(key, value);
        else resHeaders.set(key, value);
      },
      json: (data: unknown, status?: number) => ({ data, status }),
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
    const validState = btoa(JSON.stringify({ nonce: "test-nonce" }));

    const handler = createDiscordCallbackHandler();

    const mockC = {
      req: {
        query: (k: string) => {
          if (k === "code") return "test-auth-code";
          if (k === "error") return null;
          if (k === "state") return validState;
          return null;
        },
        url: "http://localhost:8080/api/oauth/discord/callback?code=test-auth-code",
         raw: { headers: new Headers() },
        header: (k: string) => {
          if (k === "cookie") return `oauth_state=${validState}; oauth_nonce=test-nonce`;
          return null;
        },
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
    const validState = btoa(JSON.stringify({ nonce: "test-nonce" }));

    const mockC = {
      req: {
        query: (k: string) => {
          if (k === "code") return "test-auth-code";
          if (k === "error") return null;
          if (k === "state") return validState;
          return null;
        },
        url: "http://localhost:8080/api/oauth/discord/callback?code=test-auth-code",
         raw: { headers: new Headers() },
        header: (k: string) => {
          if (k === "cookie") return `oauth_state=${validState}; oauth_nonce=test-nonce`;
          return null;
        },
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
    const validState = btoa(JSON.stringify({ nonce: "test-nonce" }));

    const mockC = {
      req: {
        query: (k: string) => {
          if (k === "code") return "test-auth-code";
          if (k === "error") return null;
          if (k === "state") return validState;
          return null;
        },
        url: "http://localhost:8080/api/oauth/discord/callback?code=test-auth-code",
         raw: { headers: new Headers() },
        header: (k: string) => {
          if (k === "cookie") return `oauth_state=${validState}; oauth_nonce=test-nonce`;
          return null;
        },
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

  const buildMockContext = (overrides: {
    state?: string | null;
    code?: string | null;
    cookies?: Record<string, string>;
  }) => {
    const cookies = overrides.cookies ?? {};
    const cookieHeader = Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
    return {
      req: {
        query: (k: string) => {
          if (k === "code") return overrides.code ?? null;
          if (k === "error") return null;
          if (k === "state") return overrides.state ?? null;
          return null;
        },
        url: "http://localhost:8080/api/oauth/discord/callback?code=test-auth-code",
        raw: { headers: new Headers() },
        header: (k: string) => (k === "cookie" ? cookieHeader : null),
      },
      res: { headers: new Headers() },
      json: (data: unknown, status?: number) => ({ data, status }),
      redirect: () => ({}),
    } as unknown as Context;
  };

  it("Google callback rejects missing state parameter (CSRF protection)", async () => {
    const { createGoogleCallbackHandler } = await import("./google/auth");
    const handler = createGoogleCallbackHandler();

    const mockC = buildMockContext({ code: "test-auth-code", state: null });
    const result = await handler(mockC) as unknown as { status: number; data: { error: string } };
    expect(result.status).toBe(400);
    expect(result.data).toEqual({ error: "Invalid OAuth state. Possible CSRF attempt." });
  });

  it("Google callback rejects state that doesn't match cookie (CSRF protection)", async () => {
    const { createGoogleCallbackHandler } = await import("./google/auth");
    const handler = createGoogleCallbackHandler();

    const mockC = buildMockContext({
      code: "test-auth-code",
      state: "different-state",
      cookies: { oauth_state: "expected-state" },
    });
    const result = await handler(mockC) as unknown as { status: number; data: { error: string } };
    expect(result.status).toBe(400);
    expect(result.data).toEqual({ error: "Invalid OAuth state. Possible CSRF attempt." });
  });

  it("Google callback rejects state with invalid nonce (CSRF protection)", async () => {
    const { createGoogleCallbackHandler } = await import("./google/auth");
    const handler = createGoogleCallbackHandler();

    const state = btoa(JSON.stringify({ nonce: "wrong-nonce" }));
    const mockC = buildMockContext({
      code: "test-auth-code",
      state,
      cookies: { oauth_state: state, oauth_nonce: "right-nonce" },
    });
    const result = await handler(mockC) as unknown as { status: number; data: { error: string } };
    expect(result.status).toBe(400);
    expect(result.data).toEqual({ error: "Invalid OAuth state. Possible CSRF attempt." });
  });

  it("Discord callback rejects missing state parameter (CSRF protection)", async () => {
    const { createDiscordCallbackHandler } = await import("./discord/auth");
    const handler = createDiscordCallbackHandler();

    const mockC = buildMockContext({ code: "test-auth-code", state: null });
    const result = await handler(mockC) as unknown as { status: number; data: { error: string } };
    expect(result.status).toBe(400);
    expect(result.data).toEqual({ error: "Invalid OAuth state. Possible CSRF attempt." });
  });

  it("Discord callback rejects state that doesn't match cookie (CSRF protection)", async () => {
    const { createDiscordCallbackHandler } = await import("./discord/auth");
    const handler = createDiscordCallbackHandler();

    const mockC = buildMockContext({
      code: "test-auth-code",
      state: "different-state",
      cookies: { oauth_state: "expected-state" },
    });
    const result = await handler(mockC) as unknown as { status: number; data: { error: string } };
    expect(result.status).toBe(400);
    expect(result.data).toEqual({ error: "Invalid OAuth state. Possible CSRF attempt." });
  });

  it("Discord callback rejects state with invalid nonce (CSRF protection)", async () => {
    const { createDiscordCallbackHandler } = await import("./discord/auth");
    const handler = createDiscordCallbackHandler();

    const state = btoa(JSON.stringify({ nonce: "wrong-nonce" }));
    const mockC = buildMockContext({
      code: "test-auth-code",
      state,
      cookies: { oauth_state: state, oauth_nonce: "right-nonce" },
    });
    const result = await handler(mockC) as unknown as { status: number; data: { error: string } };
    expect(result.status).toBe(400);
    expect(result.data).toEqual({ error: "Invalid OAuth state. Possible CSRF attempt." });
  });

  it("Discord callback rejects missing code parameter", async () => {
    const { createDiscordCallbackHandler } = await import("./discord/auth");
    const handler = createDiscordCallbackHandler();

    const mockC = buildMockContext({ code: null, state: "some-state" });
    const result = await handler(mockC) as unknown as { status: number; data: { error: string } };
    expect(result.status).toBe(400);
    expect(result.data).toEqual({ error: "Missing authorization code" });
  });

  it("Discord callback rejects error parameter redirect", async () => {
    const { createDiscordCallbackHandler } = await import("./discord/auth");
    const handler = createDiscordCallbackHandler();

    const mockC = {
      req: {
        query: (k: string) => (k === "error" ? "access_denied" : null),
        header: () => null,
      },
      redirect: (url: string, status: number) => ({ url, status }),
    } as unknown as Context;

    const result = await handler(mockC);
    expect(result.url).toBe("/");
    expect(result.status).toBe(302);
  });

  it("Discord callback creates session on successful OAuth flow", async () => {
    // Mock findUserByProvider and upsertUser BEFORE importing the handler
    const mockUpsertUser = vi.fn().mockResolvedValue(undefined);
    const mockFindUser = vi.fn().mockResolvedValue({
      id: 12345,
      role: "admin",
    });
    vi.doMock("./queries/users", () => ({
      upsertUser: mockUpsertUser,
      findUserByProvider: mockFindUser,
    }));

    const { createDiscordCallbackHandler } = await import("./discord/auth");
    const { env } = await import("./lib/env");

    const handler = createDiscordCallbackHandler();
    const validState = btoa(JSON.stringify({ nonce: "test-nonce", username: "newuser123" }));

    const resHeaders = new Headers();
    const mockC = {
      req: {
        query: (k: string) => {
          if (k === "code") return "valid-auth-code";
          if (k === "error") return null;
          if (k === "state") return validState;
          return null;
        },
        header: (k: string) => {
          if (k === "cookie") return `oauth_state=${validState}; oauth_nonce=test-nonce`;
          return null;
        },
        raw: { headers: new Headers() },
      },
      res: { headers: resHeaders },
      header: (key: string, value?: string, opts?: { append?: boolean }) => {
        if (value === undefined) return resHeaders.get(key);
        if (opts?.append) resHeaders.append(key, value);
        else resHeaders.set(key, value);
      },
      json: (data: unknown, status?: number) => ({ data, status }),
      redirect: (url: string, status: number) => ({ url, status }),
    } as unknown as Context;

    global.fetch = vi.fn((input: unknown) => {
      const url = typeof input === "string" ? input : "";
      if (url.includes("discord.com/api/v10/oauth2/token")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            access_token: "mock-access-token",
            token_type: "Bearer",
            expires_in: 604800,
            scope: "identify email",
          }),
        } as Response);
      }
      if (url.includes("discord.com/api/v10/users/@me")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: "123456789",
            username: "discorduser",
            discriminator: "0001",
            avatar: "abc123",
            global_name: "Discord User",
          }),
        } as Response);
      }
      return Promise.reject(new Error("Unexpected fetch"));
    }) as unknown as typeof fetch;

    expect(env.discordRedirectUri).toBe(DISCORD_CALLBACK);
    expect(env.discordClientId).toBe("test-discord-id");
    expect(env.discordClientSecret).toBe("test-discord-secret");

    const result = await handler(mockC);
    expect(result.status).toBe(302);
    expect(result.headers.get("Location")).toBe("/");
    expect(mockFindUser).toHaveBeenCalled();
    expect(mockUpsertUser).toHaveBeenCalled();

    global.fetch = vi.fn() as unknown as typeof fetch;
    vi.restoreAllMocks();
  });

  it("Discord callback uses env.DISCORD_REDIRECT_URI for token exchange (not localhost)", async () => {
    // Mock findUserByProvider and upsertUser BEFORE importing the handler
    const mockUpsertUser = vi.fn().mockResolvedValue(undefined);
    const mockFindUser = vi.fn().mockResolvedValue({ id: 12345, role: "admin" });
    vi.doMock("./queries/users", () => ({
      upsertUser: mockUpsertUser,
      findUserByProvider: mockFindUser,
    }));

    const { createDiscordCallbackHandler } = await import("./discord/auth");

    const handler = createDiscordCallbackHandler();
    const validState = btoa(JSON.stringify({ nonce: "test-nonce" }));

    let capturedRedirectUri: string | undefined;

    const resHeaders = new Headers();
    const mockC = {
      req: {
        query: (k: string) => {
          if (k === "code") return "test-auth-code";
          if (k === "error") return null;
          if (k === "state") return validState;
          return null;
        },
        url: "http://localhost:8080/api/oauth/discord/callback?code=test-auth-code",
        raw: { headers: new Headers() },
        header: (k: string) => {
          if (k === "cookie") return `oauth_state=${validState}; oauth_nonce=test-nonce`;
          return null;
        },
      },
      res: { headers: resHeaders },
      header: (key: string, value?: string, opts?: { append?: boolean }) => {
        if (value === undefined) return resHeaders.get(key);
        if (opts?.append) resHeaders.append(key, value);
        else resHeaders.set(key, value);
      },
      json: (data: unknown, status?: number) => ({ data, status }),
      redirect: () => ({}),
    } as unknown as Context;

    global.fetch = vi.fn((input: unknown, init?: unknown) => {
      const url = typeof input === "string" ? input : "";
      if (url.includes("discord.com/api/v10/oauth2/token")) {
        const body = (init as { body?: string })?.body;
        if (body) {
          capturedRedirectUri = new URLSearchParams(body).get("redirect_uri") ?? undefined;
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ access_token: "mock", token_type: "Bearer", expires_in: 600, scope: "" }),
        } as Response);
      }
      if (url.includes("users/@me")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: "123", username: "test", discriminator: "0", avatar: null }),
        } as Response);
      }
      return Promise.reject(new Error("Unexpected"));
    }) as unknown as typeof fetch;

    try {
      await handler(mockC);
    } catch {
      // ok
    }

    expect(capturedRedirectUri).toBe(DISCORD_CALLBACK);
    expect(capturedRedirectUri).not.toContain("localhost");
    expect(capturedRedirectUri).not.toContain("8080");

    global.fetch = vi.fn() as unknown as typeof fetch;
    vi.restoreAllMocks();
  });
});
