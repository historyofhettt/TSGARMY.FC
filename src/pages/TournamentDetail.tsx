import { useState } from "react";
import { useParams, Link } from "react-router";
import { ArrowLeft, CalendarDays, Clock, Youtube, Instagram, ImageIcon, MessageSquare, Crown, Trophy, CheckCircle, XCircle } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { PageLayout } from "@/components/PageLayout";
import { SectionHeading } from "@/components/SectionHeading";
import { StatusBadge, LiveBadge } from "@/components/LiveBadge";
import { MatchCard } from "@/components/cards/MatchCard";
import { CommentSection } from "@/components/CommentSection";
import { PointTableViewer } from "@/components/PointTableViewer";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function TournamentDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: t, isLoading } = trpc.public.tournamentBySlug.useQuery(
    { slug: slug ?? "" },
    { enabled: !!slug, refetchInterval: 30000 },
  );
  const [viewerOpen, setViewerOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const { data: predictions, isLoading: predictionsLoading } = trpc.public.listPredictionsByTournamentSlug.useQuery({ slug: slug ?? "" });
  const { data: myVotes } = trpc.user.listMyPredictionVotes.useQuery(undefined, { enabled: !!isAuthenticated });
  const voteMutation = trpc.user.votePrediction.useMutation({
    onSuccess: () => { utils.user.listMyPredictionVotes.invalidate(); },
    onError: () => {},
  });

  if (isLoading) {
    return (
      <PageLayout>
        <p className="py-32 text-center text-muted-foreground">Loading tournament...</p>
      </PageLayout>
    );
  }
  if (!t) {
    return (
      <PageLayout>
        <div className="py-32 text-center">
          <h1 className="font-display text-2xl font-bold">Tournament not found</h1>
          <Link to="/tournaments" className="mt-4 inline-block text-[hsl(var(--tsg-blue))] hover:underline">
            Back to tournaments
          </Link>
        </div>
      </PageLayout>
    );
  }

  const statusBadge = (st: string) => {
    const map: Record<string, string> = { open: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", closed: "bg-amber-500/15 text-amber-400 border-amber-500/30", answered: "bg-blue-500/15 text-blue-400 border-blue-500/30" };
    return <Badge variant="outline" className={map[st] ?? ""}>{st.toUpperCase()}</Badge>;
  };
  const computeRemaining = (p: any): number | null => {
    if (p.status !== "open") return null;
    const now = Date.now();
    if (p.timerSeconds && p.timerSeconds > 0) {
      const close = new Date(p.createdAt).getTime() + p.timerSeconds * 1000;
      const diff = Math.max(0, Math.floor((close - now) / 1000));
      return diff;
    }
    if (p.closesAt) {
      const close = new Date(p.closesAt).getTime();
      const diff = Math.max(0, Math.floor((close - now) / 1000));
      return diff;
    }
    return null;
  };
  const isLive = t.status === "ongoing";

  return (
    <PageLayout>
      {/* Header */}
      <section className="relative overflow-hidden border-b border-border py-14 md:py-20">
        <div className="absolute inset-0 bg-radial-fade" />
        <div className="absolute inset-0 bg-grid opacity-50" />
        <div className="relative mx-auto max-w-7xl px-4 md:px-8">
          <Link to="/tournaments" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> All tournaments
          </Link>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
             {t.logoUrl ? (
               <img src={t.logoUrl} alt={`${t.name} logo`} className="h-16 w-16 rounded-xl object-contain sm:h-20 sm:w-20 md:h-28 md:w-28" />
             ) : (
               <span className="flex h-16 w-16 items-center justify-center rounded-xl border border-border bg-background/50 font-display text-xl font-bold text-muted-foreground sm:text-2xl md:text-2xl">
                 {t.name.slice(0, 2).toUpperCase()}
               </span>
             )}
             <div className="min-w-0 flex-1">
               <div className="flex flex-wrap items-center gap-3">
                 <h1 className="min-w-0 truncate font-display text-2xl font-black tracking-wide md:text-4xl">{t.name}</h1>
                 <StatusBadge status={t.status} />
               </div>
              {t.team && (
                <Link to={`/teams/${t.team.slug}`} className="mt-1 inline-block text-sm font-semibold text-[hsl(var(--tsg-blue))] hover:underline">
                  {t.team.name}
                </Link>
              )}
              {t.mvpPlayer && (
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <Crown className="h-4 w-4 text-[hsl(var(--tsg-red))]" />
                  <span className="font-semibold">MVP:</span>
                  <Link to={`/players/${t.mvpPlayer.slug}`} className="hover:text-[hsl(var(--tsg-blue))]">
                    {t.mvpPlayer.ign}
                  </Link>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" /> {formatDate(t.startDate)}
                </span>
                {t.startTime && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" /> {t.startTime}
                  </span>
                )}
                <span>{t.numberOfMatches} matches</span>
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4" /> {t.commentCount} comments
                </span>
              </div>
              {t.description && (
                <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">{t.description}</p>
              )}
              {(t.youtubeLiveUrl || t.instagramLiveUrl) && t.status !== "completed" && (
                <div className="mt-5 flex flex-wrap gap-3">
                  {t.youtubeLiveUrl && (
                    <a
                      href={t.youtubeLiveUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-lg bg-[hsl(var(--tsg-red))] px-5 py-2.5 font-display text-sm font-bold tracking-wider text-white transition hover:bg-[hsl(var(--tsg-red)/0.85)]"
                    >
                      <Youtube className="h-4 w-4" /> WATCH ON YOUTUBE
                    </a>
                  )}
                  {t.instagramLiveUrl && (
                    <a
                      href={t.instagramLiveUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-lg border border-[hsl(var(--tsg-blue)/0.6)] px-5 py-2.5 font-display text-sm font-bold tracking-wider text-[hsl(var(--tsg-blue))] transition hover:bg-[hsl(var(--tsg-blue)/0.12)]"
                    >
                      <Instagram className="h-4 w-4" /> INSTAGRAM LIVE
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {isLive && (
        <div className="border-b border-[hsl(var(--tsg-red)/0.3)] bg-[hsl(var(--tsg-red)/0.06)]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 md:px-8">
            <LiveBadge label="LIVE NOW" />
            <p className="text-sm font-semibold">
              {t.matches.length > 0
                ? `Match ${t.matches[t.matches.length - 1].matchNumber} of ${t.numberOfMatches} in progress`
                : "Tournament in progress"}
            </p>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
          <Tabs defaultValue="matches">
            <TabsList className="mb-10 w-full overflow-x-auto sm:w-fit">
              <TabsTrigger value="matches" className="flex-none min-w-[140px] sm:flex-1 sm:min-w-0">MATCH RESULTS</TabsTrigger>
              <TabsTrigger value="performance" className="flex-none min-w-[140px] sm:flex-1 sm:min-w-0">PLAYER PERFORMANCE</TabsTrigger>
              <TabsTrigger value="pointtable" className="flex-none min-w-[140px] sm:flex-1 sm:min-w-0">FINAL POINT TABLE</TabsTrigger>
              <TabsTrigger value="predictions" className="flex-none min-w-[140px] sm:flex-1 sm:min-w-0">PREDICTIONS</TabsTrigger>
              <TabsTrigger value="community" className="flex-none min-w-[140px] sm:flex-1 sm:min-w-0">COMMUNITY</TabsTrigger>
            </TabsList>

          <TabsContent value="matches" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {t.matches.length === 0 ? (
              <p className="col-span-full py-10 text-center text-muted-foreground">
                {t.status === "upcoming"
                  ? "Matches will appear here once the tournament begins."
                  : "No match results published yet."}
              </p>
            ) : (
              t.matches.map((m) => <MatchCard key={m.id} match={m} />)
            )}
          </TabsContent>

          <TabsContent value="performance">
            <SectionHeading kicker="Totals" title="TOURNAMENT PERFORMANCE" description="Aggregated across all matches in this tournament." />
            {t.playerTotals.length === 0 ? (
              <p className="text-muted-foreground">No performance data yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="p-2 xs:p-3">#</th>
                      <th className="p-2 xs:p-3">Player</th>
                      <th className="p-2 xs:p-3 text-right">Matches</th>
                      <th className="p-2 xs:p-3 text-right">Kills</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...t.playerTotals]
                      .sort((a, b) => b.kills - a.kills)
                      .map((row, i) => (
                        <tr key={row.player.id} className="border-b border-border/50 last:border-0">
                          <td className="p-2 xs:p-3 font-display font-bold text-muted-foreground">{i + 1}</td>
                          <td className="p-2 xs:p-3">
                            <Link to={`/players/${row.player.slug}`} className="flex items-center gap-2.5 font-semibold hover:text-[hsl(var(--tsg-blue))]">
                              <PlayerPhoto ign={row.player.ign} photoUrl={row.player.photoUrl} className="h-7 w-7 xs:h-8 xs:w-8 text-[10px]" rounded="rounded-md" />
                              {row.player.ign}
                            </Link>
                          </td>
                          <td className="p-2 xs:p-3 text-right">{row.matches}</td>
                          <td className="p-2 xs:p-3 text-right font-bold text-[hsl(var(--tsg-blue))]">{row.kills}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="pointtable">
            <SectionHeading kicker="Official" title="FINAL POINT TABLE" />
            {t.pointTableUrl ? (
              <div className="glass rounded-2xl p-8 text-center">
                <ImageIcon className="mx-auto h-10 w-10 text-[hsl(var(--tsg-blue))]" />
                <p className="mt-3 text-sm text-muted-foreground">
                  The official point table for this tournament is available.
                </p>
                <button
                  onClick={() => setViewerOpen(true)}
                  className="mt-5 rounded-lg bg-[hsl(var(--tsg-blue))] px-6 py-3 font-display text-sm font-bold tracking-[0.15em] text-white transition hover:bg-[hsl(var(--tsg-blue)/0.85)]"
                >
                  VIEW OFFICIAL POINT TABLE
                </button>
                <PointTableViewer
                  open={viewerOpen}
                  onOpenChange={setViewerOpen}
                  imageUrl={t.pointTableUrl}
                  title={`${t.name} — Final Point Table`}
                />
              </div>
            ) : (
              <p className="text-muted-foreground">
                {t.status === "completed"
                  ? "The official point table has not been uploaded yet."
                  : "The final point table will be published after the tournament concludes."}
              </p>
            )}
          </TabsContent>

          <TabsContent value="predictions">
            <SectionHeading kicker="Predictions" title="PREDICT AND EARN XP" />
            {predictionsLoading ? (
              <p className="text-muted-foreground">Loading predictions...</p>
            ) : !predictions || predictions.length === 0 ? (
              <p className="text-muted-foreground">No predictions available for this tournament yet.</p>
            ) : (
              <div className="space-y-6">
                {predictions.map((p: any) => {
                  const remaining = computeRemaining(p);
                  const myVote = (myVotes ?? []).find((v: any) => v.predictionId === p.id);
                  const isClosed = p.status === "closed" || p.status === "answered";
                  const effectiveClose = remaining === 0 && p.status === "open";

                  return (
                    <div key={p.id} className="glass rounded-xl p-4">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="font-display font-bold text-sm flex-1">{p.question}</span>
                        <Badge variant="outline" className="gap-1.5 px-3 py-1">
                          <Trophy className="h-3 w-3" />
                          +{p.xpReward} XP
                        </Badge>
                        {statusBadge(p.status)}
                        {remaining !== null && remaining > 0 && !isClosed && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            {remaining}s remaining
                          </span>
                        )}
                      </div>

                   <div className="grid gap-3 mb-3 sm:grid-cols-2">
                       {p.options.map((o: any) => {
                         const isSelected = myVote?.optionId === o.id;
                         const showResult = isClosed;
                         const isCorrect = o.id === p.correctOptionId;

                         let className = "h-auto p-3 xs:p-4 text-left justify-start gap-3 border-2 transition-all text-sm ";
                          if (showResult && isCorrect) {
                            className += "bg-[hsl(var(--tsg-green)/0.15)] border-[hsl(var(--tsg-green)/0.4)] text-[hsl(var(--tsg-green))]";
                          } else if (showResult && isSelected && !isCorrect) {
                            className += "bg-[hsl(var(--tsg-red)/0.15)] border-[hsl(var(--tsg-red)/0.4)] text-[hsl(var(--tsg-red))]";
                          } else if (isSelected) {
                            className += "border-[hsl(var(--tsg-blue)/0.6)] bg-[hsl(var(--tsg-blue)/0.05)]";
                          } else {
                            className += "hover:border-[hsl(var(--tsg-blue)/0.6)] hover:bg-[hsl(var(--tsg-blue)/0.05)]";
                          }

                          return (
                            <Button
                              key={o.id}
                              variant="outline"
                              className={className}
                              disabled={effectiveClose || voteMutation.isPending}
                              onClick={() => {
                                if (!isAuthenticated) {
                                  return;
                                }
                                if (effectiveClose) {
                                  return;
                                }
                                voteMutation.mutate({ predictionId: p.id, optionId: o.id });
                              }}
                            >
                              <span className="flex-1">{o.text}</span>
                              {showResult && isCorrect && (
                                <CheckCircle className="h-4 w-4 text-[hsl(var(--tsg-green))]" />
                              )}
                              {showResult && isSelected && !isCorrect && (
                                <XCircle className="h-4 w-4 text-[hsl(var(--tsg-red))]" />
                              )}
                            </Button>
                          );
                        })}
                      </div>

                      {!isAuthenticated && (
                        <p className="text-xs text-muted-foreground">
                          Sign in to make your prediction and earn XP for correct answers.
                        </p>
                      )}
                      {myVote && !effectiveClose && (
                        <p className="text-xs text-muted-foreground">Your current pick is saved. You can change it while the prediction is open.</p>
                      )}
                      {effectiveClose && (
                        <p className="text-xs text-muted-foreground">This prediction is no longer accepting votes.</p>
                      )}
                      {effectiveClose && (
                        <p className="text-xs text-[hsl(var(--tsg-green))] mt-1">
                          Correct answer: {p.options.find((o: any) => o.id === p.correctOptionId)?.text ?? "N/A"}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="community">
            <SectionHeading kicker="Discussion" title="COMMUNITY" />
            <CommentSection tournamentId={t.id} />
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
}
