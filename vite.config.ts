import devServer from "@hono/vite-dev-server"
import path, { dirname } from "path"
import { fileURLToPath } from "url"
import { type Plugin } from "vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const __dirname = dirname(fileURLToPath(import.meta.url))

function ogMetaDevMiddleware(): Plugin {
  return {
    name: "og-meta-dev",
    async configureServer(server) {
      const botRegex = /discordbot|Twitterbot|facebookexternalhit|Instagram|FBIOS|WhatsApp|TelegramBot|LinkedInBot|Slackbot|Googlebot|Google-InspectionTool|Bingbot|SemrushBot|AhrefsBot|Slack-LinkExpanding/i;

      server.middlewares.use(async (req: { url?: string; headers: Record<string, string | string[] | undefined> }, _res: { writeHead: (code: number, headers: Record<string, string>) => void; end: (data: string) => void }, next: () => void) => {
        const ua = (req.headers["user-agent"] as string | undefined) ?? "";
        const accept = (req.headers["accept"] as string | undefined) ?? "";

        if (ua && botRegex.test(ua) && accept && accept.includes("text/html")) {
          try {
            const url = new URL(req.url || "", "http://localhost:3000");
            const pathname = url.pathname;
            if (pathname.startsWith("/api/")) {
              return next();
            }

            const { getOgMetaForPath, buildMetaTagsHtml, stripDefaultOgTags } = await import("./api/og-meta.ts");
            const result = await getOgMetaForPath(pathname);
            if (!result.skip) {
              const fs = await import("fs");
              const indexPath = path.resolve(__dirname, "index.html");
              let html = fs.readFileSync(indexPath, "utf-8");
              html = stripDefaultOgTags(html);
              const meta = buildMetaTagsHtml(result.tags, { origin: "http://localhost:3000" });
              const marker = "<title>";
              const idx = html.indexOf(marker);
              if (idx !== -1) {
                html = html.slice(0, idx) + meta + "\n    " + html.slice(idx);
              }

              _res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
              _res.end(html);
              return;
            }
          } catch (err) {
            console.error("[og-meta-dev] error:", err);
          }
        }
        return next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    ogMetaDevMiddleware(),
    devServer({ entry: "api/boot.ts", exclude: [/^\/(?!api\/).*$/] }),
    react()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@contracts": path.resolve(__dirname, "./contracts"),
      "@db": path.resolve(__dirname, "./db"),
      "db": path.resolve(__dirname, "./db"),
    },
  },
  envDir: path.resolve(__dirname),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
});
