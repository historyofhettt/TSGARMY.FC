import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ChevronLeft, ChevronRight, Play, Image as ImageIcon,
  ExternalLink, Calendar, Tag, Trophy, Users, Film,
  FolderOpen, Download, Loader2,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { PageLayout } from "@/components/PageLayout";
import { SectionHeading } from "@/components/SectionHeading";
import { formatDate, timeAgo } from "@/lib/format";
import { AdDisplay } from "@/components/AdDisplay";
import { UniversalCommentSection } from "@/components/UniversalCommentSection";

type AlbumMediaItem = {
  id: number;
  title: string;
  description: string | null;
  type: string;
  fileKey: string | null;
  fileUrl: string | null;
  thumbnailUrl: string | null;
  embedUrl: string | null;
  watchUrl: string | null;
  driveFileId: string | null;
  driveUrl: string | null;
  category: string | null;
  teamId: number | null;
  tournamentId: number | null;
  tags: string[];
  featured: boolean;
  displayOrder: number;
  isActive: boolean;
  uploadDate: Date | string | null;
  createdAt: Date | string;
};

type AlbumLink = {
  id: number;
  albumId: number;
  label: string;
  url: string;
  displayOrder: number;
  createdAt: Date | string;
  updatedAt: Date | string;
};

const ITEM_TYPE_ICON: Record<string, ReactNode> = {
  photo: <ImageIcon className="h-4 w-4" />,
  video: <Film className="h-4 w-4" />,
  youtube: <Play className="h-4 w-4" />,
  drive: <FolderOpen className="h-4 w-4" />,
};

