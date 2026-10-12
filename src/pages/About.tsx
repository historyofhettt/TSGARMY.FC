import { trpc } from "@/providers/trpc";
import { PageLayout } from "@/components/PageLayout";
import { SectionHeading } from "@/components/SectionHeading";
import { OwnerCard, LegendCard } from "@/components/cards/OwnerCard";

export default function About() {
  const { data: org } = trpc.public.org.useQuery();
  const { data: people } = trpc.public.people.useQuery();
  const owners = (people ?? []).filter((p) => p.kind === "owner");
  const legend = (people ?? []).find((p) => p.kind === "legend");

  return (
    <PageLayout>
      <div className="mx-auto max-w-5xl px-4 py-14 md:px-8">
        <SectionHeading
          kicker="Who We Are"
          title={`ABOUT ${org?.shortName ?? "TSG"}`}
        />
        <div className="glass rounded-2xl p-8">
          <p className="text-lg font-semibold">{org?.orgName ?? "Two Side Gamers"}</p>
          <p className="mt-1 text-sm font-semibold uppercase tracking-[0.25em] text-[hsl(var(--tsg-blue))]">
            {org?.tagline}
          </p>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            {org?.description ??
              "Two Side Gamers (TSG) is a professional esports organization fielding two competitive rosters — TSG ARMY (male) and TSG ARTEMIS (female). We compete across premier tournaments with a focus on discipline, performance, and community."}
          </p>
        </div>

        {owners.length > 0 && (
          <section className="mt-14">
            <SectionHeading kicker="Leadership" title="THE OWNERS" />
            <div className="grid gap-6 md:grid-cols-2">
              {owners.map((o) => (
                <OwnerCard key={o.id} person={o} />
              ))}
            </div>
          </section>
        )}
        {legend && (
          <section className="mt-14">
            <LegendCard person={legend} />
          </section>
        )}
      </div>
    </PageLayout>
  );
}
