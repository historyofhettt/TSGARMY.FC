import { useState } from "react";
import { Upload, Youtube, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { extractYouTubeVideoId } from "@/lib/youtube";
import { cn } from "@/lib/utils";

function YouTubeThumbnailPreview({ videoId, onSelect }: { videoId: string; onSelect: (url: string) => void }) {
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const thumbs = [
    { label: "default", url: `https://i.ytimg.com/vi/${videoId}/default.jpg` },
    { label: "mqdefault", url: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` },
    { label: "hqdefault", url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` },
    { label: "sddefault", url: `https://i.ytimg.com/vi/${videoId}/sddefault.jpg` },
    { label: "maxresdefault", url: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg` },
  ];
  return (
    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {thumbs.map((t) => (
        <div key={t.label} className="flex flex-col items-center gap-1">
          <div className="relative h-16 w-28 overflow-hidden rounded border">
            <img
              src={t.url}
              alt={t.label}
              onLoad={() => setLoaded((p) => ({ ...p, [t.label]: true }))}
              onError={() => setLoaded((p) => ({ ...p, [t.label]: false }))}
              className={cn("h-full w-full object-cover", loaded[t.label] ? "opacity-100" : "opacity-0")}
            />
            {!loaded[t.label] && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                Loading...
              </div>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={() => onSelect(t.label)} className="text-xs">
            Use {t.label}
          </Button>
        </div>
      ))}
    </div>
  );
}

export function HighlightUpload({ playerId, playerUserId, onUploaded }: { playerId: number; playerUserId?: number | null; onUploaded?: () => void }) {
  const { user, isAdmin } = useAuth();
  const utils = trpc.useUtils();

   const isAuthenticated = !!user;
   const canUpload = isAuthenticated && (isAdmin || playerUserId === user?.id);

   const [videoType, setVideoType] = useState<"youtube" | "upload">("youtube");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileContentType, setFileContentType] = useState<string | null>(null);
  const [thumbnailKey, setThumbnailKey] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);

  const [resolvedVideoId, setResolvedVideoId] = useState<string | null>(null);
  const [showThumbPicker, setShowThumbPicker] = useState(false);

  const createMut = trpc.highlights.create.useMutation({
    onSuccess: () => {
      utils.highlights.listByPlayer.invalidate({ playerId });
      onUploaded?.();
      resetForm();
      toast.success("Highlight submitted! It's now live.");
    },
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setVideoType("youtube");
    setTitle("");
    setDescription("");
    setYoutubeUrl("");
    setFileBase64(null);
    setFileName(null);
    setFileContentType(null);
    setThumbnailKey(null);
    setThumbnailUrl(null);
    setVideoPreview(null);
    setResolvedVideoId(null);
    setShowThumbPicker(false);
  }

  const handleYouTubeUrlChange = (val: string) => {
    setYoutubeUrl(val);
    const id = extractYouTubeVideoId(val);
    setResolvedVideoId(id);
    if (!thumbnailKey && id) {
      setShowThumbPicker(true);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 100 * 1024 * 1024) {
      toast.error("Video is too large. Maximum size is 100 MB.");
      return;
    }
    const type = f.type || "video/mp4";
    if (!type.startsWith("video/")) {
      toast.error("Please upload a valid video file (MP4, WebM, etc.).");
      return;
    }
    f.arrayBuffer().then((buf) => {
      const base64 = btoa(new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), ""));
      setFileBase64(base64);
      setFileName(f.name);
      setFileContentType(type);
      setVideoPreview(URL.createObjectURL(f));
    });
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error("Title is required.");
      return;
    }
    if (videoType === "youtube" && !youtubeUrl) {
      toast.error("YouTube URL is required.");
      return;
    }
    if (videoType === "upload" && !fileBase64) {
      toast.error("Please upload a video file.");
      return;
    }

    createMut.mutate({
      playerId,
      title: title.trim(),
      description: description.trim() || undefined,
      videoType,
      youtubeUrl: videoType === "youtube" ? youtubeUrl.trim() : undefined,
      fileBase64: videoType === "upload" ? fileBase64 : undefined,
      fileName: videoType === "upload" ? fileName : undefined,
      fileContentType: videoType === "upload" ? fileContentType : undefined,
      thumbnailKey: thumbnailKey ?? undefined,
    });
  };

  if (!canUpload) {
    return null;
  }

  return (
    <div className="glass rounded-xl p-6">
      <h3 className="font-display text-xl font-bold">Upload a Highlight</h3>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setVideoType("youtube")}
          className={cn(
            "flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition",
            videoType === "youtube"
              ? "border-[hsl(var(--tsg-blue))] bg-[hsl(var(--tsg-blue)/0.1)] text-[hsl(var(--tsg-blue))]"
              : "border-border text-muted-foreground",
          )}
        >
          <Youtube className="h-4 w-4" /> YouTube Link
        </button>
        <button
          type="button"
          onClick={() => setVideoType("upload")}
          className={cn(
            "flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition",
            videoType === "upload"
              ? "border-[hsl(var(--tsg-blue))] bg-[hsl(var(--tsg-blue)/0.1)] text-[hsl(var(--tsg-blue))]"
              : "border-border text-muted-foreground",
          )}
        >
          <Upload className="h-4 w-4" /> Upload Video
        </button>
      </div>

      {videoType === "youtube" && (
        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor="youtube-url">YouTube URL or Video ID</Label>
            <Input
              id="youtube-url"
              value={youtubeUrl}
              onChange={(e) => handleYouTubeUrlChange(e.target.value)}
              placeholder="https://youtu.be/xxxxxxxxxxx or video ID"
            />
          </div>
          {resolvedVideoId && (
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">
                Video ID detected: {resolvedVideoId}
              </p>
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${resolvedVideoId}?rel=0`}
                className="mt-2 h-44 w-full rounded"
                allowFullScreen
                title="YouTube preview"
              />
            </div>
          )}
        </div>
      )}

      {videoType === "upload" && (
        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor="video-file">Video File</Label>
            <div className="mt-1 flex items-center gap-3">
              <label className="flex h-24 w-full cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background/50 transition hover:border-[hsl(var(--tsg-blue)/0.6)]">
                <Upload className="h-6 w-6 text-muted-foreground" />
                <span className="text-xs">Click to select</span>
                <input
                  id="video-file"
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            </div>
            {videoPreview && (
              <video
                src={videoPreview}
                className="mt-2 h-32 w-full rounded border object-cover"
                controls
                muted
              />
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              MP4, WebM up to 100 MB
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2">
        <div>
          <Label htmlFor="highlight-title">Title</Label>
          <Input
            id="highlight-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Clutch 1v4 in TSG vs Rivals"
            maxLength={255}
          />
        </div>
        <div>
          <Label htmlFor="highlight-desc">Description (optional)</Label>
          <Textarea
            id="highlight-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell us about this clutch moment..."
            rows={3}
            maxLength={2000}
          />
        </div>
      </div>

      <div className="mt-4">
        <ImageUpload
          value={thumbnailKey}
          previewUrl={thumbnailUrl}
          category="other"
          onUploaded={(key, url) => {
            setThumbnailKey(key);
            setThumbnailUrl(url);
            setShowThumbPicker(false);
          }}
          label="Custom Thumbnail (optional)"
        />
        {videoType === "youtube" && resolvedVideoId && !thumbnailKey && (
          <button
            type="button"
            onClick={() => setShowThumbPicker(true)}
            className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
          >
            Or pick a YouTube thumbnail
          </button>
        )}
        {showThumbPicker && resolvedVideoId && (
          <div className="mt-3">
            <p className="text-xs font-medium">Pick a YouTube thumbnail:</p>
            <YouTubeThumbnailPreview
              videoId={resolvedVideoId}
              onSelect={(name) => {
                const url = `https://i.ytimg.com/vi/${resolvedVideoId}/${name}.jpg`;
                setThumbnailUrl(url);
                setShowThumbPicker(false);
              }}
            />
          </div>
        )}
      </div>

      <Button
        onClick={handleSubmit}
        disabled={createMut.isPending}
        className="mt-4 w-full bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]"
      >
        {createMut.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            <span>Submitting...</span>
          </>
        ) : (
          "Submit Highlight"
        )}
      </Button>

      {user && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Uploading as {user.name || user.username}
        </p>
      )}
    </div>
  );
}
