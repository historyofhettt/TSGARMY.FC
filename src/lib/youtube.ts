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

/** Generate a YouTube embed URL (for previews). */
export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`;
}
