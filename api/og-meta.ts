import { drizzle } from "drizzle-orm/mysql2";
import { env } from "./lib/env";
import { eq, and } from "drizzle-orm";
import * as schema from "../db/schema";
import * as relations from "../db/relations";

const fullSchema = { ...schema, ...relations };
const db = drizzle(env.databaseUrl, {
  mode: "planetscale",
  schema: fullSchema,
});

let signKeysCache: ((keys: (string | null | undefined)[]) => Promise<Record<string, string>>) | null = null;

async function signKeys(keys: (string | null | undefined)[]): Promise<Record<string, string>> {
  if (!signKeysCache) {
    signKeysCache = (await import("./lib/images")).signKeys;
  }
  return signKeysCache(keys);
}

export interface MetaTags {
  title: string;
  description: string;
  image: string | null;
  type: string;
  canonicalPath: string;
  siteName?: string;
}

function resolveSiteUrl(path: string): string {
  const base = env.siteUrl || "";
  if (base) {
    return base.replace(/\/+$/, "") + path;
  }
  return path;
}

function resolveImageUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return resolveSiteUrl(url);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

export function stripDefaultOgTags(html: string): string {
  return html
    .replace(/<meta\s+property=["']og:title["'][^>]*\/>\s*/gi, "")
    .replace(/<meta\s+name=["']description["'][^>]*\/>\s*/gi, "")
    .replace(/<meta\s+property=["']og:description["'][^>]*\/>\s*/gi, "")
    .replace(/<meta\s+property=["']og:type["'][^>]*\/>\s*/gi, "")
    .replace(/<meta\s+property=["']og:image["'][^>]*\/>\s*/gi, "")
    .replace(/<meta\s+property=["']og:image:width["'][^>]*\/>\s*/gi, "")
    .replace(/<meta\s+property=["']og:image:height["'][^>]*\/>\s*/gi, "")
    .replace(/<meta\s+name=["']twitter:card["'][^>]*\/>\s*/gi, "")
    .replace(/<meta\s+name=["']twitter:title["'][^>]*\/>\s*/gi, "")
    .replace(/<meta\s+name=["']twitter:description["'][^>]*\/>\s*/gi, "")
    .replace(/<meta\s+name=["']twitter:image["'][^>]*\/>\s*/gi, "")
    .replace(/<meta\s+name=["']twitter:image:alt["'][^>]*\/>\s*/gi, "")
    .replace(/<meta\s+property=["']og:site_name["'][^>]*\/>\s*/gi, "")
    .replace(/<meta\s+property=["']og:url["'][^>]*\/>\s*/gi, "")
    .replace(/<meta\s+property=["']og:image:alt["'][^>]*\/>\s*/gi, "");
}

export function buildMetaTagsHtml(tags: MetaTags): string {
  const safe = (s: string) => escapeHtml(s);
  const title = safe(tags.title);
  const description = safe(tags.description);
  const image = tags.image ? safe(resolveImageUrl(tags.image) ?? tags.image) : null;
  const siteName = tags.siteName ? safe(tags.siteName) : null;
  const type = safe(tags.type);

  const lines: string[] = [];
  lines.push(`<title>${title}</title>`);
  lines.push(`<meta name="description" content="${description}" />`);
  lines.push(`<meta property="og:title" content="${title}" />`);
  lines.push(`<meta property="og:description" content="${description}" />`);
  lines.push(`<meta property="og:type" content="${type}" />`);
  lines.push(`<meta property="og:url" content="${safe(resolveSiteUrl(tags.canonicalPath))}" />`);
  if (siteName) {
    lines.push(`<meta property="og:site_name" content="${siteName}" />`);
  }
  lines.push(`<meta name="twitter:card" content="summary_large_image" />`);
  lines.push(`<meta name="twitter:title" content="${title}" />`);
  lines.push(`<meta name="twitter:description" content="${description}" />`);
  if (image) {
    lines.push(`<meta property="og:image" content="${image}" />`);
    lines.push(`<meta property="og:image:width" content="1200" />`);
    lines.push(`<meta property="og:image:height" content="630" />`);
    lines.push(`<meta property="og:image:alt" content="${description}" />`);
    lines.push(`<meta name="twitter:image" content="${image}" />`);
    lines.push(`<meta name="twitter:image:alt" content="${description}" />`);
  }
  return lines.join("\n    ");
}

async function getOrgWithLogo(): Promise<{
  name: string;
  tagline: string;
  description: string | null;
  logoUrl: string | null;
}> {
  let [org] = await db.select().from(schema.orgSettings).limit(1);
  if (!org) {
    await db.insert(schema.orgSettings).values({});
    [org] = await db.select().from(schema.orgSettings).limit(1);
  }
  const urls = await signKeys([org.logoKey].filter(Boolean) as string[]);
  const logoUrl = org.logoKey ? (urls[org.logoKey] ?? null) : null;
  return {
    name: org.orgName,
    tagline: org.tagline,
    description: org.description,
    logoUrl,
  };
}

export type OgResult =
  | { skip: false; tags: MetaTags }
  | { skip: true };

export async function getOgMetaForPath(pathname: string): Promise<OgResult> {
  let rawPath = pathname.split("?")[0].split("#")[0];
  // Normalize: strip trailing slash (except root)
  if (rawPath.length > 1) {
    rawPath = rawPath.replace(/\/+$/, "");
  }

  const segments = rawPath.split("/").filter(Boolean);

  // --- Static routes with fixed metadata ---
  const staticRoutes: Record<string, { title: string; description: string; type: string }> = {
    "/": {
      title: "TSG — Two Side Gamers | Esports Organization",
      description:
        "Built for Competition. Driven by Legacy. TSG ARMY & TSG ARTEMIS. Tournaments, rosters, live matches and player statistics.",
      type: "website",
    },
    "/teams": {
      title: "Teams — TSG",
      description: "Meet the TSG esports teams. Rosters, staff, and tournament history.",
      type: "website",
    },
    "/players": {
      title: "Players — TSG",
      description:
        "Browse all TSG players, their stats, achievements, and performance history.",
      type: "website",
    },
    "/tournaments": {
      title: "Tournaments — TSG",
      description: "All TSG tournaments — upcoming, ongoing, and completed.",
      type: "website",
    },
    "/schedule": {
      title: "Schedule & Live Matches — TSG",
      description:
        "Upcoming matches and live TSG action across all tournaments.",
      type: "website",
    },
    "/live": {
      title: "Live — TSG",
      description: "Watch TSG live streams and follow live match scores.",
      type: "website",
    },
    "/community": {
      title: "Community — TSG",
      description:
        "Join the TSG ARMY community discussions, comments, and fan interactions.",
      type: "website",
    },
    "/media": {
      title: "Media — TSG",
      description: "Photo and video galleries from TSG tournaments and events.",
      type: "website",
    },
    "/about": {
      title: "About — TSG",
      description:
        "Learn about Two Side Gamers (TSG), the esports organization behind TSG ARMY and TSG ARTEMIS.",
      type: "website",
    },
    "/leaderboard": {
      title: "Leaderboard — TSG",
      description:
        "TSG player leaderboard — kills, averages, and tournament performance rankings.",
      type: "website",
    },
  };

  // Check static route first
  if (rawPath in staticRoutes) {
    const org = await getOrgWithLogo();
    const sr = staticRoutes[rawPath];
    return {
      skip: false,
      tags: {
        title: sr.title,
        description: sr.description,
        image: org.logoUrl,
        type: sr.type,
        siteName: org.name,
        canonicalPath: rawPath,
      },
    };
  }

  // --- Dynamic routes ---
  // Teams: /teams/:slug
  if (segments.length === 2 && segments[0] === "teams") {
    const slug = segments[1];
    return getTeamMeta(slug);
  }

  // Players: /players/:slug
  if (segments.length === 2 && segments[0] === "players") {
    const slug = segments[1];
    return getPlayerMeta(slug);
  }

  // Tournaments: /tournaments/:slug
  if (segments.length === 2 && segments[0] === "tournaments") {
    const slug = segments[1];
    return getTournamentMeta(slug);
  }

  // Fan profile: /fans/:username or /u/:username
  if (segments.length === 2 && (segments[0] === "fans" || segments[0] === "u")) {
    const username = segments[1];
    return getUserMeta(username);
  }

  // Media album: /media/album/:id
  if (segments.length === 3 && segments[0] === "media" && segments[1] === "album") {
    const id = segments[2];
    return getMediaAlbumMeta(id);
  }

  // Fan spotlight: /spotlight/:id
  if (segments.length === 2 && segments[0] === "spotlight") {
    const id = segments[1];
    return getFanSpotlightMeta(id);
  }

  // Admin routes — skip (let SPA handle login/redirect)
  if (rawPath.startsWith("/admin") || rawPath === "/login" || rawPath === "/username-select") {
    return { skip: true };
  }

  // Default: skip and let SPA handle it
  return { skip: true };
}

async function getTeamMeta(slug: string): Promise<OgResult> {
  try {
    const [team] = await db.select().from(schema.teams).where(eq(schema.teams.slug, slug)).limit(1);
    if (!team) return { skip: true };

    const org = await getOrgWithLogo();
    const urls = await signKeys([team.logoKey].filter(Boolean) as string[]);
    const logoUrl = team.logoKey ? (urls[team.logoKey] ?? org.logoUrl) : org.logoUrl;

    return {
      skip: false,
      tags: {
        title: `${team.name} — TSG`,
        description: team.description
          ? `${team.name} at Two Side Gamers (TSG). ${team.description}`
          : `${team.name} — competing for TSG (Two Side Gamers). ${org.tagline}`,
        image: logoUrl,
        type: "website",
        siteName: org.name,
        canonicalPath: `/teams/${slug}`,
      },
    };
  } catch {
    return { skip: true };
  }
}

async function getPlayerMeta(slug: string): Promise<OgResult> {
  try {
    const [player] = await db.select().from(schema.players).where(eq(schema.players.slug, slug)).limit(1);
    if (!player) return { skip: true };

    const org = await getOrgWithLogo();
    const urls = await signKeys([player.photoKey].filter(Boolean) as string[]);
    const photoUrl = player.photoKey ? (urls[player.photoKey] ?? org.logoUrl) : org.logoUrl;

    const name = player.ign;
    const teamName = player.teamId ? ` — TSG` : "";

    return {
      skip: false,
      tags: {
        title: `${name}${teamName} — Player Profile | TSG`,
        description: player.bio
          ? `${player.ign} at TSG. ${player.bio.slice(0, 200)}`
          : `${player.ign} — professional player for TSG (Two Side Gamers). ${org.tagline}`,
        image: photoUrl,
        type: "profile",
        siteName: org.name,
        canonicalPath: `/players/${slug}`,
      },
    };
  } catch {
    return { skip: true };
  }
}

async function getTournamentMeta(slug: string): Promise<OgResult> {
  try {
    const [tournament] = await db.select().from(schema.tournaments).where(eq(schema.tournaments.slug, slug)).limit(1);
    if (!tournament) return { skip: true };

    const org = await getOrgWithLogo();
    const urls = await signKeys([tournament.logoKey].filter(Boolean) as string[]);
    const logoUrl = tournament.logoKey
      ? (urls[tournament.logoKey] ?? org.logoUrl)
      : org.logoUrl;

    return {
      skip: false,
      tags: {
        title: `${tournament.name} — Tournament | TSG`,
        description: tournament.description
          ? `${tournament.name}: ${tournament.description.slice(0, 200)}`
          : `${tournament.name} — tournament organized by TSG (Two Side Gamers). ${org.tagline}`,
        image: logoUrl,
        type: "website",
        siteName: org.name,
        canonicalPath: `/tournaments/${slug}`,
      },
    };
  } catch {
    return { skip: true };
  }
}

async function getUserMeta(username: string): Promise<OgResult> {
  try {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1);
    if (!user) return { skip: true };

    const org = await getOrgWithLogo();
    const displayName = user.name ?? user.username ?? "";

    return {
      skip: false,
      tags: {
        title: `${displayName} (@${user.username}) — TSG Fan Profile`,
        description: user.bio
          ? `${displayName}: ${user.bio.slice(0, 200)}`
          : `${displayName} — TSG fan profile. ${org.tagline}`,
        image: org.logoUrl,
        type: "profile",
        siteName: org.name,
        canonicalPath: `/fans/${user.username}`,
      },
    };
  } catch {
    return { skip: true };
  }
}

async function getMediaAlbumMeta(idStr: string): Promise<OgResult> {
  try {
    const id = parseInt(idStr, 10);
    if (isNaN(id)) return { skip: true };

    const [album] = await db.select().from(schema.mediaAlbums).where(eq(schema.mediaAlbums.id, id)).limit(1);
    if (!album) return { skip: true };

    const org = await getOrgWithLogo();
    const urls = await signKeys(
      album.coverKey ? [album.coverKey] : [],
    );
    const coverUrl = album.coverKey
      ? (urls[album.coverKey] ?? org.logoUrl)
      : org.logoUrl;

    return {
      skip: false,
      tags: {
        title: `${album.title} — Photo Gallery | TSG`,
        description: album.description
          ? `${album.title}: ${album.description.slice(0, 200)}`
          : `${album.title} photo gallery from TSG (Two Side Gamers).`,
        image: coverUrl,
        type: "website",
        siteName: org.name,
        canonicalPath: `/media/album/${id}`,
      },
    };
  } catch {
    return { skip: true };
  }
}

async function getFanSpotlightMeta(idStr: string): Promise<OgResult> {
  try {
    const id = parseInt(idStr, 10);
    if (isNaN(id)) return { skip: true };

    const [spotlight] = await db
      .select()
      .from(schema.fanSpotlight)
      .where(and(eq(schema.fanSpotlight.id, id), eq(schema.fanSpotlight.isApproved, true)))
      .limit(1);
    if (!spotlight) return { skip: true };

    const org = await getOrgWithLogo();
    const urls = await signKeys(
      spotlight.thumbnailKey ? [spotlight.thumbnailKey] : [],
    );
    const imageUrl = spotlight.thumbnailKey
      ? (urls[spotlight.thumbnailKey] ?? org.logoUrl)
      : (spotlight.thumbnailUrl ?? org.logoUrl);

    return {
      skip: false,
      tags: {
        title: `${spotlight.title} — Fan Spotlight | TSG`,
        description: spotlight.description
          ? `${spotlight.description.slice(0, 200)}`
          : `${spotlight.title} — featured in TSG Fan Spotlight.`,
        image: imageUrl,
        type: "article",
        siteName: org.name,
        canonicalPath: `/spotlight/${spotlight.id}`,
      },
    };
  } catch {
    return { skip: true };
  }
}
