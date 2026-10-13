import { Link } from "react-router";
import { ArrowRight, Users, Trophy, CalendarDays } from "lucide-react";
import { TiltCard } from "@/components/TiltCard";
import { TeamLogo } from "@/components/TeamLogo";
import { LiveBadge } from "@/components/LiveBadge";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import type { RouterOutputs } from "@contracts/types";

type Team = RouterOutputs["public"]["teams"][number];

export function TeamCard({ team }: { team: Team }) {
  const isRed = team.accent === "red";
  return (
    <TiltCard>
      <div
        className={cn(
          "glass relative overflow-hidden rounded-2xl p-6 transition-shadow duration-300 md:p-8",
          isRed ? "hover:glow-red" : "hover:glow-blue",
        )}
      >
        <div
          className={cn(
            "absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl",
            isRed ? "bg-[hsl(var(--tsg-red)/0.16)]" : "bg-[hsl(var(--tsg-blue)/0.16)]",
          )}
        />
        {team.ongoingTournament && <LiveBadge className="absolute right-4 top-4" />}

        <div className="relative flex items-start gap-5">
          <TeamLogo name={team.name} logoUrl={team.logoUrl} accent={team.accent} size="lg" />
          <div className="min-w-0">
            <h3 className="font-display text-xl font-bold tracking-wide md:text-2xl">{team.name}</h3>
            <p
              className={cn(
                "text-xs font-semibold uppercase tracking-[0.2em]",
                isRed ? "text-[hsl(var(--tsg-red))]" : "text-[hsl(var(--tsg-blue))]",
              )}
            >
              {team.category}
            </p>
            {team.tagline && <p className="mt-2 text-sm text-muted-foreground">{team.tagline}</p>}
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg border border-border bg-background/40 p-3">
            <Users className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
            <p className="font-display text-lg font-bold">{team.rosterCount}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Players</p>
          </div>
          <div className="rounded-lg border border-border bg-background/40 p-3">
            <Trophy className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
            <p className="truncate text-xs font-semibold leading-6">
              {team.latestTournament?.name ?? "—"}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Latest</p>
          </div>
          <div className="rounded-lg border border-border bg-background/40 p-3">
            <CalendarDays className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
            <p className="truncate text-xs font-semibold leading-6">
              {team.nextTournament ? formatDate(team.nextTournament.startDate) : "—"}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Next</p>
          </div>
        </div>

        <Link
          to={`/teams/${team.slug}`}
          className={cn(
            "relative mt-6 flex items-center justify-center gap-2 rounded-lg border py-2.5 font-display text-sm font-bold tracking-[0.15em] transition",
            isRed
              ? "border-[hsl(var(--tsg-red)/0.5)] text-[hsl(var(--tsg-red))] hover:bg-[hsl(var(--tsg-red)/0.12)]"
              : "border-[hsl(var(--tsg-blue)/0.5)] text-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.12)]",
          )}
        >
          VIEW TEAM <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </TiltCard>
  );
}
