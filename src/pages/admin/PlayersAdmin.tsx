import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { RouterOutputs } from "@contracts/types";

type Player = RouterOutputs["admin"]["listPlayers"][number];

const emptyForm = {
  teamId: 0,
  ign: "",
  realName: "",
  role: "",
  bio: "",
  status: "active" as "active" | "substitute" | "former",
  photoKey: null as string | null,
  photoUrl: null as string | null,
  instagram: "",
  youtube: "",
  x: "",
  joinedDate: "",
  displayOrder: 0,
};

export default function PlayersAdmin() {
  const utils = trpc.useUtils();
  const [teamFilter, setTeamFilter] = useState<number | "all">("all");
  const [showFormer, setShowFormer] = useState(false);
  const { data: teamList } = trpc.admin.listTeams.useQuery();
  const { data: playersList, isLoading } = trpc.admin.listPlayers.useQuery(
    teamFilter === "all" ? { showFormer } : { teamId: teamFilter, showFormer },
  );
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Player | null>(null);
  const [form, setForm] = useState(emptyForm);

  const refresh = () => {
    utils.admin.listPlayers.invalidate();
    utils.public.players.invalidate();
  };

  const upsert = trpc.admin.upsertPlayer.useMutation({
    onSuccess: () => {
      toast.success(editing ? "Player updated successfully." : "Player added successfully.");
      setOpen(false);
      refresh();
    },
    onError: (e) => toast.error(`Unable to save player. ${e.message}`),
  });
  const del = trpc.admin.deletePlayer.useMutation({
    onSuccess: () => {
      toast.success("Player deleted.");
      refresh();
    },
    onError: (e) => toast.error(`Unable to delete player. ${e.message}`),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, teamId: teamList?.[0]?.id ?? 0 });
    setOpen(true);
  };
  const openEdit = (p: Player) => {
    setEditing(p);
    setForm({
      teamId: p.teamId ?? 0,
      ign: p.ign,
      realName: p.realName ?? "",
      role: p.role ?? "",
      bio: p.bio ?? "",
      status: p.status,
      photoKey: p.photoKey,
      photoUrl: p.photoUrl,
      instagram: p.instagram ?? "",
      youtube: p.youtube ?? "",
      x: p.x ?? "",
      joinedDate: p.joinedDate ? new Date(p.joinedDate).toISOString().slice(0, 10) : "",
      displayOrder: p.displayOrder,
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.ign.trim()) return toast.error("In-game name (IGN) is required.");
    if (!form.teamId) return toast.error("Please select a team.");
    upsert.mutate({
      id: editing?.id,
      teamId: form.teamId,
      ign: form.ign.trim(),
      realName: form.realName || null,
      role: form.role || null,
      bio: form.bio || null,
      status: form.status,
      photoKey: form.photoKey,
      instagram: form.instagram || null,
      youtube: form.youtube || null,
      x: form.x || null,
      joinedDate: form.joinedDate ? new Date(form.joinedDate) : null,
      displayOrder: form.displayOrder,
    });
  };

  return (
    <AdminLayout title="Players">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTeamFilter("all")}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm font-semibold transition",
              teamFilter === "all"
                ? "border-[hsl(var(--tsg-blue)/0.6)] bg-[hsl(var(--tsg-blue)/0.12)] text-[hsl(var(--tsg-blue))]"
                : "border-border text-muted-foreground",
            )}
          >
            All
          </button>
          {(teamList ?? []).map((t) => (
            <button
              key={t.id}
              onClick={() => setTeamFilter(t.id)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm font-semibold transition",
                teamFilter === t.id
                  ? "border-[hsl(var(--tsg-blue)/0.6)] bg-[hsl(var(--tsg-blue)/0.12)] text-[hsl(var(--tsg-blue))]"
                  : "border-border text-muted-foreground",
              )}
            >
              {t.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showFormer}
              onChange={(e) => setShowFormer(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span className="text-muted-foreground">Show former players</span>
          </label>
          <Button onClick={openCreate} className="gap-2 bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]">
            <Plus className="h-4 w-4" /> Add Player
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading players...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="p-3">Player</th>
                <th className="p-3">Real Name</th>
                <th className="p-3">Team</th>
                <th className="p-3">Role</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(playersList ?? []).map((p) => (
                <tr key={p.id} className="border-b border-border/50 last:border-0">
                  <td className="p-3">
                    <span className="flex items-center gap-2.5 font-semibold">
                      <PlayerPhoto ign={p.ign} photoUrl={p.photoUrl} className="h-8 w-8 text-[10px]" rounded="rounded-md" />
                      {p.ign}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">{p.realName ?? "—"}</td>
                  <td className="p-3">{p.team?.name}</td>
                  <td className="p-3 text-muted-foreground">{p.role ?? "—"}</td>
                  <td className="p-3">
                    <span className={cn(
                      "rounded-full border px-2 py-0.5 text-xs font-semibold uppercase",
                      p.status === "active" && "border-[hsl(var(--tsg-blue)/0.5)] text-[hsl(var(--tsg-blue))]",
                      p.status === "substitute" && "border-border text-muted-foreground",
                      p.status === "former" && "border-[hsl(var(--tsg-red)/0.5)] text-[hsl(var(--tsg-red))]",
                    )}>
                      {p.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1.5">
                      <Button variant="outline" size="icon" onClick={() => openEdit(p)} aria-label={`Edit ${p.ign}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button variant="outline" size="icon" aria-label={`Delete ${p.ign}`}>
                            <Trash2 className="h-4 w-4 text-[hsl(var(--tsg-red))]" />
                          </Button>
                        }
                        title={`Delete ${p.ign}?`}
                        description="This soft-deletes the player (status set to 'former'). Match history and records are preserved."
                        onConfirm={() => del.mutate({ id: p.id })}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong max-h-[90vh] overflow-y-auto border-border sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Player" : "Add Player"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>IGN *</Label>
                <Input value={form.ign} onChange={(e) => setForm({ ...form, ign: e.target.value })} placeholder="TSG·Vortex" />
              </div>
              <div>
                <Label>Real Name</Label>
                <Input value={form.realName} onChange={(e) => setForm({ ...form, realName: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Team *</Label>
                <Select value={String(form.teamId)} onValueChange={(v) => setForm({ ...form, teamId: Number(v) })}>
                  <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                  <SelectContent>
                    {(teamList ?? []).map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Role</Label>
                <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="IGL / Assaulter..." />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as typeof form.status })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="substitute">Substitute</SelectItem>
                    <SelectItem value="former">Former</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Joined</Label>
                <Input type="date" value={form.joinedDate} onChange={(e) => setForm({ ...form, joinedDate: e.target.value })} />
              </div>
              <div>
                <Label>Order</Label>
                <Input type="number" inputMode="numeric" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label>Biography</Label>
              <Textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
            </div>
            <ImageUpload
              label="Player Photo"
              value={form.photoKey}
              previewUrl={form.photoUrl}
              category="player-photos"
              onUploaded={(key, url) => setForm({ ...form, photoKey: key, photoUrl: url })}
            />
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Instagram</Label>
                <Input value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} placeholder="https://..." />
              </div>
              <div>
                <Label>YouTube</Label>
                <Input value={form.youtube} onChange={(e) => setForm({ ...form, youtube: e.target.value })} placeholder="https://..." />
              </div>
              <div>
                <Label>X</Label>
                <Input value={form.x} onChange={(e) => setForm({ ...form, x: e.target.value })} placeholder="https://..." />
              </div>
            </div>
            <div className="sticky bottom-0 -mx-6 flex justify-end gap-2 border-t border-border bg-[hsl(224_45%_6%)] px-6 py-3">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={upsert.isPending} className="bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]">
                {upsert.isPending ? "Saving player..." : "Save Player"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
