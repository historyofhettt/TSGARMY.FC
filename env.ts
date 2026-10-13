import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

function optional(name: string): string {
  return process.env[name] ?? "";
}

export const env = {
  appId: required("APP_ID"),
  appSecret: required("APP_SECRET"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: required("DATABASE_URL"),
  googleClientId: optional("GOOGLE_CLIENT_ID"),
  googleClientSecret: optional("GOOGLE_CLIENT_SECRET"),
  googleRedirectUri: required("GOOGLE_REDIRECT_URI"),
  discordClientId: optional("DISCORD_CLIENT_ID"),
  discordClientSecret: optional("DISCORD_CLIENT_SECRET"),
  discordRedirectUri: required("DISCORD_REDIRECT_URI"),
  ownerGoogleEmail: optional("OWNER_GOOGLE_EMAIL"),
  ownerDiscordId: optional("OWNER_DISCORD_ID"),
  resendApiKey: optional("RESEND_API_KEY"),
  emailFrom: optional("EMAIL_FROM"),
};

if (env.isProduction) {
  if (!env.googleClientId) {
    console.warn("[env] GOOGLE_CLIENT_ID is not set — Google OAuth will be disabled.");
  }
  if (!env.googleClientSecret) {
    console.warn("[env] GOOGLE_CLIENT_SECRET is not set — Google OAuth will be disabled.");
  }
  if (!env.discordClientId) {
    console.warn("[env] DISCORD_CLIENT_ID is not set — Discord OAuth will be disabled.");
  }
  if (!env.discordClientSecret) {
    console.warn("[env] DISCORD_CLIENT_SECRET is not set — Discord OAuth will be disabled.");
  }
}
