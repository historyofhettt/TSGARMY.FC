import { Link } from "react-router";
import { Youtube, Instagram, ArrowRight } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { PageLayout } from "@/components/PageLayout";
import { SectionHeading } from "@/components/SectionHeading";
import { LiveBadge } from "@/components/LiveBadge";

export default function Live() {
  const { data: live, isLoading } = trpc.public.live.useQuery(undefined, {
    refetchInterval: 15000,
  });

  return (
    <PageLayout>
      <div className="mx-auto max-w-5xl px-4 py-14 md:px-8">
        <SectionHeading
          kicker="Real-time"
          title="LIVE TOURNAMENTS"
          description="Tournaments in progress right now. This page refreshes automatically."
        />
        {isLoading && <p className="py-10 text-center text-muted-foreground">Checking live status...</p>}

        {!isLoading && (live ?? []).length === 0 && (
          <div className="glass rounded-2xl p-14 text-center">
            <span className="mx-auto mb-4 block h-3 w-3 rounded-full bg-muted-foreground/40" />
            <p className="font-display text-lg font-bold tracking-[0.2em] text-muted-foreground">NO LIVE MATCH</p>
            <p className="mt-2 text-sm text-muted-foreground">
              There is currently no tournament in progress. Check the{" "}
              <Link to="/schedule" className="text-[hsl(var(--tsg-blue))] hover:underline">
                schedule
              </Link>{" "}
              for upcoming events.
            </p>
          </div>
        )}

        <div className="space-y-6">
          {(live ?? []).map((t) => (
            <div key={t.id} className="glass relative overflow-hidden rounded-2xl border-[hsl(var(--tsg-red)/0.4)] p-6 md:p-8">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[hsl(var(--tsg-red)/0.14)] blur-3xl" />
              <div className="relative flex flex-wrap items-center gap-5">
                <LiveBadge label="LIVE NOW" className="text-sm" />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-display text-xl font-bold md:text-2xl">{t.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.team?.name} ·{" "}
                    {t.currentMatch
                      ? `Match ${t.currentMatch.matchNumber} / ${t.numberOfMatches}${t.currentMatch.mapName ? ` · ${t.currentMatch.mapName}` : ""}`
                      : `${t.numberOfMatches} matches`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {t.youtubeLiveUrl && (
                    <a
                      href={t.youtubeLiveUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-lg bg-[hsl(var(--tsg-red))] px-5 py-2.5 font-display text-sm font-bold tracking-wider text-white transition hover:bg-[hsl(var(--tsg-red)/0.85)]"
                    >
                      <Youtube className="h-4 w-4" /> WATCH LIVE
                    </a>
                  )}
                  {t.instagramLiveUrl && (
                    <a
                      href={t.instagramLiveUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-lg border border-[hsl(var(--tsg-blue)/0.6)] px-5 py-2.5 font-display text-sm font-bold tracking-wider text-[hsl(var(--tsg-blue))]"
                    >
                      <Instagram className="h-4 w-4" /> INSTAGRAM
                    </a>
                  )}
                  <Link
                    to={`/tournaments/${t.slug}`}
                    className="flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 font-display text-sm font-bold tracking-wider text-muted-foreground transition hover:text-foreground"
                  >
                    DETAILS <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageLayout>
  );
}
