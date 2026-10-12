import { useState } from "react";
import { useParams, Link } from "react-router";
import { ArrowLeft, MapPin, Pencil, Plus, Sparkles, Trash2, Users, Crown } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { StatusBadge } from "@/components/LiveBadge";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import type { RouterOutputs } from "@contracts/types";

type Detail = NonNullable<RouterOutputs["admin"]["getTournamentAdmin"]>;
type Match = Detail["matches"][number];
type MatchPlayer = Match["matchPlayers"][number];

type LineupDraft = {
  lineupStatus: "played" | "bench" | "dnp";
  kills: string;
  specialMoment: string;
};

const blankDraft: LineupDraft = {
  lineupStatus: "played",
  kills: "0",
  specialMoment: "",
};

export default function TournamentAdminDetail() {
  const { id } = useParams<{ id: string }>();
  const tournamentId = Number(id);
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.admin.getTournamentAdmin.useQuery(
    { id: tournamentId },
    { enabled: Number.isFinite(tournamentId) },
  );
  const { data: mapList } = trpc.admin.listMaps.useQuery();

  const [matchDialog, setMatchDialog] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [matchForm, setMatchForm] = useState({ matchNumber: 1, mapId: 0, mapImageKey: null as string | null, mapImageUrl: null as string | null, placementPoints: 0, finishPoints: 0, totalPoints: 0, officialTotalPoints: null as number | null });

  const [lineupMatch, setLineupMatch] = useState<Match | null>(null);
  const [drafts, setDrafts] = useState<Record<number, LineupDraft>>({});

  const [mvpDialog, setMvpDialog] = useState(false);
  const [mvpPlayerId, setMvpPlayerId] = useState<number | null>(null);

  const refresh = () => {
    utils.admin.getTournamentAdmin.invalidate({ id: tournamentId });
    utils.public.tournamentBySlug.invalidate();
    utils.public.live.invalidate();
  };

  const setMvp = trpc.admin.setTournamentMVP.useMutation({
    onSuccess: () => {
      toast.success("MVP updated.");
      setMvpDialog(false);
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const removeMvp = trpc.admin.setTournamentMVP.useMutation({
    onSuccess: () => {
      toast.success("MVP removed.");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const saveMvp = () => {
    setMvp.mutate({ tournamentId, mvpPlayerId });
  };

  const handleRemoveMvp = () => {
    removeMvp.mutate({ tournamentId, mvpPlayerId: null });
  };

  const setStatus = trpc.admin.upsertTournament.useMutation({
    onSuccess: () => {
      toast.success("Status updated.");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const setPointTable = trpc.admin.upsertTournament.useMutation({
    onSuccess: () => {
      toast.success("Point table updated.");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const upsertMatch = trpc.admin.upsertMatch.useMutation({
    onSuccess: () => {
      toast.success(editingMatch ? "Match updated." : "Match added.");
      setMatchDialog(false);
      refresh();
    },
    onError: (e) => toast.error(`Unable to save match. ${e.message}`),
  });
  const deleteMatch = trpc.admin.deleteMatch.useMutation({
    onSuccess: () => {
      toast.success("Match deleted.");
      refresh();
    },
    onError: (e) => toast.error(`Unable to delete match. ${e.message}`),
  });
  const saveLineup = trpc.admin.setMatchLineup.useMutation({
    onSuccess: () => {
      toast.success("Lineup saved.");
      setLineupMatch(null);
      refresh();
    },
    onError: (e) => toast.error(`Unable to save lineup. ${e.message}`),
  });

  if (isLoading || !data) {
    return (
      <AdminLayout title="Tournament">
        <p className="text-muted-foreground">Loading tournament...</p>
      </AdminLayout>
    );
  }

  const openLineupEditor = (m: Match) => {
    const d: Record<number, LineupDraft> = {};
    for (const p of data.roster) {
      const existing: MatchPlayer | undefined = m.matchPlayers.find((x) => x.playerId === p.id);
      d[p.id] = existing
        ? {
            lineupStatus: existing.lineupStatus as "played" | "bench" | "dnp",
            kills: String(existing.kills),
            specialMoment: existing.specialMoment ?? "",
          }
        : { ...blankDraft };
    }
    setDrafts(d);
    setLineupMatch(m);
  };

  const openMatchEditor = (m: Match) => {
    const selectedMap = mapList?.find((map) => map.id === m.mapId);
    setEditingMatch(m);
    setMatchForm({
      matchNumber: m.matchNumber,
      mapId: m.mapId ?? 0,
      mapImageKey: selectedMap?.imageKey ?? null,
      mapImageUrl: selectedMap?.imageUrl ?? null,
      placementPoints: m.placementPoints ?? 0,
      finishPoints: m.finishPoints ?? 0,
      totalPoints: m.totalPoints ?? 0,
      officialTotalPoints: m.officialTotalPoints ?? null,
    });
    setMatchDialog(true);
  };

  const saveLineupDraft = () => {
    if (!lineupMatch) return;
    const playedCount = Object.values(drafts).filter((d) => d.lineupStatus === "played").length;
    if (playedCount > 4) {
      toast.error("Maximum 4 PLAYED players allowed per match.");
      return;
    }
    const lineup = data.roster.map((p) => {
      const d = drafts[p.id];
      const kills = Number(d.kills) || 0;
      return {
        playerId: p.id,
        lineupStatus: d.lineupStatus,
        kills,
        specialMoment: d.specialMoment || null,
      };
    });
    saveLineup.mutate({ matchId: lineupMatch.id, lineup });
  };

  const playedCount = Object.values(drafts).filter((d) => d.lineupStatus === "played").length;
  const benchCount = Object.values(drafts).filter((d) => d.lineupStatus === "bench").length;
  const dnpCount = Object.values(drafts).filter((d) => d.lineupStatus === "dnp").length;

  return (
    <AdminLayout title={data.name}>
      <Link to="/admin/tournaments" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> All tournaments
      </Link>

      {/* Tournament header controls */}
      <div className="glass mb-6 rounded-xl p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-display text-lg font-bold">{data.name}</h2>
              <StatusBadge status={data.status} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDate(data.startDate)} {data.startTime ? `· ${data.startTime}` : ""} · {data.numberOfMatches} matches planned
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select
              value={data.status}
              onValueChange={(v) =>
                setStatus.mutate({
                  id: data.id,
                  teamId: data.teamId ?? 0,
                  name: data.name,
                  status: v as "upcoming" | "ongoing" | "completed",
                  numberOfMatches: data.numberOfMatches,
                })
              }
            >
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="ongoing">Ongoing (Live)</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 border-t border-border pt-4">
          <ImageUpload
            label="Final Point Table Image"
            value={data.pointTableKey}
            previewUrl={data.pointTableUrl}
            category="point-tables"
            onUploaded={(key) =>
              setPointTable.mutate({
                id: data.id,
                teamId: data.teamId ?? 0,
                name: data.name,
                numberOfMatches: data.numberOfMatches,
                pointTableKey: key,
              })
            }
          />
        </div>
        </div>

      {/* MVP */}
      <div className="glass mb-6 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-sm font-bold tracking-widest">TOURNAMENT MVP</h3>
            {data.mvpPlayer ? (
              <div className="mt-2 flex items-center gap-3">
                <PlayerPhoto ign={data.mvpPlayer.ign} photoUrl={data.mvpPlayer.photoUrl} className="h-10 w-10 text-xs" rounded="rounded-md" />
                <div>
                  <p className="font-semibold">{data.mvpPlayer.ign}</p>
                  <p className="text-xs text-muted-foreground">{data.mvpPlayer.realName ?? ""}</p>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">No MVP assigned.</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setMvpDialog(true)}>
              <Crown className="mr-1.5 h-4 w-4" /> {data.mvpPlayer ? "Change MVP" : "Assign MVP"}
            </Button>
            {data.mvpPlayer && (
              <ConfirmDialog
                trigger={<Button size="sm" variant="outline" className="text-[hsl(var(--tsg-red))]">Remove</Button>}
                title="Remove MVP?"
                description="This will remove the MVP assignment from this tournament."
                onConfirm={handleRemoveMvp}
              />
            )}
          </div>
        </div>
      </div>

      {/* Matches */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-sm font-bold tracking-widest">MATCHES ({data.matches.length})</h3>
          <Button
            size="sm"
            className="gap-1.5 bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]"
            onClick={() => {
              setEditingMatch(null);
              const nextNumber = (data.matches[data.matches.length - 1]?.matchNumber ?? 0) + 1;
              setMatchForm({ matchNumber: nextNumber, mapId: 0, mapImageKey: null, mapImageUrl: null, placementPoints: 0, finishPoints: 0, totalPoints: 0, officialTotalPoints: null });
              setMatchDialog(true);
            }}
          >
          <Plus className="h-4 w-4" /> Add Match
        </Button>
      </div>

      {data.matches.length === 0 ? (
        <p className="glass rounded-xl p-8 text-center text-sm text-muted-foreground">
          No matches yet. Add Match 1 to start recording results.
        </p>
      ) : (
        <div className="space-y-3">
          {data.matches.map((m) => {
            const played = m.matchPlayers.filter((p) => p.lineupStatus === "played").length;
            const bench = m.matchPlayers.filter((p) => p.lineupStatus === "bench").length;
            const dnp = m.matchPlayers.filter((p) => p.lineupStatus === "dnp").length;
            return (
              <div key={m.id} className="glass rounded-xl p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-display text-base font-bold tracking-wider">MATCH {m.matchNumber}</span>
                  {m.mapName && (
                    <span className="flex items-center gap-1.5 rounded-md border border-border px-2 py-0.5 text-xs font-bold text-[hsl(var(--tsg-blue))]">
                      {m.map?.imageUrl ? (
                        <img src={m.map.imageUrl} alt={m.mapName} className="h-4 w-6 rounded object-cover" />
                      ) : (
                        <MapPin className="h-3 w-3" />
                      )}
                      {m.mapName.toUpperCase()}
                    </span>
                  )}
                  {m.specialMoment && (
                    <span className="flex items-center gap-1 text-xs text-[hsl(var(--tsg-red))]">
                      <Sparkles className="h-3 w-3" /> {m.specialMoment}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {played} played · {bench} bench · {dnp} dnp
                  </span>
                  <div className="ml-auto flex gap-1.5">
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openLineupEditor(m)}>
                      <Users className="h-4 w-4" /> Lineup
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label="Edit match"
                      onClick={() => openMatchEditor(m)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button size="icon" variant="outline" aria-label="Delete match">
                          <Trash2 className="h-4 w-4 text-[hsl(var(--tsg-red))]" />
                        </Button>
                      }
                      title={`Delete Match ${m.matchNumber}?`}
                      description="All recorded player lineup data for this match will be removed."
                      onConfirm={() => deleteMatch.mutate({ id: m.id })}
                    />
                  </div>
                </div>
                {m.matchPlayers.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                    {[...m.matchPlayers]
                      .sort((a, b) => b.kills - a.kills)
                      .map((p) => {
                        const pl = data.roster.find((r) => r.id === p.playerId);
                        return (
                          <span key={p.id} className="rounded-md border border-border bg-background/40 px-2.5 py-1 text-xs">
                            <b>{pl?.ign ?? `#${p.playerId}`}</b>
                            <span className="text-muted-foreground">
                              {" "}· {p.kills} kills · {p.lineupStatus}
                            </span>
                            {p.officialTotalPoints !== null && p.officialTotalPoints !== undefined && (
                              <span className="text-[hsl(var(--tsg-red))]"> · OFF {p.officialTotalPoints} pts</span>
                            )}
                          </span>
                        );
                      })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Match info dialog */}
      <Dialog open={matchDialog} onOpenChange={setMatchDialog}>
        <DialogContent className="glass-strong border-border sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingMatch ? `Edit Match ${editingMatch.matchNumber}` : "Add Match"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Match Number</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={matchForm.matchNumber}
                onChange={(e) => setMatchForm({ ...matchForm, matchNumber: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Map</Label>
              <Select
                value={matchForm.mapId ? String(matchForm.mapId) : ""}
                onValueChange={(v) => {
                  const selected = mapList?.find((m) => String(m.id) === v);
                  setMatchForm({
                    ...matchForm,
                    mapId: Number(v),
                    mapImageKey: selected?.imageKey ?? null,
                    mapImageUrl: selected?.imageUrl ?? null,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select map" />
                </SelectTrigger>
                <SelectContent>
                  {(mapList ?? [])
                    .filter((m) => m.isActive)
                    .map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {matchForm.mapId && (
              <div>
                <Label>Map Photo</Label>
                <div className="mt-1 aspect-square w-full overflow-hidden rounded-xl border border-border bg-background/40">
                  {matchForm.mapImageUrl ? (
                    <img src={matchForm.mapImageUrl} alt="Map preview" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <MapPin className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Placement Points</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={matchForm.placementPoints ?? editingMatch?.placementPoints ?? 0}
                  onChange={(e) => setMatchForm({ ...matchForm, placementPoints: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Finish Points</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={matchForm.finishPoints ?? editingMatch?.finishPoints ?? 0}
                  onChange={(e) => setMatchForm({ ...matchForm, finishPoints: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Total Points</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={matchForm.totalPoints ?? editingMatch?.totalPoints ?? 0}
                  onChange={(e) => setMatchForm({ ...matchForm, totalPoints: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Overall Points</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={matchForm.officialTotalPoints ?? editingMatch?.officialTotalPoints ?? 0}
                  onChange={(e) => setMatchForm({ ...matchForm, officialTotalPoints: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMatchDialog(false)}>Cancel</Button>
              <Button
                disabled={upsertMatch.isPending}
                className="bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]"
                onClick={() =>
                  upsertMatch.mutate({
                    id: editingMatch?.id,
                    tournamentId,
                    matchNumber: matchForm.matchNumber,
                    mapId: matchForm.mapId || null,
                    specialMoment: editingMatch?.specialMoment ?? null,
                    placementPoints: matchForm.placementPoints ?? 0,
                    finishPoints: matchForm.finishPoints ?? 0,
                    totalPoints: matchForm.totalPoints ?? 0,
                    officialTotalPoints: matchForm.officialTotalPoints ?? null,
                  })
                }
              >
                {upsertMatch.isPending ? "Saving match..." : "Save Match"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lineup editor */}
      <Dialog open={!!lineupMatch} onOpenChange={(v) => !v && setLineupMatch(null)}>
        <DialogContent className="glass-strong flex h-[94vh] max-w-3xl flex-col border-border p-0">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle>
              Match {lineupMatch?.matchNumber} — Lineup
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Select lineup status for each roster player. Max 4 PLAYED players per match.
            </p>
          </DialogHeader>
          <div className="flex-1 space-y-3 overflow-y-auto p-5">
            {data.roster.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                This team has no players. Add players first.
              </p>
            )}
            {data.roster.map((p) => {
              const d = drafts[p.id] ?? blankDraft;
              const isPlayed = d.lineupStatus === "played";
              const playedSoFar = Object.values(drafts).filter((x) => x.lineupStatus === "played").length;
              const canSelectPlayed = isPlayed || playedSoFar < 4;
              return (
                <div
                  key={p.id}
                  className={cn(
                    "rounded-xl border p-4 transition",
                    isPlayed ? "border-[hsl(var(--tsg-blue)/0.5)] bg-[hsl(var(--tsg-blue)/0.05)]" : "border-border bg-background/40 opacity-70",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <PlayerPhoto ign={p.ign} photoUrl={p.photoUrl} className="h-9 w-9 text-xs" rounded="rounded-md" />
                    <span className="font-semibold">{p.ign}</span>
                    <span className="text-xs text-muted-foreground">{p.role}</span>
                    <Select
                      value={d.lineupStatus}
                      onValueChange={(v) => setDrafts({ ...drafts, [p.id]: { ...d, lineupStatus: v as "played" | "bench" | "dnp" } })}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="played" disabled={!canSelectPlayed}>PLAYED</SelectItem>
                        <SelectItem value="bench">BENCH</SelectItem>
                        <SelectItem value="dnp">DNP</SelectItem>
                      </SelectContent>
                    </Select>
                    {!canSelectPlayed && (
                      <span className="text-[10px] text-[hsl(var(--tsg-red))]">Max 4 PLAYED reached</span>
                    )}
                  </div>
                  {isPlayed && (
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <Label className="text-xs">Finishes / Kills</Label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          className="mt-1 h-11 text-base"
                          value={d.kills}
                          onChange={(e) => setDrafts({ ...drafts, [p.id]: { ...d, kills: e.target.value } })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Special Moment</Label>
                        <Input
                          className="mt-1 h-11"
                          placeholder="Optional"
                          value={d.specialMoment}
                          onChange={(e) => setDrafts({ ...drafts, [p.id]: { ...d, specialMoment: e.target.value } })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-border bg-[hsl(224_45%_6%)] px-5 py-3.5">
            <p className="text-sm text-muted-foreground">
              {playedCount} played · {benchCount} bench · {dnpCount} dnp
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setLineupMatch(null)}>Cancel</Button>
              <Button
                onClick={saveLineupDraft}
                disabled={saveLineup.isPending || playedCount > 4}
                className="bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]"
              >
                {saveLineup.isPending ? "Saving lineup..." : "Save Lineup"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* MVP dialog */}
      <Dialog open={mvpDialog} onOpenChange={setMvpDialog}>
        <DialogContent className="glass-strong border-border sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Tournament MVP</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>MVP Player</Label>
              <Select
                value={mvpPlayerId ? String(mvpPlayerId) : ""}
                onValueChange={(v) => setMvpPlayerId(Number(v))}
              >
                <SelectTrigger><SelectValue placeholder="Select player" /></SelectTrigger>
                <SelectContent>
                  {(data.roster ?? []).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.ign}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMvpDialog(false)}>Cancel</Button>
              <Button onClick={saveMvp} disabled={setMvp.isPending} className="bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]">
                {setMvp.isPending ? "Saving..." : "Save MVP"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
