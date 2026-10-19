import { Play, Eye, ThumbsUp, Share2, Calendar } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { HighlightCommentSection } from "./HighlightCommentSection";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

interface HighlightPlayerCardProps {
  highlight: {
    id: number;
    title: string;
    description: string | null;
    videoType: "youtube" | "upload";
    youtubeVideoId: string | null;
    videoUrl: string | null;
    thumbnailUrl: string | null;
    embedUrl: string | null;
    watchUrl: string | null;
    views: number;
    likes: number;
    hasLiked: boolean;
    createdAt: Date;
    player: { id: number; ign: string; slug: string };
    team: { id: number; name: string; slug: string; accent: "blue" | "red" } | null;
  };
  showActions?: boolean;
}

export function HighlightPlayerCard({ highlight, showActions = true }: HighlightPlayerCardProps) {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [expanded, setExpanded] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const incrementView = trpc.highlights.incrementView.useMutation({
    onSuccess: () => utils.highlights.get.invalidate({ id: highlight.id }),
  });
  const toggleLike = trpc.highlights.toggleLike.useMutation({
    onSuccess: () => {
      utils.highlights.listByPlayer.invalidate({ playerId: highlight.player.id });
      if (expanded) utils.highlights.get.invalidate({ id: highlight.id });
    },
    onError: (e) => toast.error(e.message),
  });

  const handlePlay = () => {
    if (!expanded) {
      incrementView.mutate({ id: highlight.id });
    }
  };

  const handleLike = () => {
    if (!isAuthenticated) return;
    toggleLike.mutate({ highlightId: highlight.id });
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/players/${highlight.player.slug}#highlight-${highlight.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: highlight.title, url });
      } catch {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied to clipboard.");
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard.");
    }
  };

  const playerAccent = highlight.team?.accent ?? "blue";
  const accentBorder =
    playerAccent === "red" ? "border-[hsl(var(--tsg-red)/0.3)]" : "border-[hsl(var(--tsg-blue)/0.3)]";

  return (
    <article className="glass hover:glass-hover group rounded-xl border transition-all duration-300">
      <div className="relative">
        {expanded ? (
          <div className="aspect-video w-full min-h-[200px]">
            {highlight.videoType === "youtube" && highlight.embedUrl && (
              <iframe
                src={highlight.embedUrl}
                className="h-full w-full"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
                title={highlight.title}
                onLoad={handlePlay}
              />
            )}
            {highlight.videoType === "upload" && highlight.videoUrl && (() => {
              const canPlay = (function () {
                try {
                  return document.createElement("video").canPlayType("video/mp4") !== "";
                } catch {
                  return true;
                }
              })();
              return (
                <video
                  src={highlight.videoUrl}
                  className="h-full w-full object-cover"
                  controls
                  onPlay={handlePlay}
                >
                  {!canPlay && <p className="p-4 text-center text-sm">Video format not supported.</p>}
                </video>
              );
            })()}
            {!highlight.embedUrl && !highlight.videoUrl && (
              <div className="flex h-full items-center justify-center">
                <Play className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            className={cn(
              "relative flex aspect-video w-full cursor-pointer items-center justify-center rounded-t-xl bg-muted/60 transition group-hover:opacity-90",
              accentBorder,
            )}
            onClick={() => !highlight.embedUrl && !highlight.videoUrl && setExpanded(true)}
            onKeyDown={(e) => e.key === "Enter" && setExpanded(true)}
          >
            {highlight.thumbnailUrl ? (
              <img
                src={highlight.thumbnailUrl}
                alt={highlight.title}
                className="absolute inset-0 h-full w-full object-cover opacity-60"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            )}
            {highlight.embedUrl && (
              <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--tsg-blue))] text-white shadow-lg">
                <Play className="h-7 w-7" />
              </div>
            )}
            {highlight.watchUrl && (
              <a
                href={highlight.watchUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  window.open(highlight.watchUrl!, "_blank");
                }}
                className="absolute bottom-1 right-1 z-10 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                YouTube
              </a>
            )}
          </div>
        )}

        <div className="absolute top-2 left-2">
          <span className="rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
            {highlight.videoType === "youtube" ? "YouTube" : "Upload"}
          </span>
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-display font-bold text-lg leading-tight text-foreground group-hover:text-[hsl(var(--tsg-blue))] transition-colors">
          {highlight.title}
        </h3>
        {highlight.description && (
          <p
            className={cn(
              "mt-1.5 text-sm text-muted-foreground line-clamp-2",
              expanded && "max-h-40 overflow-y-auto",
            )}
          >
            {highlight.description}
          </p>
        )}

        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>{timeAgo(highlight.createdAt)}</span>
          <span>·</span>
          <span>{highlight.views} views</span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={handleLike}
            className={cn(
              "flex items-center gap-1 text-sm transition",
              highlight.hasLiked
                ? "text-[hsl(var(--tsg-red))]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ThumbsUp className={cn("h-4 w-4", highlight.hasLiked && "fill-current")} /> {highlight.likes}
          </button>
          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <span className="h-4 w-4" /> Comments
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-[hsl(var(--tsg-blue))] transition"
          >
            <Share2 className="h-4 w-4" /> Share
          </button>
          {showActions && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
            >
              <Eye className="h-4 w-4" /> {expanded ? "Minimize" : "Expand"}
            </button>
          )}
        </div>

        {!expanded && (
          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="w-full gap-1 text-xs"
              onClick={() => setExpanded(true)}
            >
              <Play className="h-3 w-3" /> Watch
            </Button>
          </div>
        )}
      </div>

      {showComments && (
        <div className="border-t border-border px-4 py-4">
          <HighlightCommentSection highlightId={highlight.id} />
        </div>
      )}
    </article>
  );
}
