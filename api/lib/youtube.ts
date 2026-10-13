/**
 * YouTube helper — extract video ID from a URL and resolve thumbnail URLs.
 * No external API keys required; uses YouTube's public thumbnail endpoints.
 */

export interface YouTubeThumbnail {
  videoId: string;
  thumbnails: {
    default: string;
    mqdefault: string;
    hqdefault: string;
    sddefault: string;
    maxresdefault: string;
  };
  watchUrl: string;
}

/** Extract a YouTube video ID from various URL formats or a bare ID. */
export function extractYouTubeVideoId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // Bare 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);

    // youtu.be/<id>
    if (url.hostname === "youtu.be") {
      return url.pathname.slice(1) || null;
    }

    // youtube.com/watch?v=<id> or youtu.be with query
    if (url.hostname.includes("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v) return v;

      // youtu.be/embed/<id>, youtube.com/embed/<id>,
      // youtube.com/v/<id>, youtube.com/live/<id>
      const parts = url.pathname.split("/");
      const idx = parts.findIndex((p) => ["embed", "v", "live", "shorts"].includes(p));
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    }
  } catch {
    // not a URL
  }

  return null;
}

/** Get the best available thumbnail URL for a video ID. */
async function checkUrlExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Resolve thumbnail URLs for a YouTube video.
 * Returns the best thumbnail available (maxresdefault preferred, then hqdefault).
 */
export async function getYouTubeThumbnails(videoId: string): Promise<YouTubeThumbnail> {
  const base = "https://i.ytimg.com";
  const ids = ["maxresdefault", "sddefault", "hqdefault", "mqdefault", "default"] as const;

  const thumbnails = {
    default: `${base}/vi/${videoId}/default.jpg`,
    mqdefault: `${base}/vi/${videoId}/mqdefault.jpg`,
    hqdefault: `${base}/vi/${videoId}/hqdefault.jpg`,
    sddefault: `${base}/vi/${videoId}/sddefault.jpg`,
    maxresdefault: `${base}/vi/${videoId}/maxresdefault.jpg`,
  };

  // Check which thumbnails actually exist, preferring higher-res ones
  let best = thumbnails.hqdefault;
  for (const id of ids) {
    if (await checkUrlExists(thumbnails[id])) {
      best = thumbnails[id];
      break;
    }
  }

  return {
    videoId,
    thumbnails,
    watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
    // @ts-ignore - we add a helper field
    best: best,
  };
}

/**
 * Parse a user-provided value that may be a YouTube URL, embed URL, or bare ID,
 * and return the normalized result.
 */
export async function resolveYouTubeVideo(input: string): Promise<YouTubeThumbnail | null> {
  const videoId = extractYouTubeVideoId(input);
  if (!videoId) return null;
  return getYouTubeThumbnails(videoId);
}

/** Generate a YouTube embed URL (for previews). */
export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`;
}

/** Generate a YouTube live thumbnail URL (for live streams). */
export function youtubeLiveThumbnailUrl(videoId: string, live: boolean = false): string {
  if (live) {
    // YouTube doesn't have a direct live thumbnail endpoint, but the hqdefault
    // is updated to the current live frame during a live stream.
    return `https://i.ytimg.com/vi/${videoId}/hqdefault_live.jpg`;
  }
  return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
}
