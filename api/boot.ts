import { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { createGoogleCallbackHandler } from "./google/auth";
import { createUsernameSelectHandler } from "./oauth/username";
import { Paths } from "@contracts/constants";
import { runNotificationScheduler } from "./queries/notifications";
import { getDb } from "./queries/connection";
import * as schema from "../db/schema";
import { eq } from "drizzle-orm";
import { slugify } from "./admin-router";

const app = new Hono<{ Bindings: HttpBindings }>();

// --- Startup data migration: sync player slugs to current IGNs ---
// Many players have slugs derived from previous usernames (e.g., TSG VORTEX → tsg-vortex).
// This script updates each player's slug to match their current IGN and preserves
// the old slug as a redirect, so shared links don't break.
// Runs idempotently on every server startup.
async function runPlayerSlugMigration() {
  try {
    const db = getDb();

    // Fetch all players
    const allPlayers = await db
      .select({ id: schema.players.id, ign: schema.players.ign, slug: schema.players.slug })
      .from(schema.players);

    // Compute expected slug for each player and collect updates
    interface SlugUpdate {
      id: number;
      oldSlug: string;
      newSlug: string;
    }
    const updates: SlugUpdate[] = [];

    // Track which expected slugs are already taken by players that don't need updating
    const takenSlugs = new Set<string>();
    for (const p of allPlayers) {
      const expectedSlug = slugify(p.ign);
      if (p.slug === expectedSlug) {
        takenSlugs.add(expectedSlug);
      }
    }

    // Collect needed updates, handling conflicts where multiple players want the same new slug
    const claimedSlugs = new Map<string, number>(); // newSlug → playerId
    for (const p of allPlayers) {
      const expectedSlug = slugify(p.ign);
      if (p.slug === expectedSlug) continue;

      if (takenSlugs.has(expectedSlug) || claimedSlugs.has(expectedSlug)) {
        // Conflict: slug is already taken by a player that doesn't need updating,
        // or by another player that also needs updating. Skip (can't safely resolve).
        continue;
      }
      takenSlugs.add(expectedSlug);
      claimedSlugs.set(expectedSlug, p.id);
      updates.push({ id: p.id, oldSlug: p.slug, newSlug: expectedSlug });
    }

    if (updates.length === 0) {
      return;
    }

    // Sort to handle the case where one player's old slug is another's new slug.
    // e.g., Player A (slug=tsg-nova) wants tsg-dips, Player B (slug=tsg-novaa) wants tsg-nova.
    // We must update Player A first so that tsg-nova is free for Player B.
    const sortedUpdates = updates.sort((a, b) => {
      if (a.newSlug === b.oldSlug) return 1;   // B's old == A's new → B first
      if (b.newSlug === a.oldSlug) return -1;  // A's old == B's new → A first
      return 0;
    });

    // Use a transaction for atomicity
    await db.transaction(async (tx) => {
      for (const update of sortedUpdates) {
        // Insert old slug as a redirect (upsert)
        await tx
          .insert(schema.playerSlugRedirects)
          .values({ oldSlug: update.oldSlug, playerId: update.id })
          .onDuplicateKeyUpdate({ set: { playerId: update.id } });

        // Update the player's slug
        await tx
          .update(schema.players)
          .set({ slug: update.newSlug })
          .where(eq(schema.players.id, update.id));
      }
    });

    console.log(`[migration] Updated ${updates.length} player slugs to match current IGNs:`,
      updates.map(u => `${u.oldSlug}→${u.newSlug}`));
  } catch (err) {
    console.error("[migration] Player slug sync failed:", err);
  }
}

// Security headers middleware
app.use(async (c, next) => {
  await next();
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("X-Frame-Options", "DENY");
  c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  c.res.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletag.com https://www.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; connect-src 'self' https://api.github.com; frame-src https://www.youtube.com https://www.google.com;",
  );
  if (env.isProduction) {
    c.res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
});

// Temporary request logging middleware — REMOVE BEFORE PRODUCTION
// Logs method, path, user-agent, cf-ray (if present), and response status
// Does NOT log cookies, tokens, passwords, or personal data.
app.use(async (c, next) => {
  const method = c.req.method;
  const path = c.req.path;
  const ua = c.req.header("user-agent") ?? "-";
  const cfRayReq = c.req.header("cf-ray") ?? "";
  await next();
  const cfRayRes = c.res.headers.get("cf-ray") ?? cfRayReq;
  console.log(`[reqlog] ${method} ${path} | UA: ${ua} | CF-Ray: ${cfRayRes || "-"} | Status: ${c.res.status}`);
});

// Body size limit — compatible with @hono/vite-dev-server (which wraps
// the raw Request in a way that breaks hono's bodyLimit middleware and
// makes `new Request(raw, ...)` throw in dev mode).
const MAX_BODY_BYTES = 50 * 1024 * 1024;
app.use(async (c, next) => {
  const raw = c.req.raw;
  if (raw.method === "GET" || raw.method === "HEAD" || !raw.body) {
    return next();
  }
  const hasTransferEncoding = raw.headers.has("transfer-encoding");
  const hasContentLength = raw.headers.has("content-length");
  if (hasContentLength && !hasTransferEncoding) {
    const contentLength = parseInt(raw.headers.get("content-length") || "0", 10);
    if (contentLength > MAX_BODY_BYTES) {
      return c.json({ error: "Payload Too Large" }, 413);
    }
    return next();
  }
  // Chunked/streamed body: the dev server's Request wrapper cannot be
  // reconstructed with `new Request(...)`, so we cannot re-wrap the body
  // after measuring it. Enforce the limit via content-length when present;
  // otherwise pass through (tRPC reads the body itself).
  return next();
});
app.get(Paths.googleCallback, createGoogleCallbackHandler());
app.post("/api/oauth/username", createUsernameSelectHandler());

app.get("/api/media/download/*", async (c) => {
  const { storage, guessContentType } = await import("./lib/storage");
  const fileKey = c.req.path.split("/api/media/download/")[1];
  if (!fileKey) return c.json({ error: "Missing file key" }, 400);
  const bytes = await storage.readBytes(fileKey);
  if (!bytes) return c.json({ error: "File not found" }, 404);
  const name = fileKey.split("/").pop() ?? "download";
  const ct = guessContentType(name);
  return new Response(bytes, {
    headers: {
      "Content-Type": ct,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
});

app.get("/api/media/view/*", async (c) => {
  const { storage, guessContentType } = await import("./lib/storage");
  const fileKey = c.req.path.split("/api/media/view/")[1];
  if (!fileKey) return c.json({ error: "Missing file key" }, 400);
  const bytes = await storage.readBytes(fileKey);
  if (!bytes) return c.json({ error: "File not found" }, 404);
  const name = fileKey.split("/").pop() ?? "file";
  const ct = guessContentType(name);
  return new Response(bytes, {
    headers: {
      "Content-Type": ct,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "public, max-age=86400",
    },
  });
});

app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    req: c.req.raw,
    router: appRouter,
    createContext,
    endpoint: "/api/trpc",
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

// --- Link preview / OG metadata ---
// For non-API HTML routes, serve index.html with dynamic OG metadata
// when a known crawler bot requests the page.
const BOT_PATTERNS = [
  /discordbot/i,
  /Twitterbot/i,
  /facebookexternalhit/i,
  /Meta-External-Agent/i,
  /Instagram/i,
  /FBIOS/i,
  /WhatsApp/i,
  /TelegramBot/i,
  /LinkedInBot/i,
  /Slackbot/i,
  /Googlebot/i,
  /Google-InspectionTool/i,
  /Bingbot/i,
  /SemrushBot/i,
  /AhrefsBot/i,
  /Slack-LinkExpanding/i,
];

function isLikelyBot(userAgent: string): boolean {
  return BOT_PATTERNS.some((p) => p.test(userAgent));
}

app.get("/*", async (c, next) => {
  const accept = c.req.header("accept") ?? "";
  const ua = c.req.header("user-agent") ?? "";

  // Only intercept HTML requests from known bots
  if (accept.includes("text/html") && isLikelyBot(ua)) {
    const path = c.req.path;
    if (!path.startsWith("/api/")) {
      try {
        const { getOgMetaForPath, buildMetaTagsHtml, stripDefaultOgTags } = await import("./og-meta");
        const proto = c.req.header("x-forwarded-proto") || (c.req.header("x-forwarded-host") ? "https" : "http");
        const host = c.req.header("x-forwarded-host") || c.req.header("host") || "";
        const origin = host ? `${proto}://${host}` : undefined;

        const result = await getOgMetaForPath(path, { origin });
        if (!result.skip) {
          const fs = await import("fs");
          const path_ = (await import("path")).default;
          let html: string;
          if (env.isProduction) {
            const distPath = path_.resolve(import.meta.dirname, "../dist/public");
            html = fs.readFileSync(path_.resolve(distPath, "index.html"), "utf-8");
          } else {
            const srcPath = path_.resolve(import.meta.dirname, "../index.html");
            html = fs.readFileSync(srcPath, "utf-8");
          }
          html = stripDefaultOgTags(html);

          const meta = buildMetaTagsHtml(result.tags, { origin });
          const marker = "<title>";
          const idx = html.indexOf(marker);
          if (idx !== -1) {
            html = html.slice(0, idx) + meta + "\n    " + html.slice(idx);
          }
          c.header("Content-Type", "text/html; charset=utf-8");
          return c.body(html);
        }
      } catch (err) {
        console.error("[og-meta] error:", err);
      }
    }
  }
  return next();
});

export default app;

// Background scheduler: publish due scheduled announcements.
// Runs independently of any admin page being open.
let schedulerTimer: ReturnType<typeof setInterval> | null = null;
function startNotificationScheduler() {
  if (schedulerTimer) return;
  const tick = async () => {
    try {
      const result = await runNotificationScheduler();
      if (result.published > 0) {
        console.log(`[notifications] published ${result.published} scheduled announcement(s)`);
      }
    } catch (err) {
      console.error("[notifications] scheduler error", err);
    }
  };
  // Run immediately, then every 30 seconds.
  void tick();
  schedulerTimer = setInterval(tick, 30_000);
}

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  void runPlayerSlugMigration();

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, () => {
    console.log(`Server running on http://0.0.0.0:${port}/`);
  });
  startNotificationScheduler();
} else {
  // Dev mode: also start the scheduler so scheduled announcements publish.
  startNotificationScheduler();
}
