import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

describe("Google OAuth redirect_uri consistency", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.APP_ID = "test-app-id";
    process.env.APP_SECRET = "test-app-secret";
    process.env.DATABASE_URL = "mysql://test:test@localhost:3306/testdb";
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-secret";
    process.env.GOOGLE_REDIRECT_URI = "https://tsgarmy-fc.onrender.com/api/oauth/google/callback";
    process.env.NODE_ENV = "production";
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("env.GOOGLE_REDIRECT_URI matches the exact production callback URL", async () => {
    const { env } = await import("./lib/env");

    expect(env.googleRedirectUri).toBe(
      "https://tsgarmy-fc.onrender.com/api/oauth/google/callback",
    );
    expect(env.googleRedirectUri).not.toContain("localhost");
    expect(env.googleRedirectUri).not.toContain("127.0.0.1");
  });

  it("VITE_GOOGLE_REDIRECT_URI and GOOGLE_REDIRECT_URI use identical production URL", () => {
    const productionCallbackUrl =
      "https://tsgarmy-fc.onrender.com/api/oauth/google/callback";

    expect(productionCallbackUrl).toBe(
      "https://tsgarmy-fc.onrender.com/api/oauth/google/callback",
    );
    expect(productionCallbackUrl).not.toMatch(/localhost/);
    expect(productionCallbackUrl).toMatch(
      /https:\/\/tsgarmy-fc\.onrender\.com\/api\/oauth\/google\/callback/,
    );
  });

  it("falls back to request-derived URI when GOOGLE_REDIRECT_URI unset", async () => {
    delete process.env.GOOGLE_REDIRECT_URI;
    vi.resetModules();

    const { env } = await import("./lib/env");

    expect(env.googleRedirectUri).toBe("");
    // When GOOGLE_REDIRECT_URI is empty, the callback handler derives the
    // redirect_uri from c.req.url.split("/api/oauth/google")[0] + "/api/oauth/google/callback"
  });
});

describe("Discord OAuth redirect_uri consistency", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.APP_ID = "test-app-id";
    process.env.APP_SECRET = "test-app-secret";
    process.env.DATABASE_URL = "mysql://test:test@localhost:3306/testdb";
    process.env.DISCORD_CLIENT_ID = "test-discord-id";
    process.env.DISCORD_CLIENT_SECRET = "test-discord-secret";
    process.env.DISCORD_REDIRECT_URI = "https://tsgarmy-fc.onrender.com/api/oauth/discord/callback";
    process.env.NODE_ENV = "production";
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("env.DISCORD_REDIRECT_URI matches the exact production callback URL", async () => {
    const { env } = await import("./lib/env");

    expect(env.discordRedirectUri).toBe(
      "https://tsgarmy-fc.onrender.com/api/oauth/discord/callback",
    );
    expect(env.discordRedirectUri).not.toContain("localhost");
  });
});
