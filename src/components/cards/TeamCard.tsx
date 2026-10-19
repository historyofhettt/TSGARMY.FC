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
          "glass relative overflow-hidden rounded-2xl p-4 xs:p-5 md:p-8",
          isRed ? "hover:glow-red" : "hover:glow-blue",
        )}
      >
        <div
          className={cn(
            "absolute -right-16 -top-16 h-40 w-40 rounded-full blur-3xl xs:h-44 xs:w-44 md:h-48 md:w-48",
            isRed ? "bg-[hsl(var(--tsg-red)/0.16)]" : "bg-[hsl(var(--tsg-blue)/0.16)]",
          )}
        />
        {team.ongoingTournament && <LiveBadge className="absolute right-2 top-2 xs:right-3 xs:top-3" />}

        <div className="relative flex items-start gap-3 xs:gap-4 md:gap-5">
          <TeamLogo name={team.name} logoUrl={team.logoUrl} accent={team.accent} size="lg" />
          <div className="min-w-0">
            <h3 className="font-display text-lg xs:text-xl font-bold tracking-wide md:text-2xl">{team.name}</h3>
            <p
              className={cn(
                "text-[10px] font-semibold uppercase tracking-[0.15em] xs:tracking-[0.2em]",
                isRed ? "text-[hsl(var(--tsg-red))]" : "text-[hsl(var(--tsg-blue))]",
              )}
            >
              {team.category}
            </p>
            {team.tagline && <p className="mt-1 truncate text-xs text-muted-foreground xs:mt-2 xs:text-sm">{team.tagline}</p>}
          </div>
        </div>

        <div className="relative mt-4 grid grid-cols-3 gap-2 xs:gap-3 text-center">
          <div className="rounded-lg border border-border bg-background/40 p-2 xs:p-3">
            <Users className="mx-auto mb-1 h-3.5 w-3.5 text-muted-foreground xs:h-4 xs:w-4" />
            <p className="font-display text-base xs:text-lg font-black">{team.rosterCount}</p>
            <p className="text-[8px] uppercase tracking-wider text-muted-foreground xs:text-[10px]">Players</p>
          </div>
          <div className="rounded-lg border border-border bg-background/40 p-2 xs:p-3">
            <Trophy className="mx-auto mb-1 h-3.5 w-3.5 text-muted-foreground xs:h-4 xs:w-4" />
            <p className="truncate text-[10px] font-semibold leading-5 xs:text-xs xs:leading-6">
              {team.latestTournament?.name ?? "—"}
            </p>
            <p className="text-[8px] uppercase tracking-wider text-muted-foreground xs:text-[10px]">Latest</p>
          </div>
          <div className="rounded-lg border border-border bg-background/40 p-2 xs:p-3">
            <CalendarDays className="mx-auto mb-1 h-3.5 w-3.5 text-muted-foreground xs:h-4 xs:w-4" />
            <p className="truncate text-[10px] font-semibold leading-5 xs:text-xs xs:leading-6">
              {team.nextTournament ? formatDate(team.nextTournament.startDate) : "—"}
            </p>
            <p className="text-[8px] uppercase tracking-wider text-muted-foreground xs:text-[10px]">Next</p>
          </div>
        </div>

        <Link
          to={`/teams/${team.slug}`}
          className={cn(
            "relative mt-4 xs:mt-5 flex items-center justify-center gap-2 rounded-lg border py-2 font-display text-xs xs:text-sm font-bold tracking-[0.1em] xs:tracking-[0.15em] transition",
            isRed
              ? "border-[hsl(var(--tsg-red)/0.5)] text-[hsl(var(--tsg-red))] hover:bg-[hsl(var(--tsg-red)/0.12)]"
              : "border-[hsl(var(--tsg-blue)/0.5)] text-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.12)]",
          )}
        >
          VIEW TEAM <ArrowRight className="h-3.5 w-3.5 xs:h-4 xs:w-4" />
        </Link>
      </div>
    </TiltCard>
  );
}
