import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  Search, X, ChevronRight, Calendar, Tag, Trophy, Users, FolderOpen,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { PageLayout } from "@/components/PageLayout";
import { SectionHeading } from "@/components/SectionHeading";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { MEDIA_SORT_OPTIONS, MEDIA_TAGS } from "@contracts/constants";
import type { MediaSortOption } from "@contracts/constants";

type Album = {
  id: number;
  title: string;
  description: string | null;
  eventDate: Date | string | null;
  category: string | null;
  tags: string[];
  coverUrl: string | null;
  status: string;
  displayOrder: number;
  mediaCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  team: { id: number; name: string; slug: string } | null;
  tournament: { id: number; name: string; slug: string } | null;
};

function TagPills({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <span
          key={t}
          className="flex items-center gap-1 rounded-full border border-[hsl(var(--tsg-blue)/0.4)] bg-[hsl(var(--tsg-blue)/0.1)] px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--tsg-blue))]"
        >
          <Tag className="h-2.5 w-2.5" /> {t}
        </span>
      ))}
    </div>
  );
}

export default function Media() {
  const [search, setSearch] = useState("");
  const [teamId, setTeamId] = useState<number | null>(null);
  const [tournamentId, setTournamentId] = useState<number | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [sort, setSort] = useState<MediaSortOption>("newest");
  const [cursor, setCursor] = useState(0);

  const { data, isLoading } = trpc.media.albumList.useQuery(
    {
      search: search || undefined,
      teamId: teamId ?? undefined,
      tournamentId: tournamentId ?? undefined,
      category: category ?? undefined,
      tag: tag ?? undefined,
      sort,
      limit: 36,
      cursor,
    },
  );

  const albums: Album[] = useMemo(() => data?.albums ?? [], [data?.albums]);
  const hasMore = data?.hasMore ?? false;
  const nextCursor = data?.nextCursor;

  const categories = useMemo(
    () => [...new Set(albums.map((a) => a.category).filter((c): c is string => !!c))],
    [albums],
  );
  const teams = useMemo(() => {
    const seen = new Map<number, NonNullable<Album["team"]>>();
    for (const a of albums) {
      if (a.team && a.team.id != null && !seen.has(a.team.id)) {
        seen.set(a.team.id, a.team);
      }
    }
    return [...seen.values()];
  }, [albums]);
  const tournaments = useMemo(() => {
    const seen = new Map<number, NonNullable<Album["tournament"]>>();
    for (const a of albums) {
      if (a.tournament && a.tournament.id != null && !seen.has(a.tournament.id)) {
        seen.set(a.tournament.id, a.tournament);
      }
    }
    return [...seen.values()];
  }, [albums]);

  const activeFilters =
    (teamId ? 1 : 0) +
    (tournamentId ? 1 : 0) +
    (category ? 1 : 0) +
    (tag ? 1 : 0) +
    (search ? 1 : 0);

  const clearFilters = () => {
    setSearch("");
    setTeamId(null);
    setTournamentId(null);
    setCategory(null);
    setTag(null);
    setCursor(0);
  };

  const navigate = useNavigate();

  const openAlbum = (album: Album) => {
    navigate(`/media/album/${album.id}`);
  };

  return (
    <PageLayout>
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        <SectionHeading
          kicker="TSG Media"
          title="MEDIA ALBUMS"
          description="Browse photo and video albums from matches, events and tournaments across TSG."
        />

        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCursor(0);
              }}
              placeholder="Search albums..."
              className="pl-9"
            />
            {search && (
              <button
                aria-label="Clear search"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {MEDIA_SORT_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setSort(s);
                  setCursor(0);
                }}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-semibold capitalize transition",
                  sort === s
                    ? "border-[hsl(var(--tsg-blue)/0.6)] bg-[hsl(var(--tsg-blue)/0.1)] text-[hsl(var(--tsg-blue))]"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-8 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Users className="h-3 w-3" /> Team
            </span>
            <button
              onClick={() => setTeamId(null)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-semibold transition",
                !teamId
                  ? "border-[hsl(var(--tsg-blue)/0.6)] text-[hsl(var(--tsg-blue))]"
                  : "border-border text-muted-foreground",
              )}
            >
              All
            </button>
            {teams.map((t) => (
              <button
                key={t.id}
                onClick={() => setTeamId(teamId === t.id ? null : t.id)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-semibold transition",
                  teamId === t.id
                    ? "border-[hsl(var(--tsg-blue)/0.6)] text-[hsl(var(--tsg-blue))]"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {t.name}
              </button>
            ))}
          </div>

          {tournaments.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Trophy className="h-3 w-3" /> Tournament
              </span>
              <button
                onClick={() => setTournamentId(null)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-semibold transition",
                  !tournamentId
                    ? "border-[hsl(var(--tsg-blue)/0.6)] text-[hsl(var(--tsg-blue))]"
                    : "border-border text-muted-foreground",
                )}
              >
                All
              </button>
              {tournaments.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTournamentId(tournamentId === t.id ? null : t.id)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs font-semibold transition",
                    tournamentId === t.id
                      ? "border-[hsl(var(--tsg-blue)/0.6)] text-[hsl(var(--tsg-blue))]"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}

          {categories.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Category
              </span>
              <button
                onClick={() => setCategory(null)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-semibold transition",
                  !category
                    ? "border-[hsl(var(--tsg-blue)/0.6)] text-[hsl(var(--tsg-blue))]"
                    : "border-border text-muted-foreground",
                )}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(category === c ? null : c)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs font-semibold transition",
                    category === c
                      ? "border-[hsl(var(--tsg-blue)/0.6)] text-[hsl(var(--tsg-blue))]"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Tag className="h-3 w-3" /> Tag
            </span>
            <button
              onClick={() => setTag(null)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-semibold transition",
                !tag
                  ? "border-[hsl(var(--tsg-blue)/0.6)] text-[hsl(var(--tsg-blue))]"
                  : "border-border text-muted-foreground",
              )}
            >
              All
            </button>
            {MEDIA_TAGS.map((t) => (
              <button
                key={t}
                onClick={() => setTag(tag === t ? null : t)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-semibold transition",
                  tag === t
                    ? "border-[hsl(var(--tsg-blue)/0.6)] text-[hsl(var(--tsg-blue))]"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {activeFilters > 0 && (
            <button
              onClick={clearFilters}
              className="ml-auto flex items-center gap-1 rounded-md border border-[hsl(var(--tsg-red)/0.5)] px-2.5 py-1 text-xs font-semibold text-[hsl(var(--tsg-red))] transition hover:bg-[hsl(var(--tsg-red)/0.1)]"
            >
              <X className="h-3 w-3" /> Clear ({activeFilters})
            </button>
          )}
        </div>

        <p className="mb-4 text-xs text-muted-foreground">
          {albums.length} {albums.length === 1 ? "album" : "albums"}
          {activeFilters > 0 ? " (filtered)" : ""}
        </p>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass aspect-video animate-pulse rounded-xl" />
            ))}
          </div>
        ) : albums.length === 0 ? (
          <div className="glass rounded-xl p-12 text-center">
            <span className="mb-3 flex justify-center">
              <FolderOpen className="h-10 w-10 text-muted-foreground" />
            </span>
            <p className="font-semibold">No albums yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeFilters > 0
                ? "Try adjusting or clearing your filters."
                : "New albums are added as events unfold. Check back soon."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {albums.map((album) => (
              <button
                key={album.id}
                onClick={() => openAlbum(album)}
                className="glass group overflow-hidden rounded-xl text-left transition hover:border-[hsl(var(--tsg-blue)/0.6)]"
              >
                <div className="relative aspect-video overflow-hidden bg-background/40">
                  {album.coverUrl ? (
                    <img
                      src={album.coverUrl}
                      alt={album.title}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <FolderOpen className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 rounded-full border border-border bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                    {album.mediaCount} {album.mediaCount === 1 ? "photo" : "photos"}
                  </div>
                  {album.status === "draft" && (
                    <div className="absolute right-2 top-2 rounded-full border border-[hsl(var(--tsg-red)/0.5)] bg-[hsl(var(--tsg-red)/0.15)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[hsl(var(--tsg-red))]">
                      Draft
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="font-display text-lg font-bold">{album.title}</h3>
                    {album.eventDate && (
                      <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" /> {formatDate(album.eventDate)}
                      </span>
                    )}
                  </div>
                  {album.description && (
                    <p className="mb-2 line-clamp-2 text-sm text-muted-foreground">
                      {album.description}
                    </p>
                  )}
                  {album.category && (
                    <span className="rounded-full border border-border bg-background/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {album.category}
                    </span>
                  )}
                  <TagPills tags={album.tags} />
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {album.team && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> {album.team.name}
                      </span>
                    )}
                    {album.tournament && (
                      <span className="flex items-center gap-1">
                        <Trophy className="h-3 w-3" /> {album.tournament.name}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {hasMore && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => setCursor(nextCursor ?? cursor + 36)}
              className="flex items-center gap-1 rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              Load more <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
