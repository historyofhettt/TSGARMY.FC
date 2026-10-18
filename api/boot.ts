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

const app = new Hono<{ Bindings: HttpBindings }>();

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
        const result = await getOgMetaForPath(path);
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
          const meta = buildMetaTagsHtml(result.tags);
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

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, () => {
    console.log(`Server running on http://0.0.0.0:${port}/`);
  });
  startNotificationScheduler();
} else {
  // Dev mode: also start the scheduler so scheduled announcements publish.
  startNotificationScheduler();
}
