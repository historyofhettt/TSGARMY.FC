import { Instagram, Youtube, Twitter, Crown } from "lucide-react";
import { TiltCard } from "@/components/TiltCard";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import type { RouterOutputs } from "@contracts/types";

type Person = RouterOutputs["public"]["people"][number];

function Socials({ person }: { person: Person }) {
  const socials = [
    { href: person.instagram, icon: Instagram, label: "Instagram" },
    { href: person.youtube, icon: Youtube, label: "YouTube" },
    { href: person.x, icon: Twitter, label: "X" },
  ].filter((s) => s.href);
  if (socials.length === 0) return null;
  return (
    <div className="flex justify-center gap-2">
      {socials.map((s) => (
        <a
          key={s.label}
          href={s.href!}
          target="_blank"
          rel="noreferrer"
          aria-label={`${person.name} on ${s.label}`}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:border-[hsl(var(--tsg-blue)/0.6)] hover:text-[hsl(var(--tsg-blue))]"
        >
          <s.icon className="h-4 w-4" />
        </a>
      ))}
    </div>
  );
}

export function OwnerCard({ person }: { person: Person }) {
  return (
    <TiltCard>
      <div className="glass relative overflow-hidden rounded-2xl p-6 text-center md:p-8">
        <div className="absolute -top-12 left-1/2 h-32 w-64 -translate-x-1/2 rounded-full bg-[hsl(var(--tsg-blue)/0.12)] blur-3xl" />
        <PlayerPhoto
          ign={person.name}
          photoUrl={person.photoUrl}
          className="mx-auto h-28 w-28 text-2xl ring-2 ring-[hsl(var(--tsg-blue)/0.4)]"
          rounded="rounded-full"
        />
        <h3 className="mt-4 font-display text-xl font-bold tracking-wide">{person.name}</h3>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[hsl(var(--tsg-blue))]">
          {person.position ?? "Owner"}
        </p>
        {person.description && (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{person.description}</p>
        )}
        <div className="mt-4">
          <Socials person={person} />
        </div>
      </div>
    </TiltCard>
  );
}

/** Special holographic legacy card for the TSG Legend. */
export function LegendCard({ person }: { person: Person }) {
  return (
    <TiltCard intensity={6}>
      <div className="holo-border relative overflow-hidden rounded-2xl p-8 text-center md:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--tsg-blue)/0.10),transparent_60%)]" />
        <div className="absolute -left-10 top-0 h-full w-24 rotate-12 bg-gradient-to-b from-transparent via-[hsl(var(--tsg-red)/0.08)] to-transparent" />
        <div className="absolute -right-10 top-0 h-full w-24 -rotate-12 bg-gradient-to-b from-transparent via-[hsl(var(--tsg-blue)/0.08)] to-transparent" />

        <Crown className="relative mx-auto h-8 w-8 text-[hsl(var(--tsg-blue))] text-glow-blue" />
        <PlayerPhoto
          ign={person.name}
          photoUrl={person.photoUrl}
          className="relative mx-auto mt-4 h-32 w-32 text-3xl ring-2 ring-[hsl(var(--tsg-red)/0.5)] md:h-40 md:w-40"
          rounded="rounded-2xl"
        />
        <h3 className="relative mt-6 font-display text-2xl font-black tracking-[0.15em] md:text-3xl">
          <span className="bg-gradient-to-r from-[hsl(var(--tsg-blue))] via-foreground to-[hsl(var(--tsg-red))] bg-clip-text text-transparent">
            {person.name}
          </span>
        </h3>
        {person.position && (
          <p className="relative mt-1 text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            {person.position}
          </p>
        )}
        {person.description && (
          <p className="relative mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
            {person.description}
          </p>
        )}
        <div className="relative mt-5">
          <Socials person={person} />
        </div>
      </div>
    </TiltCard>
  );
}
