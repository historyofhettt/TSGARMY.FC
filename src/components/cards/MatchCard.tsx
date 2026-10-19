import { useState } from "react";
import { MapPin, ChevronDown } from "lucide-react";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { Button } from "@/components/ui/button";

export type MatchPlayerLike = {
  id: number;
  kills: number;
  placementPoints: number;
  finishPoints: number;
  totalPoints: number;
  officialTotalPoints: number | null;
  lineupStatus: string;
  specialMoment: string | null;
  player: {
    id: number;
    ign: string;
    role: string | null;
    photoUrl?: string | null;
  };
};

export type MatchLike = {
  id: number;
  matchNumber: number;
  mapName: string | null;
  mapUrl?: string | null;
  placementPoints?: number;
  finishPoints?: number;
  totalPoints?: number;
  officialTotalPoints?: number | null;
  matchPlayers: MatchPlayerLike[];
};

export function MatchCard({ match }: { match: MatchLike }) {
  const [expanded, setExpanded] = useState(false);
  const playedPlayers = match.matchPlayers
    .filter((p) => p.lineupStatus === "played")
    .sort((a, b) => b.kills - a.kills)
    .slice(0, 4);

  const placementPoints = match.placementPoints ?? 0;
  const finishPoints = match.finishPoints ?? 0;
  const totalPoints = match.totalPoints ?? 0;
  const overallPoints = match.officialTotalPoints ?? 0;

  return (
    <div className="glass rounded-xl border border-border overflow-hidden transition hover:border-[hsl(var(--tsg-blue)/0.4)]">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-bold tracking-wider">
            MATCH {match.matchNumber}
          </h3>
        </div>

        {match.mapName && (
          <div className="mt-3 flex items-center gap-2.5">
            <div className="h-16 w-16 overflow-hidden rounded-lg border border-border bg-background/40 xs:h-20 xs:w-20 sm:h-24 sm:w-24">
              {match.mapUrl ? (
                <img src={match.mapUrl} alt={match.mapName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <MapPin className="h-5 w-5 text-muted-foreground xs:h-6 xs:w-6" />
                </div>
              )}
            </div>
            <span className="min-w-0 truncate text-xs font-bold tracking-wide xs:text-sm">{match.mapName.toUpperCase()}</span>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <div className="rounded-lg bg-[hsl(var(--tsg-blue)/0.08)] p-2 text-center">
            <p className="text-[8px] uppercase tracking-widest text-muted-foreground xs:text-[9px]">Placement</p>
            <p className="font-display text-xs font-black text-[hsl(var(--tsg-blue))] sm:text-sm">{placementPoints}</p>
          </div>
          <div className="rounded-lg bg-[hsl(var(--tsg-blue)/0.08)] p-2 text-center">
            <p className="text-[8px] uppercase tracking-widest text-muted-foreground xs:text-[9px]">Finishes</p>
            <p className="font-display text-xs font-black text-[hsl(var(--tsg-blue))] sm:text-sm">{finishPoints}</p>
          </div>
          <div className="rounded-lg bg-[hsl(var(--tsg-blue)/0.08)] p-2 text-center">
            <p className="text-[8px] uppercase tracking-widest text-muted-foreground xs:text-[9px]">Total</p>
            <p className="font-display text-xs font-black text-[hsl(var(--tsg-blue))] sm:text-sm">{totalPoints}</p>
          </div>
          <div className="rounded-lg bg-[hsl(var(--tsg-blue)/0.08)] p-2 text-center">
            <p className="text-[8px] uppercase tracking-widest text-muted-foreground xs:text-[9px]">Overall</p>
            <p className="font-display text-xs font-black text-[hsl(var(--tsg-blue))] sm:text-sm">{overallPoints}</p>
          </div>
        </div>
      </div>

      {playedPlayers.length > 0 && (
        <>
          <div className="border-t border-border px-4 py-2.5">
            <Button
              size="sm"
              variant="ghost"
              className="flex w-full items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded(!expanded)}
            >
              <ChevronDown className={`h-4 w-4 transition ${expanded ? "rotate-180" : ""}`} />
              {expanded ? "Hide" : "Show"} Player Stats
            </Button>
          </div>

          {expanded && (
            <div className="border-t border-border bg-background/30 p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">PLAYED</p>
              <div className="space-y-3">
                {playedPlayers.map((p) => (
                  <div key={p.id} className="flex items-center gap-3">
                    <PlayerPhoto ign={p.player.ign} photoUrl={p.player.photoUrl} className="h-9 w-9 text-xs" rounded="rounded-md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{p.player.ign}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.kills} kills
                        {p.specialMoment && <span className="ml-2 text-[hsl(var(--tsg-red))]">· {p.specialMoment}</span>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
