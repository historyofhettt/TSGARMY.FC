import { Link } from "react-router";
import { Instagram, Youtube, Twitter } from "lucide-react";
import { TiltCard } from "@/components/TiltCard";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { cn } from "@/lib/utils";

type PlayerLike = {
  id: number;
  ign: string;
  slug: string;
  role: string | null;
  photoUrl?: string | null;
  status?: string;
  instagram?: string | null;
  youtube?: string | null;
  x?: string | null;
  team?: { name: string; accent?: string | null } | null;
};

export function PlayerCard({ player }: { player: PlayerLike }) {
  const socials = [
    { href: player.instagram, icon: Instagram, label: "Instagram" },
    { href: player.youtube, icon: Youtube, label: "YouTube" },
    { href: player.x, icon: Twitter, label: "X" },
  ].filter((s) => s.href);

  return (
    <TiltCard intensity={10}>
      <Link to={`/players/${player.slug}`} className="block" aria-label={`View ${player.ign}`}>
        <div className="glass group/card relative overflow-hidden rounded-2xl transition-all duration-300 hover:border-[hsl(var(--tsg-blue)/0.5)]">
          <div className="relative aspect-[4/5] overflow-hidden xs:aspect-[3/4]">
            <PlayerPhoto
              ign={player.ign}
              photoUrl={player.photoUrl}
              rounded="rounded-none"
              className="h-full w-full text-3xl transition-transform duration-500 group-hover/card:scale-105 xs:text-4xl"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[hsl(224_45%_4%)] via-transparent to-transparent" />
            {player.status === "substitute" && (
              <span className="absolute left-2 top-2 xs:left-3 xs:top-3 rounded-full border border-border bg-background/70 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-muted-foreground xs:text-[10px]">
                Sub
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 p-3 xs:p-4">
              <p className="font-display text-base xs:text-lg font-bold tracking-wide truncate">{player.ign}</p>
              <p className="truncate text-[10px] xs:text-xs font-semibold uppercase tracking-[0.15em] text-[hsl(var(--tsg-blue))]">
                {player.role ?? "Player"}
              </p>
              {player.team && (
                <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{player.team.name}</p>
              )}
            </div>
          </div>
          {socials.length > 0 && (
            <div className="flex justify-center gap-2 border-t border-border p-3 xs:p-4">
              {socials.map((s) => (
                <span
                  key={s.label}
                  role="link"
                  aria-label={s.label}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.open(s.href!, "_blank", "noreferrer");
                  }}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition",
                    "hover:border-[hsl(var(--tsg-blue)/0.6)] hover:text-[hsl(var(--tsg-blue))]",
                  )}
                >
                  <s.icon className="h-4 w-4" />
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>
    </TiltCard>
  );
}