/** Lightbox — next/previous navigation. */
function Lightbox({
  open,
  onClose,
  items,
  startIndex,
}: {
  open: boolean;
  onClose: () => void;
  items: AlbumMediaItem[];
  startIndex: number;
}) {
  const [index, setIndex] = useState(startIndex);
  const item = items[index];
  const prev = () => setIndex((i) => (i - 1 + items.length) % items.length);
  const next = () => setIndex((i) => (i + 1) % items.length);

  const isPhoto = item?.type === "photo";
  const isVideoFile = item?.type === "video";

  if (!open || !item) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <div
        className="relative mx-4 my-8 max-w-5xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 rounded-md border border-border p-2 text-sm text-muted-foreground hover:text-foreground"
        >
          ×
        </button>

        <div className="relative flex items-center justify-center">
          {item.embedUrl ? (
            <div className="aspect-video w-full max-w-3xl">
              <iframe
                src={item.embedUrl}
                title={item.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="h-full w-full rounded-lg border-0"
              />
            </div>
          ) : isPhoto && item.fileUrl ? (
            <img
              src={item.fileUrl}
              alt={item.title}
              className="max-h-[75vh] max-w-full rounded-lg object-contain"
              onError={(e) => {
                const t = e.currentTarget;
                t.style.display = "none";
                const p = t.parentElement?.querySelector("p");
                if (p) p.textContent = `Broken image: ${item.fileUrl}`;
              }}
            />
          ) : isVideoFile && item.fileUrl ? (
            <video
              src={item.fileUrl}
              controls
              className="max-h-[75vh] max-w-full rounded-lg"
            />
          ) : item.type === "drive" && item.driveUrl ? (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <FolderOpen className="h-12 w-12 text-[hsl(var(--tsg-blue))]" />
              <p className="text-sm text-muted-foreground">
                This Google Drive file cannot be embedded in an iframe.
              </p>
              <a
                href={item.driveUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-md bg-[hsl(var(--tsg-blue))] px-4 py-2 text-sm font-semibold text-white hover:bg-[hsl(var(--tsg-blue)/0.85)]"
              >
                <ExternalLink className="h-4 w-4" /> Open in Google Drive
              </a>
            </div>
          )           : (
            <div className="flex flex-col items-center gap-3 py-12">
              <ImageIcon className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Preview unavailable.</p>
              {item.type === "photo" && !item.fileUrl && (
                <p className="text-xs text-[hsl(var(--tsg-red))]">
                  Image file not found on disk: {item.fileKey ?? "unknown"}
                </p>
              )}
            </div>
          )}
        </div>

        {item.description && (
          <p className="mt-3 text-center text-sm text-muted-foreground">{item.description}</p>
        )}
        {item.uploadDate && (
          <p className="mt-1 text-center text-xs text-muted-foreground">
            {formatDate(item.uploadDate)} · {timeAgo(item.createdAt)}
          </p>
        )}

        {/* Download individual photo */}
        {isPhoto && item.fileKey && (
          <div className="mt-3 flex justify-center">
            <a
              href={`/api/media/download/${item.fileKey}`}
              className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
            >
              <Download className="h-4 w-4" /> Download photo
            </a>
          </div>
        )}

        {/* Video download note */}
        {isVideoFile && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Video downloads are not supported directly. Use the provided link instead.
          </p>
        )}

        {/* Nav arrows */}
        {items.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-border bg-background/60 p-2 text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={next}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-border bg-background/60 p-2 text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        <p className="absolute -bottom-8 right-0 text-xs text-muted-foreground">
          {index + 1} / {items.length}
        </p>
      </div>
    </div>
  );
}

export default function MediaAlbum() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const albumId = id ? Number(id) : 0;
  const { data: album, isLoading } = trpc.media.albumGet.useQuery({ id: albumId });
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxStart, setLightboxStart] = useState(0);

  const items: AlbumMediaItem[] = useMemo(
    () => (album?.items ?? []) as AlbumMediaItem[],
    [album?.items],
  );

  if (isLoading) {
    return (
      <PageLayout>
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass h-8 w-64 animate-pulse rounded" />
            ))}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="glass aspect-video animate-pulse rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!album) {
    return (
      <PageLayout>
        <div className="mx-auto max-w-4xl px-4 py-16 md:px-8 text-center">
          <FolderOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h1 className="font-display text-2xl font-bold">Album not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This album does not exist or is not published.
          </p>
          <Link
            to="/media"
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[hsl(var(--tsg-blue))] hover:underline"
          >
            ← Back to Media
          </Link>
        </div>
      </PageLayout>
    );
  }

  const photoCount = items.filter((i) => i.type === "photo").length;
  const hasPhotos = photoCount > 0;

  return (
    <PageLayout>
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-8">
        {/* Back link */}
        <button
          onClick={() => navigate("/media")}
          className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Back to albums
        </button>

        {/* Album header */}
        {album.coverUrl && (
          <div className="mb-6 aspect-video overflow-hidden rounded-xl">
            <img
              src={album.coverUrl}
              alt={album.title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        )}

        <SectionHeading
          kicker={album.category ?? "Album"}
          title={album.title}
          description={album.description ?? undefined}
        />

        {/* Metadata */}
        <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {album.eventDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" /> {formatDate(album.eventDate)}
            </span>
          )}
          {album.team && (
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" /> {album.team.name}
            </span>
          )}
          {album.tournament && (
            <span className="flex items-center gap-1">
              <Trophy className="h-4 w-4" /> {album.tournament.name}
            </span>
          )}
          <span className="flex items-center gap-1">
            <ImageIcon className="h-4 w-4" /> {items.length} {items.length === 1 ? "item" : "items"}
          </span>
          {album.tags.length > 0 && (
            <span className="flex items-center gap-1">
              <Tag className="h-4 w-4" /> {album.tags.join(", ")}
            </span>
          )}
        </div>

        {/* Album links */}
        {album.links.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {album.links.map((l: AlbumLink) => (
              <a
                key={l.id}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-md border border-border bg-background/50 px-4 py-2 text-sm font-semibold transition hover:border-[hsl(var(--tsg-blue)/0.6)] hover:bg-[hsl(var(--tsg-blue)/0.08)]"
              >
                <ExternalLink className="h-4 w-4" /> {l.label}
              </a>
            ))}
          </div>
        )}

        {/* Download All Photos (ZIP) */}
        {hasPhotos && (
          <div className="mb-6">
            <DownloadAllPhotosButton albumId={album.id} photoCount={photoCount} />
          </div>
        )}
        {!hasPhotos && photoCount === 0 && (
          <p className="mb-6 text-xs text-muted-foreground">
            Video downloads are not supported as a batch. Use the individual
            links or open each item to watch.
          </p>
        )}

        {/* Media grid */}
        {items.length === 0 ? (
          <div className="glass rounded-xl p-10 text-center">
            <FolderOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-semibold">No media in this album yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Check back soon — new content is added regularly.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {items.map((item, idx) => {
              const isPhoto = item.type === "photo";
              const isVideo = item.type === "video" || item.type === "youtube";
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setLightboxStart(idx);
                    setLightboxOpen(true);
                  }}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-background/40 text-left transition hover:border-[hsl(var(--tsg-blue)/0.6)]"
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                     {item.thumbnailUrl ? (
                       <img
                         src={item.thumbnailUrl}
                         alt={item.title}
                         className="h-full w-full object-cover"
                         loading="lazy"
                         onError={(e) => (e.currentTarget.style.display = "none")}
                       />
                     ) : item.fileUrl && isPhoto ? (
                       <img
                         src={item.fileUrl}
                         alt={item.title}
                         className="h-full w-full object-cover"
                         loading="lazy"
                         onError={(e) => (e.currentTarget.style.display = "none")}
                       />
                     ) : item.embedUrl ? (
                       <img
                         src={item.embedUrl.replace("/embed/", "https://i.ytimg.com/vi/").replace("/embed/", "")}
                         alt={item.title}
                         className="h-full w-full object-cover"
                         loading="lazy"
                         onError={(e) => (e.currentTarget.style.display = "none")}
                       />
                     ) : isVideo ? (
                      <Play className="h-6 w-6 text-[hsl(var(--tsg-blue))]" />
                    ) : (
                      <FolderOpen className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  {(item.type === "video" || item.type === "youtube") && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Play className="h-8 w-8 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <p className="line-clamp-1 text-xs font-semibold text-white">{item.title}</p>
                    {ITEM_TYPE_ICON[item.type] && (
                      <span className="flex items-center gap-0.5 text-[10px] text-white/70">
                        {ITEM_TYPE_ICON[item.type]}
                      </span>
                    )}
                  </div>
                  {item.watchUrl && (
                    <ExternalLink className="absolute right-1 top-1 h-3 w-3 text-white/70 opacity-0 group-hover:opacity-100" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Lightbox */}
        <Lightbox
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          items={items}
          startIndex={lightboxStart}
        />

        {/* Sponsored Ad - between_media_items placement */}
        <div className="my-8">
          <AdDisplay placement="between_media_items" page="media" />
        </div>

        {/* Comments */}
        {album && (
          <div className="mt-8">
            <UniversalCommentSection refTable="media_album" refId={album.id} title="Media Comments" />
          </div>
        )}
      </div>
    </PageLayout>
  );
}

/** Download All Photos button — fetches a ZIP from the server. */
function DownloadAllPhotosButton({ albumId, photoCount }: { albumId: number; photoCount: number }) {
  const download = trpc.media.albumDownloadPhotos.useQuery({ id: albumId });
  const [downloading, setDownloading] = useState(false);
  const handleDownload = async () => {
    setDownloading(true);
    try {
    if (download.data?.zip) {
      const binary = atob(download.data.zip);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
       a.download = `album-photos-${albumId}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    }
    } finally {
      setDownloading(false);
    }
  };

  if (download.isLoading) {
    return (
      <button
        disabled
        className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground"
      >
        <Loader2 className="h-4 w-4 animate-spin" /> Preparing ZIP...
      </button>
    );
  }

  if (!download.data?.entries || download.data.entries === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {download.data?.note || "Photos could not be downloaded directly."}
      </p>
    );
  }

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className="flex items-center gap-2 rounded-md border border-border bg-[hsl(var(--tsg-blue)/0.1)] px-4 py-2 text-sm font-semibold text-[hsl(var(--tsg-blue))] transition hover:bg-[hsl(var(--tsg-blue)/0.15)]"
    >
      <Download className="h-4 w-4" /> Download all {photoCount} photos as ZIP
    </button>
  );
}
