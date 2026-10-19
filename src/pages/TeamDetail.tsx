import { useParams, Link } from "react-router";
import { ArrowLeft, Trophy, Instagram, Youtube, ExternalLink, ImageOff } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { PageLayout } from "@/components/PageLayout";
import { SectionHeading } from "@/components/SectionHeading";
import { TeamLogo } from "@/components/TeamLogo";
import { PlayerCard } from "@/components/cards/PlayerCard";
import { TournamentCard } from "@/components/cards/TournamentCard";
import { CommentSection } from "@/components/CommentSection";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export default function TeamDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: team, isLoading } = trpc.public.teamBySlug.useQuery(
    { slug: slug ?? "" },
    { enabled: !!slug },
  );
  const { data: leaderboard } = trpc.public.teamLeaderboard.useQuery(
    { teamId: team?.id ?? 0 },
    { enabled: !!team?.id },
  );
  const { data: teamAchievements } = trpc.public.teamAchievements.useQuery(
    { teamSlug: slug ?? "" },
    { enabled: !!slug },
  );

  if (isLoading) {
    return (
      <PageLayout>
        <p className="py-32 text-center text-muted-foreground">Loading team...</p>
      </PageLayout>
    );
  }
  if (!team) {
    return (
      <PageLayout>
        <div className="py-32 text-center">
          <h1 className="font-display text-2xl font-bold">Team not found</h1>
          <Link to="/teams" className="mt-4 inline-block text-[hsl(var(--tsg-blue))] hover:underline">
            Back to teams
          </Link>
        </div>
      </PageLayout>
    );
  }

  const isRed = team.accent === "red";
  const active = team.roster.filter((p) => p.status === "active");
  const subs = team.roster.filter((p) => p.status === "substitute");
  const former = team.roster.filter((p) => p.status === "former");
  const ongoing = team.tournaments.filter((t) => t.status === "ongoing");
  const upcoming = team.tournaments.filter((t) => t.status === "upcoming");
  const completed = team.tournaments.filter((t) => t.status === "completed");

  return (
    <PageLayout>
      {/* Team hero */}
      <section
        className={cn(
          "relative overflow-hidden border-b border-border py-16 md:py-24",
          isRed
            ? "bg-[radial-gradient(ellipse_at_top,hsl(var(--tsg-red)/0.14),transparent_60%)]"
            : "bg-[radial-gradient(ellipse_at_top,hsl(var(--tsg-blue)/0.14),transparent_60%)]",
        )}
      >
        <div className="absolute inset-0 bg-grid opacity-60" />
        <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 text-center md:flex-row md:text-left">
          <TeamLogo name={team.name} logoUrl={team.logoUrl} accent={team.accent} size="xl" className="animate-float" />
          <div>
            <Link to="/teams" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3 w-3" /> All teams
            </Link>
            <h1 className="font-display text-3xl font-black tracking-wide md:text-5xl">{team.name}</h1>
            <p
              className={cn(
                "mt-1 text-sm font-semibold uppercase tracking-[0.25em]",
                isRed ? "text-[hsl(var(--tsg-red))]" : "text-[hsl(var(--tsg-blue))]",
              )}
            >
              {team.category}
            </p>
            {team.description && (
              <p className="mt-4 max-w-2xl text-muted-foreground">{team.description}</p>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-14 md:px-8">
          <Tabs defaultValue="roster">
          <TabsList className="mb-8 flex flex-wrap">
            <TabsTrigger value="roster" className="flex-1 min-w-[120px] xs:flex-none">ROSTER</TabsTrigger>
            <TabsTrigger value="staff" className="flex-1 min-w-[120px] xs:flex-none">STAFF</TabsTrigger>
            <TabsTrigger value="media" className="flex-1 min-w-[120px] xs:flex-none">MEDIA</TabsTrigger>
            <TabsTrigger value="tournaments" className="flex-1 min-w-[120px] xs:flex-none">TOURNAMENTS</TabsTrigger>
            <TabsTrigger value="leaderboard" className="flex-1 min-w-[120px] xs:flex-none">LEADERBOARD</TabsTrigger>
            <TabsTrigger value="achievements" className="flex-1 min-w-[120px] xs:flex-none">ACHIEVEMENTS</TabsTrigger>
            <TabsTrigger value="community" className="flex-1 min-w-[120px] xs:flex-none">COMMUNITY</TabsTrigger>
          </TabsList>

          <TabsContent value="roster" className="space-y-12">
            <section>
              <SectionHeading kicker="Active" title="STARTING ROSTER" />
              {active.length === 0 ? (
                <p className="text-muted-foreground">No active players announced yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
                  {active.map((p) => (
                    <PlayerCard key={p.id} player={{ ...p, team: { name: team.name } }} />
                  ))}
                </div>
              )}
            </section>
            {subs.length > 0 && (
              <section>
                <SectionHeading kicker="Bench" title="SUBSTITUTES" />
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
                  {subs.map((p) => (
                    <PlayerCard key={p.id} player={{ ...p, team: { name: team.name } }} />
                  ))}
                </div>
              </section>
            )}
            {former.length > 0 && (
              <section>
                <SectionHeading kicker="Alumni" title="FORMER PLAYERS" />
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
                  {former.map((p) => (
                    <PlayerCard key={p.id} player={{ ...p, team: { name: team.name } }} />
                  ))}
                </div>
              </section>
            )}
          </TabsContent>

          <TabsContent value="staff" className="space-y-12">
            <section>
              <SectionHeading kicker="Active" title="CURRENT STAFF" />
              {(team.staff ?? []).filter((s) => s.status === "active").length === 0 ? (
                <p className="text-muted-foreground">No active staff announced yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
                  {(team.staff ?? [])
                    .filter((s) => s.status === "active")
                    .map((s) => (
                      <div key={s.id} className="glass group/card relative overflow-hidden rounded-2xl border border-border transition-all duration-300 hover:border-[hsl(var(--tsg-blue)/0.5)]">
                        <div className="relative aspect-[3/4] overflow-hidden">
                          <PlayerPhoto ign={s.name} photoUrl={s.photoUrl} rounded="rounded-none" className="h-full w-full text-4xl transition-transform duration-500 group-hover/card:scale-105" />
                          <div className="absolute inset-0 bg-gradient-to-t from-[hsl(224_45%_4%)] via-[hsl(224_45%_4%/0.4)] to-transparent" />
                          <div className="absolute inset-x-0 bottom-0 p-4">
                            <p className="font-display text-lg font-bold tracking-wide">{s.name}</p>
                            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[hsl(var(--tsg-blue))]">
                              {s.role}
                            </p>
                            {s.bio && (
                              <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{s.bio}</p>
                            )}
                            {(s.instagram || s.youtube) && (
                              <div className="mt-2 flex items-center gap-2">
                                {s.instagram && (
                                  <a
                                    href={s.instagram}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background/20 text-muted-foreground transition hover:text-[hsl(var(--tsg-blue))]"
                                    aria-label="Instagram"
                                  >
                                    <Instagram className="h-3.5 w-3.5" />
                                  </a>
                                )}
                                {s.youtube && (
                                  <a
                                    href={s.youtube}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background/20 text-muted-foreground transition hover:text-[hsl(var(--tsg-blue))]"
                                    aria-label="YouTube"
                                  >
                                    <Youtube className="h-3.5 w-3.5" />
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </section>
            {(team.staff ?? []).filter((s) => s.status === "former").length > 0 && (
              <section>
                <SectionHeading kicker="Alumni" title="FORMER STAFF" />
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
                  {(team.staff ?? [])
                    .filter((s) => s.status === "former")
                    .map((s) => (
                      <div key={s.id} className="glass group/card relative overflow-hidden rounded-2xl border border-border transition-all duration-300 hover:border-[hsl(var(--tsg-blue)/0.5)]">
                        <div className="relative aspect-[3/4] overflow-hidden">
                          <PlayerPhoto ign={s.name} photoUrl={s.photoUrl} rounded="rounded-none" className="h-full w-full text-3xl xs:text-4xl transition-transform duration-500 group-hover/card:scale-105" />
                          <div className="absolute inset-0 bg-gradient-to-t from-[hsl(224_45%_4%)] via-[hsl(224_45%_4%/0.4)] to-transparent" />
                          <div className="absolute inset-x-0 bottom-0 p-3 xs:p-4">
                            <p className="font-display text-sm xs:text-base font-bold tracking-wide truncate">{s.name}</p>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                              {s.role}
                            </p>
                            {(s.instagram || s.youtube) && (
                              <div className="mt-2 flex items-center gap-2">
                                {s.instagram && (
                                  <a
                                    href={s.instagram}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background/20 text-muted-foreground transition hover:text-[hsl(var(--tsg-blue))]"
                                    aria-label="Instagram"
                                  >
                                    <Instagram className="h-3.5 w-3.5" />
                                  </a>
                                )}
                                {s.youtube && (
                                  <a
                                    href={s.youtube}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background/20 text-muted-foreground transition hover:text-[hsl(var(--tsg-blue))]"
                                    aria-label="YouTube"
                                  >
                                    <Youtube className="h-3.5 w-3.5" />
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            )}
          </TabsContent>

          <TabsContent value="media" className="space-y-10">
            {(team.media ?? []).length === 0 ? (
              <p className="text-muted-foreground">No media collections yet.</p>
            ) : (
              (team.media ?? []).map((m) => (
                <section key={m.id}>
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="font-display text-lg font-bold tracking-wide truncate">{m.name}</h3>
                      {m.date && (
                        <p className="text-xs text-muted-foreground">{new Date(m.date).toLocaleDateString()}</p>
                      )}
                      {m.description && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-1 truncate">{m.description}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {m.link && (
                        <a
                          href={m.link}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-3 py-1.5 text-xs font-semibold text-[hsl(var(--tsg-blue))] transition hover:bg-[hsl(var(--tsg-blue)/0.12)]"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> HD Photos
                        </a>
                      )}
                    </div>
                  </div>
                  {m.photoUrls && m.photoUrls.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {m.photoUrls.map((url: string, idx: number) => (
                        <div key={idx} className="glass group/card relative overflow-hidden rounded-xl border border-border transition hover:border-[hsl(var(--tsg-blue)/0.5)]">
                          <img src={url} alt={`${m.name} ${idx + 1}`} className="aspect-square w-full object-cover transition-transform duration-500 group-hover/card:scale-105" loading="lazy" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                      <ImageOff className="h-4 w-4" /> No photos in this collection.
                    </div>
                  )}
                </section>
              ))
            )}
          </TabsContent>

          <TabsContent value="tournaments" className="space-y-12">
            {ongoing.length > 0 && (
              <section>
                <SectionHeading kicker="Live" title="ONGOING" />
                <div className="grid gap-5 md:grid-cols-2">
                  {ongoing.map((t) => (
                    <TournamentCard key={t.id} tournament={{ ...t, team: { name: team.name } }} />
                  ))}
                </div>
              </section>
            )}
            <section>
              <SectionHeading kicker="Schedule" title="UPCOMING" />
              {upcoming.length === 0 ? (
                <p className="text-muted-foreground">No upcoming tournaments announced.</p>
              ) : (
                <div className="grid gap-5 md:grid-cols-2">
                  {upcoming.map((t) => (
                    <TournamentCard key={t.id} tournament={{ ...t, team: { name: team.name } }} />
                  ))}
                </div>
              )}
            </section>
            <section>
              <SectionHeading kicker="History" title="COMPLETED" />
              {completed.length === 0 ? (
                <p className="text-muted-foreground">No completed tournaments yet.</p>
              ) : (
                <div className="grid gap-5 md:grid-cols-2">
                  {completed.map((t) => (
                    <TournamentCard key={t.id} tournament={{ ...t, team: { name: team.name } }} />
                  ))}
                </div>
              )}
            </section>
          </TabsContent>

          <TabsContent value="leaderboard" className="space-y-12">
            <SectionHeading kicker="Rankings" title="PLAYER LEADERBOARD" description="Ranked by total finishes (kills). Avg finishes used as tie-breaker." />
            {!leaderboard || leaderboard.entries.length === 0 ? (
              <p className="text-muted-foreground">No finishes recorded yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="p-3">#</th>
                      <th className="p-3">Player</th>
                      <th className="p-3 text-right">Total Finishes</th>
                      <th className="p-3 text-right">Avg Finishes</th>
                      <th className="p-3 text-right">Matches</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.entries.map((entry, idx) => (
                      <tr key={entry.id} className="border-b border-border/50 last:border-0">
                        <td className="p-3 font-display font-bold">{idx + 1}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {entry.photoUrl ? (
                              <img src={entry.photoUrl} alt={entry.ign} className="h-7 w-7 rounded object-cover" />
                            ) : (
                              <span className="flex h-7 w-7 items-center justify-center rounded bg-muted text-xs font-bold">{entry.ign[0]}</span>
                            )}
                            <span className="font-semibold">{entry.ign}</span>
                          </div>
                        </td>
                        <td className="p-3 text-right font-display font-bold text-[hsl(var(--tsg-blue))]">{entry.totalKills}</td>
                        <td className="p-3 text-right text-muted-foreground">{entry.avgKills.toFixed(1)}</td>
                        <td className="p-3 text-right text-muted-foreground">{entry.matchesPlayed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="achievements">
            <SectionHeading kicker="Team Honors" title="ACHIEVEMENTS" />
            {!teamAchievements || teamAchievements.length === 0 ? (
              <p className="text-muted-foreground">No achievements awarded yet.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {teamAchievements.map((a) => (
                  <div key={a.id} className="glass overflow-hidden rounded-xl border border-border transition-all duration-300 hover:border-[hsl(var(--tsg-blue)/0.5)]">
                    <div className="flex items-center gap-4 p-5">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-background/40">
                        {a.placement ? (
                          <span className="font-display text-lg font-black text-[hsl(var(--tsg-blue))]">
                            #{a.placement}
                          </span>
                        ) : (
                          <Trophy className="h-6 w-6 text-[hsl(var(--tsg-blue))]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-display font-bold leading-tight">{a.achievement.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {new Date(a.earnedAt).toLocaleDateString()}
                          {a.tournament?.name ? ` · ${a.tournament.name}` : ""}
                        </p>
                      </div>
                    </div>
                    {a.achievement.description && (
                      <div className="border-t border-border/60 px-5 py-3">
                        <p className="text-sm text-muted-foreground">{a.achievement.description}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="community">
            {team.tournaments.length > 0 ? (
              <div className="space-y-4">
                <SectionHeading
                  kicker="Community"
                  title="TEAM DISCUSSION"
                  description={`Discussion is attached to ${team.name}'s most recent tournament.`}
                />
                <CommentSection tournamentId={team.tournaments[0].id} />
              </div>
            ) : (
              <p className="text-muted-foreground">
                No tournaments yet — community discussion opens with the first event.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
}
