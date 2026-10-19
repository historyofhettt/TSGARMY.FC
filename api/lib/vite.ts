import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs";
import path from "path";

type App = Hono<{ Bindings: HttpBindings }>;

function isLikelyBot(userAgent: string): boolean {
  return /discordbot|Twitterbot|facebookexternalhit|Instagram|FBIOS|WhatsApp|TelegramBot|LinkedInBot|Slackbot|Googlebot|Google-InspectionTool|Bingbot|SemrushBot|AhrefsBot|Slack-LinkExpanding/i.test(
    userAgent,
  );
}

export function serveStaticFiles(app: App) {
  const distPath = path.resolve(import.meta.dirname, "../dist/public");

  app.use("*", serveStatic({ root: "./dist/public" }));

  app.notFound(async (c) => {
    const accept = c.req.header("accept") ?? "";

    // Non-HTML paths (robots.txt, sitemap.xml, JSON API routes, etc.)
    // should always get a 404, never an HTML SPA fallback.
    const reqPath = c.req.path.split("?")[0];
    const isHtmlRoute =
      reqPath === "/" ||
      reqPath === "/teams" ||
      reqPath === "/players" ||
      reqPath === "/tournaments" ||
      reqPath === "/schedule" ||
      reqPath === "/live" ||
      reqPath === "/community" ||
      reqPath === "/media" ||
      reqPath === "/about" ||
      reqPath === "/leaderboard" ||
      reqPath === "/cards" ||
      reqPath === "/rewards" ||
      reqPath === "/spotlight" ||
      reqPath === "/fan" ||
      reqPath === "/profile" ||
      reqPath === "/notifications" ||
      reqPath === "/login" ||
      reqPath === "/collection";

    // Dynamic routes — anything starting with a known prefix
    const isDynamicRoute =
      reqPath.startsWith("/teams/") ||
      reqPath.startsWith("/players/") ||
      reqPath.startsWith("/tournaments/") ||
      reqPath.startsWith("/fans/") ||
      reqPath.startsWith("/u/") ||
      reqPath.startsWith("/media/album/") ||
      reqPath.startsWith("/spotlight/");

    if (!isHtmlRoute && !isDynamicRoute) {
      return c.json({ error: "Not Found" }, 404);
    }

    if (!accept.includes("text/html")) {
      return c.json({ error: "Not Found" }, 404);
    }

    const indexPath = path.resolve(distPath, "index.html");
    let content = fs.readFileSync(indexPath, "utf-8");

    const ua = c.req.header("user-agent") ?? "";
    if (isLikelyBot(ua)) {
      try {
        const path_ = c.req.path.split("?")[0];
        if (!path_.startsWith("/api/")) {
          const { getOgMetaForPath, buildMetaTagsHtml, stripDefaultOgTags } = await import("../og-meta");
          const proto = c.req.header("x-forwarded-proto") || (c.req.header("x-forwarded-host") ? "https" : "http");
          const host = c.req.header("x-forwarded-host") || c.req.header("host") || "";
          const origin = host ? `${proto}://${host}` : undefined;

          const result = await getOgMetaForPath(path_, { origin });
          if (!result.skip) {
            content = stripDefaultOgTags(content);

            const meta = buildMetaTagsHtml(result.tags, { origin });
            const marker = "<title>";
            const idx = content.indexOf(marker);
            if (idx !== -1) {
              content = content.slice(0, idx) + meta + "\n    " + content.slice(idx);
            }
          }
        }
      } catch (err) {
        console.error("[og-meta] error:", err);
      }
    }

    c.header("Content-Type", "text/html; charset=utf-8");
    return c.body(content);
  });
}
