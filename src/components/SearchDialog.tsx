import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Search, User, Users, Trophy, Image as ImageIcon, Sparkles, X, Clock } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { TeamLogo } from "@/components/TeamLogo";
import { PlayerPhoto } from "@/components/PlayerPhoto";

const CATEGORY_LABELS: Record<string, string> = {
  players: "Players",
  teams: "Teams",
  tournaments: "Tournaments",
  albums: "Media Albums",
  spotlight: "Spotlight",
};

const SEARCH_SECTIONS: string[] = ["players", "teams", "tournaments", "albums", "spotlight"];

const STORAGE_KEY = "tsg-search-recent";

export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed.slice(0, 5).filter((s): s is string => typeof s === "string");
        }
      } catch { /* ignore */ }
    }
    return [];
  });
    const navigate = useNavigate();
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isFetching } = trpc.public.search.useQuery(
    { q: debounced },
    { enabled: debounced.length > 0 },
  );

  const go = (path: string) => {
    onOpenChange(false);
    setQ("");
    setDebounced("");
    navigate(path);
  };

  const addRecentSearch = (term: string) => {
    const updated = [term, ...recentSearches.filter((s) => s !== term)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const allSections = data
    ? SEARCH_SECTIONS.map((section) => ({
        section,
        items: (data as Record<string, unknown[]>)[section] ?? [],
      })).filter((s) => s.items.length > 0)
    : [];

  const hasResults = data && allSections.length > 0;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(false);
        return;
      }
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    },
    [onOpenChange],
  );

  const renderPlayer = (p: { id: number; ign: string; slug: string; photoUrl: string | null; team?: { name: string } | null }) => (
    <button
      key={p.id}
      onClick={() => {
        addRecentSearch(p.ign);
        go(`/players/${p.slug}`);
      }}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition hover:bg-accent"
    >
      <PlayerPhoto ign={p.ign} photoUrl={p.photoUrl} className="h-8 w-8 text-[10px]" rounded="rounded-md" />
      <span className="flex items-center gap-2 text-sm font-medium">
        <User className="h-3.5 w-3.5 text-[hsl(var(--tsg-blue))]" /> {p.ign}
      </span>
      <span className="ml-auto text-xs text-muted-foreground">{p.team?.name ?? "FA"}</span>
    </button>
  );

  const renderTeam = (t: { id: number; name: string; slug: string; logoUrl: string | null; accent?: string | null }) => (
    <button
      key={t.id}
      onClick={() => {
        addRecentSearch(t.name);
        go(`/teams/${t.slug}`);
      }}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition hover:bg-accent"
    >
      <TeamLogo name={t.name} logoUrl={t.logoUrl} size="sm" accent={(t.accent ?? "blue") as "blue" | "red"} className="h-8 w-8 text-[10px]" />
      <span className="flex items-center gap-2 text-sm font-medium">
        <Users className="h-3.5 w-3.5 text-[hsl(var(--tsg-blue))]" /> {t.name}
      </span>
    </button>
  );

  const renderTournament = (t: { id: number; name: string; slug: string; team?: { name: string } | null }) => (
    <button
      key={t.id}
      onClick={() => {
        addRecentSearch(t.name);
        go(`/tournaments/${t.slug}`);
      }}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition hover:bg-accent"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center">
        <Trophy className="h-5 w-5 text-[hsl(var(--tsg-red))]" />
      </span>
      <span className="flex items-center gap-2 text-sm font-medium">
        {t.name}
      </span>
      <span className="ml-auto text-xs text-muted-foreground">{t.team?.name ?? "TSG"}</span>
    </button>
  );

  const renderAlbum = (a: { id: number; title: string; coverUrl: string | null }) => (
    <button
      key={a.id}
      onClick={() => {
        addRecentSearch(a.title);
        go(`/media/album/${a.id}`);
      }}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition hover:bg-accent"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center">
        {a.coverUrl ? (
          <img src={a.coverUrl} alt={a.title} className="h-full w-full rounded object-cover" />
        ) : (
          <ImageIcon className="h-5 w-5 text-[hsl(var(--tsg-blue))]" />
        )}
      </span>
      <span className="flex items-center gap-2 text-sm font-medium">
        {a.title}
      </span>
      <span className="ml-auto text-xs text-muted-foreground">Media Album</span>
    </button>
  );

  const renderSpotlight = (s: { id: number; title: string; thumbnailUrl?: string | null; fanName?: string | null }) => (
    <button
      key={s.id}
      onClick={() => {
        addRecentSearch(s.title);
        go(`/spotlight/${s.id}`);
      }}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition hover:bg-accent"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center">
        {s.thumbnailUrl ? (
          <img src={s.thumbnailUrl} alt={s.title} className="h-full w-full rounded object-cover" />
        ) : (
          <Sparkles className="h-5 w-5 text-[hsl(var(--tsg-blue))]" />
        )}
      </span>
      <span className="flex items-center gap-2 text-sm font-medium">
        {s.title}
      </span>
      <span className="ml-auto text-xs text-muted-foreground">{s.fanName ?? "Community"}</span>
    </button>
  );

  const renderers: Record<string, (item: unknown) => React.ReactNode> = {
    players: (item) => renderPlayer(item as Parameters<typeof renderPlayer>[0]),
    teams: (item) => renderTeam(item as Parameters<typeof renderTeam>[0]),
    tournaments: (item) => renderTournament(item as Parameters<typeof renderTournament>[0]),
    albums: (item) => renderAlbum(item as Parameters<typeof renderAlbum>[0]),
    spotlight: (item) => renderSpotlight(item as Parameters<typeof renderSpotlight>[0]),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="glass-strong top-[20%] mx-4 max-w-2xl border-border p-0 sm:mx-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Search TSG</DialogTitle>

        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search players, teams, tournaments, media, spotlight..."
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Search TSG"
            aria-autocomplete="list"
          />
          {q.length > 0 && (
            <button
              onClick={() => {
                setQ("");
                setDebounced("");
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2" role="listbox" aria-label="Search results">
          {debounced.length === 0 && recentSearches.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">
              Type to search across TSG — players, teams, tournaments, media, and community.
            </p>
          )}

          {debounced.length === 0 && recentSearches.length > 0 && (
            <div className="mb-3">
              <p className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold tracking-widest text-muted-foreground">
                <Clock className="h-3 w-3" /> RECENT
              </p>
              {recentSearches.map((term, i) => (
                <button
                  key={`recent-${i}`}
                  onClick={() => {
                    setQ(term);
                    setDebounced(term.trim());
                    inputRef.current?.focus();
                  }}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate">{term}</span>
                </button>
              ))}
            </div>
          )}

          {debounced.length > 0 && (isFetching || !data) && (
            <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
              <span className="animate-spin">
                <Search className="h-3.5 w-3.5" />
              </span>
              Searching...
            </div>
          )}

          {debounced.length > 0 && !isFetching && data && !hasResults && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No results found for “{debounced}”. Try another term.
            </div>
          )}

          {data && hasResults && (
            <>
              {allSections.map((group) => (
                <div key={group.section} className="mb-3 last:mb-0">
                  <p className="px-3 py-1.5 text-[11px] font-bold tracking-widest text-muted-foreground">
                    {CATEGORY_LABELS[group.section]}
                  </p>
                  {group.items.map((item) => renderers[group.section](item))}
                </div>
              ))}
              </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
          <span>Press <kbd className="rounded bg-muted px-1.5 py-0.5">Esc</kbd> to close</span>
          <span>Shortcut: <kbd className="rounded bg-muted px-1.5 py-0.5">Ctrl+K</kbd></span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
