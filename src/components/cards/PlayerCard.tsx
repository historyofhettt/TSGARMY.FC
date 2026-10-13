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
          <div className="relative aspect-[4/5] overflow-hidden">
            <PlayerPhoto
              ign={player.ign}
              photoUrl={player.photoUrl}
              rounded="rounded-none"
              className="h-full w-full text-4xl transition-transform duration-500 group-hover/card:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[hsl(224_45%_4%)] via-transparent to-transparent" />
            {player.status === "substitute" && (
              <span className="absolute left-3 top-3 rounded-full border border-border bg-background/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Sub
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 p-4">
              <p className="font-display text-lg font-bold tracking-wide">{player.ign}</p>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(var(--tsg-blue))]">
                {player.role ?? "Player"}
              </p>
              {player.team && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">{player.team.name}</p>
              )}
            </div>
          </div>
          {socials.length > 0 && (
            <div className="flex gap-2 border-t border-border p-3">
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
                    "flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-border text-muted-foreground transition",
                    "hover:border-[hsl(var(--tsg-blue)/0.6)] hover:text-[hsl(var(--tsg-blue))]",
                  )}
                >
                  <s.icon className="h-3.5 w-3.5" />
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>
    </TiltCard>
  );
}
