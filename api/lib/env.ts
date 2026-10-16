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
  googleRedirectUri: optional("GOOGLE_REDIRECT_URI") || optional("VITE_GOOGLE_REDIRECT_URI"),
  discordClientId: optional("DISCORD_CLIENT_ID"),
  discordClientSecret: optional("DISCORD_CLIENT_SECRET"),
  discordRedirectUri: optional("DISCORD_REDIRECT_URI") || optional("VITE_DISCORD_REDIRECT_URI"),
  ownerGoogleEmail: optional("OWNER_GOOGLE_EMAIL"),
  ownerDiscordId: optional("OWNER_DISCORD_ID"),
  resendApiKey: optional("RESEND_API_KEY"),
  emailFrom: optional("EMAIL_FROM"),
  awsAccessKeyId: optional("AWS_ACCESS_KEY_ID"),
  awsSecretAccessKey: optional("AWS_SECRET_ACCESS_KEY"),
  awsRegion: optional("AWS_REGION") || optional("S3_REGION") || "us-east-1",
  s3Bucket: optional("S3_BUCKET"),
  s3Endpoint: optional("S3_ENDPOINT"),
  s3ForcePathStyle: optional("S3_FORCE_PATH_STYLE") === "true",
  cdnBaseUrl: optional("CDN_BASE_URL"),
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
  if (!env.resendApiKey) {
    console.warn("[env] RESEND_API_KEY is not set — email features disabled.");
  }
  if (!env.s3Bucket) {
    console.warn("[env] S3_BUCKET is not set — media uploads will use local filesystem (ephemeral on Render).");
  }
}

export const s3Enabled = !!(
  env.s3Bucket &&
  env.awsAccessKeyId &&
  env.awsSecretAccessKey
);

export function checkS3Enabled(): boolean {
  return !!(
    env.s3Bucket &&
    env.awsAccessKeyId &&
    env.awsSecretAccessKey
  );
}
