import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { PageLayout } from "@/components/PageLayout";
import { SectionHeading } from "@/components/SectionHeading";
import { TournamentCard } from "@/components/cards/TournamentCard";
import { cn } from "@/lib/utils";
import { AdDisplay } from "@/components/AdDisplay";

const STATUSES = [
  { value: "all", label: "All" },
  { value: "ongoing", label: "Live" },
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
] as const;

export default function Tournaments() {
  const [status, setStatus] = useState<(typeof STATUSES)[number]["value"]>("all");
  const [teamId, setTeamId] = useState<number | "all">("all");
  const { data: teamList } = trpc.public.teams.useQuery();
  const { data: tournaments, isLoading } = trpc.public.tournaments.useQuery({
    status: status === "all" ? undefined : status,
    teamId: teamId === "all" ? undefined : teamId,
  });

  const pill = (active: boolean) =>
    cn(
      "rounded-md border px-4 py-1.5 text-sm font-semibold transition",
      active
        ? "border-[hsl(var(--tsg-blue)/0.6)] bg-[hsl(var(--tsg-blue)/0.12)] text-[hsl(var(--tsg-blue))]"
        : "border-border text-muted-foreground hover:text-foreground",
    );

  return (
    <PageLayout>
      <div className="mx-auto max-w-7xl px-4 py-14 md:px-8">
        <SectionHeading
          kicker="Competition"
          title="TOURNAMENTS"
          description="Every event TSG competes in — past, live, and upcoming."
        />
        <div className="mb-8 flex flex-wrap items-center gap-2">
          {STATUSES.map((s) => (
            <button key={s.value} onClick={() => setStatus(s.value)} className={pill(status === s.value)}>
              {s.label}
            </button>
          ))}
          <span className="mx-2 hidden h-5 w-px bg-border sm:block" />
          <button onClick={() => setTeamId("all")} className={pill(teamId === "all")}>All Teams</button>
          {(teamList ?? []).map((t) => (
            <button key={t.id} onClick={() => setTeamId(t.id)} className={pill(teamId === t.id)}>
              {t.name}
            </button>
          ))}
        </div>

        {isLoading && <p className="py-10 text-center text-muted-foreground">Loading tournaments...</p>}
        {!isLoading && (tournaments ?? []).length === 0 && (
          <p className="py-10 text-center text-muted-foreground">No tournaments match these filters.</p>
        )}
        <div className="grid gap-5 md:grid-cols-2">
          {(tournaments ?? []).map((t) => (
            <TournamentCard key={t.id} tournament={t} />
          ))}
        </div>
        <div className="mt-8">
          <AdDisplay placement="feed_bottom" page="tournaments" />
        </div>
      </div>
    </PageLayout>
  );
}
