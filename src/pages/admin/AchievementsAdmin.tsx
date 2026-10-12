import { useState } from "react";
import { Trophy, Award, Users, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AchievementsAdmin() {
  const utils = trpc.useUtils();
  const { data: teamList } = trpc.admin.listTeams.useQuery();
  const { data: playerAwards } = trpc.admin.listPlayerAchievements.useQuery();
  const { data: teamAwards } = trpc.admin.listTeamAchievements.useQuery();

  const [awardPlayerOpen, setAwardPlayerOpen] = useState(false);
  const [awardTeamOpen, setAwardTeamOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);

  const { data: teamPlayerList } = trpc.admin.listPlayers.useQuery(
    { teamId: selectedTeam ?? undefined },
    { enabled: !!selectedTeam },
  );
  const [playerAwardForm, setPlayerAwardForm] = useState({
    title: "",
    tournamentName: "",
    achievementType: "",
    position: "",
    liquipediaUrl: "",
    photoKey: null as string | null,
    photoUrl: null as string | null,
    earnedAt: new Date().toISOString().slice(0, 16),
    description: "",
  });

  const [teamAwardForm, setTeamAwardForm] = useState({
    title: "",
    tournamentName: "",
    achievementType: "",
    position: "",
    liquipediaUrl: "",
    photoKey: null as string | null,
    photoUrl: null as string | null,
    earnedAt: new Date().toISOString().slice(0, 16),
    description: "",
  });

  const refresh = () => {
    utils.admin.listPlayerAchievements.invalidate();
    utils.admin.listTeamAchievements.invalidate();
  };

  const awardPlayer = trpc.admin.awardPlayerAchievement.useMutation({
    onSuccess: () => {
      toast.success("Achievement awarded to player.");
      setAwardPlayerOpen(false);
      setSelectedPlayer(null);
      setSelectedTeam(null);
      setPlayerAwardForm({ title: "", tournamentName: "", achievementType: "", position: "", liquipediaUrl: "", photoKey: null, photoUrl: null, earnedAt: new Date().toISOString().slice(0, 16), description: "" });
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const removePlayer = trpc.admin.removePlayerAchievement.useMutation({
    onSuccess: () => {
      toast.success("Player achievement removed.");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const awardTeam = trpc.admin.awardTeamAchievement.useMutation({
    onSuccess: () => {
      toast.success("Achievement awarded to team.");
      setAwardTeamOpen(false);
      setSelectedTeam(null);
      setTeamAwardForm({ title: "", tournamentName: "", achievementType: "", position: "", liquipediaUrl: "", photoKey: null, photoUrl: null, earnedAt: new Date().toISOString().slice(0, 16), description: "" });
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const removeTeam = trpc.admin.removeTeamAchievement.useMutation({
    onSuccess: () => {
      toast.success("Team achievement removed.");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleAwardPlayer = () => {
    if (!playerAwardForm.title.trim()) return toast.error("Title is required.");
    if (!selectedPlayer) return toast.error("Select a player.");
    const desc = playerAwardForm.description || null;
    awardPlayer.mutate({
      playerId: selectedPlayer,
      title: playerAwardForm.title.trim(),
      earnedAt: playerAwardForm.earnedAt ? new Date(playerAwardForm.earnedAt) : new Date(),
      tournamentId: null,
      matchId: null,
      metadata: desc,
      tournamentName: playerAwardForm.tournamentName || null,
      achievementType: playerAwardForm.achievementType || null,
      position: playerAwardForm.position || null,
      liquipediaUrl: playerAwardForm.liquipediaUrl || null,
      photoKey: playerAwardForm.photoKey || null,
    });
  };

  const handleAwardTeam = () => {
    if (!teamAwardForm.title.trim()) return toast.error("Title is required.");
    if (!selectedTeam) return toast.error("Select a team.");
    const desc = teamAwardForm.description || null;
    awardTeam.mutate({
      teamId: selectedTeam,
      title: teamAwardForm.title.trim(),
      earnedAt: teamAwardForm.earnedAt ? new Date(teamAwardForm.earnedAt) : new Date(),
      tournamentId: null,
      metadata: desc,
      placement: null,
      tournamentName: teamAwardForm.tournamentName || null,
      achievementType: teamAwardForm.achievementType || null,
      position: teamAwardForm.position || null,
      liquipediaUrl: teamAwardForm.liquipediaUrl || null,
      photoKey: teamAwardForm.photoKey || null,
    });
  };

  return (
    <AdminLayout title="Achievements">
      <Tabs defaultValue="player-awards" className="space-y-6">
        <TabsList>
          <TabsTrigger value="player-awards">Player Achievements</TabsTrigger>
          <TabsTrigger value="team-awards">Team Achievements</TabsTrigger>
        </TabsList>

        <TabsContent value="player-awards">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{playerAwards?.length ?? 0} player achievements</p>
            <Button size="sm" onClick={() => setAwardPlayerOpen(true)} className="gap-1.5 bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]">
              <Award className="h-4 w-4" /> Award to Player
            </Button>
          </div>
          {playerAwards?.length === 0 ? (
            <p className="text-sm text-muted-foreground">No player achievements awarded yet.</p>
          ) : (
            <div className="space-y-2">
              {playerAwards?.map((a) => {
                const displayTitle = a.customTitle ?? a.achievementName;
                const meta = a.parsedMetadata as { tournamentName?: string; achievementType?: string; position?: string; liquipediaUrl?: string } | null;
                const metaParts: string[] = [];
                if (meta?.tournamentName) metaParts.push(meta.tournamentName);
                if (meta?.achievementType) metaParts.push(meta.achievementType);
                if (meta?.position) metaParts.push(meta.position);
                return (
                  <div key={a.id} className="glass flex items-center gap-3 rounded-lg p-3">
                    <Trophy className="h-4 w-4 text-[hsl(var(--tsg-blue))]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{displayTitle}</p>
                      <p className="text-xs text-muted-foreground">{a.playerIgn} · {new Date(a.earnedAt).toLocaleDateString()}{metaParts.length > 0 ? ` · ${metaParts.join(" · ")}` : ""}</p>
                      {meta?.liquipediaUrl && (
                        <a href={meta.liquipediaUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[hsl(var(--tsg-blue))] underline truncate block">
                          <ExternalLink className="inline h-3 w-3" /> {meta.liquipediaUrl}
                        </a>
                      )}
                    </div>
                    <ConfirmDialog
                      trigger={<Button variant="outline" size="sm">Remove</Button>}
                      title={`Remove ${displayTitle} from ${a.playerIgn}?`}
                      description="This will remove this player achievement."
                      onConfirm={() => removePlayer.mutate({ id: a.id })}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="team-awards">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{teamAwards?.length ?? 0} team achievements</p>
            <Button size="sm" onClick={() => setAwardTeamOpen(true)} className="gap-1.5 bg-[hsl(var(--tsg-red))] hover:bg-[hsl(var(--tsg-red))/0.85]">
              <Users className="h-4 w-4" /> Award to Team
            </Button>
          </div>
          {teamAwards?.length === 0 ? (
            <p className="text-sm text-muted-foreground">No team achievements awarded yet.</p>
          ) : (
            <div className="space-y-2">
              {teamAwards?.map((a) => {
                const displayTitle = a.customTitle ?? a.achievementName;
                const meta = a.parsedMetadata as { tournamentName?: string; achievementType?: string; position?: string; liquipediaUrl?: string } | null;
                const metaParts: string[] = [];
                if (meta?.tournamentName) metaParts.push(meta.tournamentName);
                if (meta?.achievementType) metaParts.push(meta.achievementType);
                if (meta?.position) metaParts.push(meta.position);
                if (a.placement) metaParts.push(`Placement: ${a.placement}`);
                return (
                  <div key={a.id} className="glass flex items-center gap-3 rounded-lg p-3">
                    <Trophy className="h-4 w-4 text-[hsl(var(--tsg-red))]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{displayTitle}</p>
                      <p className="text-xs text-muted-foreground">{a.teamName} · {new Date(a.earnedAt).toLocaleDateString()}{metaParts.length > 0 ? ` · ${metaParts.join(" · ")}` : ""}</p>
                      {meta?.liquipediaUrl && (
                        <a href={meta.liquipediaUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[hsl(var(--tsg-blue))] underline truncate block">
                          <ExternalLink className="inline h-3 w-3" /> {meta.liquipediaUrl}
                        </a>
                      )}
                    </div>
                    <ConfirmDialog
                      trigger={<Button variant="outline" size="sm">Remove</Button>}
                      title={`Remove ${displayTitle} from ${a.teamName}?`}
                      description="This will remove this team achievement."
                      onConfirm={() => removeTeam.mutate({ id: a.id })}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Player Award Dialog */}
      <Dialog open={awardPlayerOpen} onOpenChange={setAwardPlayerOpen}>
        <DialogContent className="glass-strong max-h-[90vh] overflow-y-auto border-border sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Award to Player</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input value={playerAwardForm.title} onChange={(e) => setPlayerAwardForm({ ...playerAwardForm, title: e.target.value })} placeholder="e.g. Tournament Champion" />
            </div>
            <div>
              <Label>Team *</Label>
              <Select value={String(selectedTeam ?? "")} onValueChange={(v) => { setSelectedTeam(Number(v)); setSelectedPlayer(null); }}>
                <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                <SelectContent>
                  {(teamList ?? []).map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Player *</Label>
              <Select
                value={selectedPlayer ? String(selectedPlayer) : ""}
                onValueChange={(v) => setSelectedPlayer(Number(v))}
                disabled={!selectedTeam}
              >
                <SelectTrigger><SelectValue placeholder={selectedTeam ? "Select player" : "Select a team first"} /></SelectTrigger>
                <SelectContent>
                  {(teamPlayerList ?? []).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.ign}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date</Label>
              <Input type="datetime-local" value={playerAwardForm.earnedAt} onChange={(e) => setPlayerAwardForm({ ...playerAwardForm, earnedAt: e.target.value })} />
            </div>
            <div>
              <Label>Tournament Name (optional)</Label>
              <Input value={playerAwardForm.tournamentName} onChange={(e) => setPlayerAwardForm({ ...playerAwardForm, tournamentName: e.target.value })} placeholder="e.g. TSG Season 3 Finals" />
            </div>
            <div>
              <Label>Achievement Type (optional, free text)</Label>
              <Input value={playerAwardForm.achievementType} onChange={(e) => setPlayerAwardForm({ ...playerAwardForm, achievementType: e.target.value })} placeholder="e.g. Champion, MVP, Top Fragger" />
            </div>
            <div>
              <Label>Position (optional, free text)</Label>
              <Input value={playerAwardForm.position} onChange={(e) => setPlayerAwardForm({ ...playerAwardForm, position: e.target.value })} placeholder="e.g. 1st, 2nd, 3rd, Grand Finalist" />
            </div>
            <div>
              <Label>Liquipedia URL (optional)</Label>
              <Input value={playerAwardForm.liquipediaUrl} onChange={(e) => setPlayerAwardForm({ ...playerAwardForm, liquipediaUrl: e.target.value })} placeholder="https://liquipedia.net/..." />
            </div>
            <div>
              <Label>Photo Key (optional)</Label>
              <Input value={playerAwardForm.photoKey ?? ""} onChange={(e) => setPlayerAwardForm({ ...playerAwardForm, photoKey: e.target.value || null })} placeholder="achievements/photo-key.png" />
            </div>
            <ImageUpload
              label="Award Photo"
              value={playerAwardForm.photoKey}
              previewUrl={playerAwardForm.photoUrl}
              category="achievement-images"
              onUploaded={(key, url) => setPlayerAwardForm({ ...playerAwardForm, photoKey: key, photoUrl: url })}
            />
            <div>
              <Label>Description (optional)</Label>
              <Textarea rows={2} value={playerAwardForm.description} onChange={(e) => setPlayerAwardForm({ ...playerAwardForm, description: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAwardPlayerOpen(false)}>Cancel</Button>
              <Button onClick={handleAwardPlayer} disabled={awardPlayer.isPending} className="bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]">
                {awardPlayer.isPending ? "Awarding..." : "Award"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Team Award Dialog */}
      <Dialog open={awardTeamOpen} onOpenChange={setAwardTeamOpen}>
        <DialogContent className="glass-strong max-h-[90vh] overflow-y-auto border-border sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Award to Team</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input value={teamAwardForm.title} onChange={(e) => setTeamAwardForm({ ...teamAwardForm, title: e.target.value })} placeholder="e.g. Tournament Champion" />
            </div>
            <div>
              <Label>Team *</Label>
              <Select value={String(selectedTeam ?? "")} onValueChange={(v) => setSelectedTeam(Number(v))}>
                <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                <SelectContent>
                  {(teamList ?? []).map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date</Label>
              <Input type="datetime-local" value={teamAwardForm.earnedAt} onChange={(e) => setTeamAwardForm({ ...teamAwardForm, earnedAt: e.target.value })} />
            </div>
            <div>
              <Label>Tournament Name (optional)</Label>
              <Input value={teamAwardForm.tournamentName} onChange={(e) => setTeamAwardForm({ ...teamAwardForm, tournamentName: e.target.value })} placeholder="e.g. TSG Season 3 Finals" />
            </div>
            <div>
              <Label>Achievement Type (optional, free text)</Label>
              <Input value={teamAwardForm.achievementType} onChange={(e) => setTeamAwardForm({ ...teamAwardForm, achievementType: e.target.value })} placeholder="e.g. Champion, Runner Up, MVP" />
            </div>
            <div>
              <Label>Position (optional, free text)</Label>
              <Input value={teamAwardForm.position} onChange={(e) => setTeamAwardForm({ ...teamAwardForm, position: e.target.value })} placeholder="e.g. 1st, 2nd, 3rd, Grand Finalist" />
            </div>
            <div>
              <Label>Liquipedia URL (optional)</Label>
              <Input value={teamAwardForm.liquipediaUrl} onChange={(e) => setTeamAwardForm({ ...teamAwardForm, liquipediaUrl: e.target.value })} placeholder="https://liquipedia.net/..." />
            </div>
            <div>
              <Label>Photo Key (optional)</Label>
              <Input value={teamAwardForm.photoKey ?? ""} onChange={(e) => setTeamAwardForm({ ...teamAwardForm, photoKey: e.target.value || null })} placeholder="achievements/photo-key.png" />
            </div>
            <ImageUpload
              label="Award Photo"
              value={teamAwardForm.photoKey}
              previewUrl={teamAwardForm.photoUrl}
              category="achievement-images"
              onUploaded={(key, url) => setTeamAwardForm({ ...teamAwardForm, photoKey: key, photoUrl: url })}
            />
            <div>
              <Label>Description (optional)</Label>
              <Textarea rows={2} value={teamAwardForm.description} onChange={(e) => setTeamAwardForm({ ...teamAwardForm, description: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAwardTeamOpen(false)}>Cancel</Button>
              <Button onClick={handleAwardTeam} disabled={awardTeam.isPending} className="bg-[hsl(var(--tsg-red))] hover:bg-[hsl(var(--tsg-red))/0.85]">
                {awardTeam.isPending ? "Awarding..." : "Award"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}