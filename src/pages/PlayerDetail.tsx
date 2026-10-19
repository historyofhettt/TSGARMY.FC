import { useParams, Link, useNavigate } from "react-router";
import { useEffect } from "react";
import { ArrowLeft, Instagram, Youtube, Twitter, Crosshair, Target, Trophy, Star } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { PageLayout } from "@/components/PageLayout";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { SectionHeading } from "@/components/SectionHeading";
import { HighlightUpload } from "@/components/HighlightUpload";
import { HighlightPlayerCard } from "@/components/HighlightPlayerCard";
import { ordinal, formatDate } from "@/lib/format";
import type { RouterOutputs } from "@contracts/types";

type Player = NonNullable<RouterOutputs["public"]["playerBySlug"]>;

export default function PlayerDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: redirectInfo } = trpc.public.playerRedirect.useQuery(
    { slug: slug ?? "" },
    { enabled: !!slug },
  );

  useEffect(() => {
    if (redirectInfo?.redirect) {
      navigate(`/players/${redirectInfo.redirect}`, { replace: true });
    }
  }, [redirectInfo, navigate]);

  const { data: player, isLoading } = trpc.public.playerBySlug.useQuery(
    { slug: slug ?? "" },
    { enabled: !!slug },
  );
  const { data: playerAchievements } = trpc.public.playerAchievements.useQuery(
    { playerSlug: slug ?? "" },
    { enabled: !!slug },
  );

  if (isLoading) {
    return (
      <PageLayout>
        <p className="py-32 text-center text-muted-foreground">Loading player...</p>
      </PageLayout>
    );
  }
  if (!player) {
    return (
      <PageLayout>
        <div className="py-32 text-center">
          <h1 className="font-display text-2xl font-bold">Player not found</h1>
          <Link to="/players" className="mt-4 inline-block text-[hsl(var(--tsg-blue))] hover:underline">
            Back to players
          </Link>
        </div>
      </PageLayout>
    );
  }

  const s = player.stats;
  const statCards = [
    { icon: Target, label: "Matches Played", value: s.matchesPlayed },
    { icon: Crosshair, label: "Total Kills", value: s.totalKills },
    { icon: Star, label: "Avg Kills", value: s.averageKills.toFixed(1) },
  ];

  const socials = [
    { href: player.instagram, icon: Instagram, label: "Instagram" },
    { href: player.youtube, icon: Youtube, label: "YouTube" },
    { href: player.x, icon: Twitter, label: "X" },
  ].filter((x) => x.href);

  return (
    <PageLayout>
      <section className="relative overflow-hidden border-b border-border py-14 md:py-20">
        <div className="absolute inset-0 bg-radial-fade" />
        <div className="absolute inset-0 bg-grid opacity-50" />
        <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-8 px-4 md:flex-row md:items-end md:px-8">
          <PlayerPhoto
            ign={player.ign}
            photoUrl={player.photoUrl}
            className="h-44 w-44 text-5xl ring-2 ring-[hsl(var(--tsg-blue)/0.5)] md:h-56 md:w-56"
            rounded="rounded-2xl"
          />
          <div className="text-center md:text-left">
            <Link to="/players" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3 w-3" /> All players
            </Link>
            <h1 className="font-display text-3xl font-black tracking-wide md:text-5xl">{player.ign}</h1>
            {player.realName && (
              <p className="mt-1 text-lg text-muted-foreground">{player.realName}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-sm md:justify-start">
              {player.team && (
                <Link
                  to={`/teams/${player.team.slug}`}
                  className="rounded-md border border-[hsl(var(--tsg-blue)/0.5)] bg-[hsl(var(--tsg-blue)/0.1)] px-3 py-1 font-semibold text-[hsl(var(--tsg-blue))]"
                >
                  {player.team.name}
                </Link>
              )}
              {player.role && (
                <span className="rounded-md border border-border px-3 py-1 uppercase tracking-wider text-muted-foreground">
                  {player.role}
                </span>
              )}
              <span className="rounded-md border border-border px-3 py-1 uppercase tracking-wider text-muted-foreground">
                {player.status}
              </span>
              {player.joinedDate && (
                <span className="text-muted-foreground">Joined {formatDate(player.joinedDate)}</span>
              )}
            </div>
            {socials.length > 0 && (
              <div className="mt-4 flex justify-center gap-2 md:justify-start">
                {socials.map((x) => (
                  <a
                    key={x.label}
                    href={x.href!}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={x.label}
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:border-[hsl(var(--tsg-blue)/0.6)] hover:text-[hsl(var(--tsg-blue))]"
                  >
                    <x.icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-14 md:px-8">
        {player.bio && (
          <section className="mb-14">
            <SectionHeading kicker="Biography" title="ABOUT" />
            <p className="max-w-3xl leading-relaxed text-muted-foreground">{player.bio}</p>
          </section>
        )}

        <section className="mb-14">
          <SectionHeading kicker="Career" title="STATISTICS" description="Calculated live from official match performance data." />
          {s.matchesPlayed === 0 ? (
            <p className="text-muted-foreground">No recorded matches yet — statistics appear after the first tournament.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {statCards.map((c) => (
                  <div key={c.label} className="glass rounded-xl p-3 xs:p-5 text-center">
                    <c.icon className="mx-auto mb-1.5 h-5 w-5 text-[hsl(var(--tsg-blue))] xs:h-6 xs:w-6" />
                    <p className="font-display text-xl xs:text-2xl font-black">{c.value}</p>
                    <p className="mt-0.5 text-[10px] xs:text-[11px] uppercase tracking-wider text-muted-foreground">{c.label}</p>
                  </div>
                ))}
              </div>
              {s.bestMatch && (
                <div className="glass mt-4 rounded-xl p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-[hsl(var(--tsg-red))]">Best Match</p>
                  <p className="mt-2 font-semibold">
                    {s.bestMatch.tournamentName} — Match {s.bestMatch.matchNumber}
                    {s.bestMatch.mapName ? ` · ${s.bestMatch.mapName}` : ""}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {s.bestMatch.kills} finishes
                  </p>
                </div>
              )}
            </>
          )}
        </section>

        {(playerAchievements ?? []).length > 0 && (
          <section className="mb-14">
            <SectionHeading kicker="Honors" title="ACHIEVEMENTS" />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {(playerAchievements ?? []).map((a) => (
                <div key={a.id} className="glass rounded-xl p-4 text-center">
                  <Trophy className="mx-auto mb-2 h-6 w-6 text-[hsl(var(--tsg-blue))]" />
                  <p className="font-display text-sm font-bold">{a.achievement.name}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {new Date(a.earnedAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

    {player.recentPerformances.length > 0 && (
          <section>
            <SectionHeading kicker="History" title="RECENT PERFORMANCES" />
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="p-2 xs:p-3">Tournament</th>
                      <th className="p-2 xs:p-3">Match</th>
                      <th className="p-2 xs:p-3">Map</th>
                      <th className="p-2 xs:p-3 text-right">Kills</th>
                      <th className="p-2 xs:p-3 text-right">Placement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {player.recentPerformances.map((r) => (
                      <tr key={r.matchId} className="border-b border-border/50 last:border-0">
                        <td className="p-2 xs:p-3">{r.tournamentName}</td>
                        <td className="p-2 xs:p-3">Match {r.matchNumber}</td>
                        <td className="p-2 xs:p-3">{r.mapName ?? "—"}</td>
                        <td className="p-2 xs:p-3 text-right font-semibold">{r.kills}</td>
                        <td className="p-2 xs:p-3 text-right">{ordinal(r.placement)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          </section>
        )}
      </div>

      <HighlightsSection player={player} />
    </PageLayout>
  );
}

function HighlightsSection({ player }: { player: Player }) {
  const { data: highlights, isLoading } = trpc.highlights.listByPlayer.useQuery(
    { playerId: player.id },
    { staleTime: 60_000 },
  );

  return (
    <section className="mx-auto max-w-7xl px-4 py-14 md:px-8">
      <SectionHeading
        kicker="Clutch Moments"
        title="HIGHLIGHTS"
        description="Community-submitted clutch plays and highlight reels."
      />

      <div className="mb-8">
        <HighlightUpload playerId={player.id} playerUserId={player.userId ?? null} />
      </div>

      {isLoading && (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading highlights...</p>
      )}

      {!isLoading && highlights && highlights.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground">No highlights yet. Be the first to share a clutch play!</p>
        </div>
      )}

      {!isLoading && highlights && highlights.length > 0 && (
        <div className="space-y-8">
          {highlights.map((h) => (
            <HighlightPlayerCard
              key={h.id}
              highlight={{
                id: h.id,
                title: h.title,
                description: h.description ?? null,
                videoType: (h.videoType as "youtube" | "upload") ?? "youtube",
                youtubeVideoId: h.youtubeVideoId ?? null,
                videoUrl: h.videoUrl ?? null,
                thumbnailUrl: h.thumbnailUrl ?? null,
                embedUrl: h.embedUrl ?? null,
                watchUrl: h.youtubeVideoId
                  ? `https://www.youtube.com/watch?v=${h.youtubeVideoId}`
                  : null,
                views: h.views ?? 0,
                likes: h.likes ?? 0,
                hasLiked: false,
                createdAt: h.createdAt,
                player: h.player,
                team: h.team ?? null,
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
