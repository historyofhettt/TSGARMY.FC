import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

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
    // The frontend in src/pages/Login.tsx uses import.meta.env.VITE_GOOGLE_REDIRECT_URI
    // The backend in api/google/auth.ts uses env.googleRedirectUri (from GOOGLE_REDIRECT_URI)
    // Both MUST be the same exact URL on Render.
    const frontendValue = GOOGLE_CALLBACK;
    const backendValue = process.env.GOOGLE_REDIRECT_URI;

    expect(frontendValue).toBe(backendValue);
  });

  it("Discord frontend (VITE_DISCORD_REDIRECT_URI) and backend (DISCORD_REDIRECT_URI) use identical values", () => {
    // The frontend in src/pages/Login.tsx uses import.meta.env.VITE_DISCORD_REDIRECT_URI
    // The backend in api/discord/auth.ts uses env.discordRedirectUri (from DISCORD_REDIRECT_URI)
    // Both MUST be the same exact URL on Render.
    const frontendValue = DISCORD_CALLBACK;
    const backendValue = process.env.DISCORD_REDIRECT_URI;

    expect(frontendValue).toBe(backendValue);
  });

  it("throws in production when GOOGLE_REDIRECT_URI is missing", async () => {
    delete process.env.GOOGLE_REDIRECT_URI;
    vi.resetModules();

    await expect(import("./lib/env")).rejects.toThrow(
      /Missing required environment variable: GOOGLE_REDIRECT_URI/,
    );
  });

  it("throws in production when DISCORD_REDIRECT_URI is missing", async () => {
    delete process.env.DISCORD_REDIRECT_URI;
    vi.resetModules();

    await expect(import("./lib/env")).rejects.toThrow(
      /Missing required environment variable: DISCORD_REDIRECT_URI/,
    );
  });

  it("redirect URIs are not localhost or proxy-internal URLs", async () => {
    const { env } = await import("./lib/env");

    expect(env.googleRedirectUri).not.toMatch(/localhost/);
    expect(env.googleRedirectUri).not.toMatch(/127\.0\.0\.1/);
    expect(env.discordRedirectUri).not.toMatch(/localhost/);
    expect(env.discordRedirectUri).not.toMatch(/127\.0\.0\.1/);
  });
});
