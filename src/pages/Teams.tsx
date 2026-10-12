import { PageLayout } from "@/components/PageLayout";
import { SectionHeading } from "@/components/SectionHeading";
import { TeamCard } from "@/components/cards/TeamCard";
import { trpc } from "@/providers/trpc";
import { AdDisplay } from "@/components/AdDisplay";

export default function Teams() {
  const { data: teamList, isLoading } = trpc.public.teams.useQuery();
  return (
    <PageLayout>
      <div className="mx-auto max-w-7xl px-4 py-14 md:px-8">
        <SectionHeading
          kicker="TSG Rosters"
          title="OUR TEAMS"
          description="Two independent competitive teams. Separate rosters, separate tournaments, one organization."
        />
        {isLoading && <p className="py-10 text-center text-muted-foreground">Loading teams...</p>}
        <AdDisplay placement="feed_top" page="teams" />
        <div className="grid gap-6 md:grid-cols-2">
          {(teamList ?? []).map((t) => (
            <TeamCard key={t.id} team={t} />
          ))}
        </div>
        <div className="mt-8">
          <AdDisplay placement="feed_bottom" page="teams" />
        </div>
      </div>
    </PageLayout>
  );
}
