import { useState } from "react";
import { Link } from "react-router";
import { CalendarDays, Clock, Youtube, ArrowRight } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { PageLayout } from "@/components/PageLayout";
import { SectionHeading } from "@/components/SectionHeading";
import { LiveBadge, StatusBadge } from "@/components/LiveBadge";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function Schedule() {
  const [teamFilter, setTeamFilter] = useState<number | "all">("all");
  const { data: teamList } = trpc.public.teams.useQuery();
  const { data: tournaments, isLoading } = trpc.public.tournaments.useQuery(
    teamFilter === "all" ? undefined : { teamId: teamFilter },
    { refetchInterval: 30000 },
  );

  const ongoing = (tournaments ?? []).filter((t) => t.status === "ongoing");
  const upcoming = (tournaments ?? [])
    .filter((t) => t.status === "upcoming")
    .sort((a, b) => new Date(a.startDate ?? 0).getTime() - new Date(b.startDate ?? 0).getTime());
  const completed = (tournaments ?? []).filter((t) => t.status === "completed");

  return (
    <PageLayout>
      <div className="mx-auto max-w-5xl px-4 py-14 md:px-8">
        <SectionHeading
          kicker="Calendar"
          title="SCHEDULE"
          description="Daily tournament schedule for both TSG rosters."
        />

        <div className="mb-10 flex flex-wrap gap-2" aria-label="Filter schedule by team">
          {[{ id: "all" as const, name: "All" }, ...(teamList ?? []).map((t) => ({ id: t.id as number | "all", name: t.name }))].map((f) => (
            <button
              key={String(f.id)}
              onClick={() => setTeamFilter(f.id)}
              className={cn(
                "rounded-md border px-4 py-1.5 text-sm font-semibold transition",
                teamFilter === f.id
                  ? "border-[hsl(var(--tsg-blue)/0.6)] bg-[hsl(var(--tsg-blue)/0.12)] text-[hsl(var(--tsg-blue))]"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {f.name}
            </button>
          ))}
        </div>

        {isLoading && <p className="py-10 text-center text-muted-foreground">Loading schedule...</p>}

        {/* LIVE */}
        {ongoing.length > 0 && (
          <section className="mb-12" aria-label="Live now">
            <h2 className="mb-4 flex items-center gap-3 font-display text-lg font-bold tracking-widest">
              <LiveBadge /> HAPPENING NOW
            </h2>
            <div className="space-y-3">
              {ongoing.map((t) => (
                <div key={t.id} className="glass flex flex-wrap items-center gap-4 rounded-xl border-[hsl(var(--tsg-red)/0.4)] p-5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display font-bold">{t.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {t.team?.name} · Match {t.matchesPlayed} / {t.numberOfMatches}
                    </p>
                  </div>
                  <Link
                    to={`/tournaments/${t.slug}`}
                    className="flex items-center gap-2 rounded-lg bg-[hsl(var(--tsg-red))] px-4 py-2 text-sm font-bold text-white transition hover:bg-[hsl(var(--tsg-red)/0.85)]"
                  >
                    WATCH LIVE <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* UPCOMING */}
        <section className="mb-12" aria-label="Upcoming">
          <h2 className="mb-4 font-display text-lg font-bold tracking-widest text-[hsl(var(--tsg-blue))]">UPCOMING</h2>
          {upcoming.length === 0 ? (
            <p className="glass rounded-xl p-6 text-center text-sm text-muted-foreground">NO UPCOMING TOURNAMENTS</p>
          ) : (
            <div className="space-y-3">
              {upcoming.map((t) => (
                <Link key={t.id} to={`/tournaments/${t.slug}`}>
                  <div className="glass flex flex-wrap items-center gap-4 rounded-xl p-5 transition hover:border-[hsl(var(--tsg-blue)/0.5)]">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display font-bold">{t.name}</p>
                      <p className="text-sm text-muted-foreground">{t.team?.name}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="h-4 w-4" /> {formatDate(t.startDate)}
                      </span>
                      {t.startTime && (
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4" /> {t.startTime}
                        </span>
                      )}
                      <span>{t.numberOfMatches} matches</span>
                      {t.youtubeLiveUrl && <Youtube className="h-4 w-4 text-[hsl(var(--tsg-red))]" />}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* COMPLETED */}
        <section aria-label="Completed">
          <h2 className="mb-4 font-display text-lg font-bold tracking-widest text-muted-foreground">COMPLETED</h2>
          {completed.length === 0 ? (
            <p className="glass rounded-xl p-6 text-center text-sm text-muted-foreground">No completed tournaments yet.</p>
          ) : (
            <div className="space-y-3">
              {completed.map((t) => (
                <Link key={t.id} to={`/tournaments/${t.slug}`}>
                  <div className="glass flex flex-wrap items-center gap-4 rounded-xl p-5 opacity-80 transition hover:opacity-100">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display font-bold">{t.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {t.team?.name} · {formatDate(t.startDate)}
                      </p>
                    </div>
                    <StatusBadge status={t.status} />
                    <span className="text-sm font-semibold text-[hsl(var(--tsg-blue))]">View Results →</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </PageLayout>
  );
}
