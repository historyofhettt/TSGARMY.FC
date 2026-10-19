import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { PageLayout } from "@/components/PageLayout";
import { SectionHeading } from "@/components/SectionHeading";
import { PlayerCard } from "@/components/cards/PlayerCard";
import { cn } from "@/lib/utils";
import { AdDisplay } from "@/components/AdDisplay";

export default function Players() {
  const [teamFilter, setTeamFilter] = useState<number | "all">("all");
  const { data: teamList } = trpc.public.teams.useQuery();
  const { data: playersList, isLoading } = trpc.public.players.useQuery(
    teamFilter === "all" ? undefined : { teamId: teamFilter },
  );

  return (
    <PageLayout>
      <div className="mx-auto max-w-7xl px-4 py-14 md:px-8">
        <SectionHeading
          kicker="Database"
          title="ALL PLAYERS"
          description="Every competitor who has worn the TSG jersey."
        />
        <div className="mb-8 flex flex-wrap gap-2" role="tablist" aria-label="Filter by team">
          <button
            onClick={() => setTeamFilter("all")}
            className={cn(
              "rounded-md border px-4 py-1.5 text-sm font-semibold transition",
              teamFilter === "all"
                ? "border-[hsl(var(--tsg-blue)/0.6)] bg-[hsl(var(--tsg-blue)/0.12)] text-[hsl(var(--tsg-blue))]"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            All
          </button>
          {(teamList ?? []).map((t) => (
            <button
              key={t.id}
              onClick={() => setTeamFilter(t.id)}
              className={cn(
                "rounded-md border px-4 py-1.5 text-sm font-semibold transition",
                teamFilter === t.id
                  ? "border-[hsl(var(--tsg-blue)/0.6)] bg-[hsl(var(--tsg-blue)/0.12)] text-[hsl(var(--tsg-blue))]"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {t.name}
            </button>
          ))}
        </div>

        {isLoading && <p className="py-10 text-center text-muted-foreground">Loading players...</p>}
        {!isLoading && (playersList ?? []).length === 0 && (
          <p className="py-10 text-center text-muted-foreground">No players found.</p>
        )}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {(playersList ?? []).map((p) => (
            <PlayerCard key={p.id} player={p} />
          ))}
        </div>
        <div className="mt-8">
          <AdDisplay placement="feed_bottom" page="players" />
        </div>
      </div>
    </PageLayout>
  );
}
