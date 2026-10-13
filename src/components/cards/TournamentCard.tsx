import { Link } from "react-router";
import { CalendarDays, Clock, Youtube, Instagram } from "lucide-react";
import { TiltCard } from "@/components/TiltCard";
import { StatusBadge } from "@/components/LiveBadge";
import { formatDate } from "@/lib/format";

type TournamentLike = {
  id: number;
  name: string;
  slug: string;
  status: string;
  logoUrl?: string | null;
  startDate?: Date | null;
  startTime?: string | null;
  numberOfMatches: number;
  youtubeLiveUrl?: string | null;
  instagramLiveUrl?: string | null;
  team?: { name: string } | null;
  matchesPlayed?: number;
};

export function TournamentCard({ tournament: t }: { tournament: TournamentLike }) {
  return (
    <TiltCard intensity={6}>
      <Link to={`/tournaments/${t.slug}`} aria-label={`View ${t.name}`}>
        <div className="glass relative overflow-hidden rounded-2xl p-5 transition hover:border-[hsl(var(--tsg-blue)/0.5)]">
          <div className="flex items-start gap-4">
            {t.logoUrl ? (
              <img src={t.logoUrl} alt={`${t.name} logo`} className="h-14 w-14 rounded-lg object-contain" loading="lazy" />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-lg border border-border bg-background/50 font-display text-lg font-bold text-muted-foreground">
                {t.name.slice(0, 2).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="truncate font-display text-base font-bold tracking-wide">{t.name}</h3>
                <StatusBadge status={t.status} />
              </div>
              {t.team && <p className="mt-0.5 text-xs text-muted-foreground">{t.team.name}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" /> {formatDate(t.startDate)}
                </span>
                {t.startTime && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> {t.startTime}
                  </span>
                )}
                <span>
                  {t.status === "ongoing" && typeof t.matchesPlayed === "number"
                    ? `Match ${t.matchesPlayed} / ${t.numberOfMatches}`
                    : `${t.numberOfMatches} matches`}
                </span>
              </div>
            </div>
          </div>
          {(t.youtubeLiveUrl || t.instagramLiveUrl) && t.status !== "completed" && (
            <div className="mt-4 flex gap-2 border-t border-border pt-3">
              {t.youtubeLiveUrl && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--tsg-red))]">
                  <Youtube className="h-3.5 w-3.5" /> YouTube Live
                </span>
              )}
              {t.instagramLiveUrl && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--tsg-blue))]">
                  <Instagram className="h-3.5 w-3.5" /> Instagram Live
                </span>
              )}
            </div>
          )}
        </div>
      </Link>
    </TiltCard>
  );
}
