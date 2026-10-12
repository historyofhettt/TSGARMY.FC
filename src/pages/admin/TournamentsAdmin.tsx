import { useState } from "react";
import { Link } from "react-router";
import { Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { StatusBadge } from "@/components/LiveBadge";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/format";
import type { RouterOutputs } from "@contracts/types";

type Tournament = RouterOutputs["admin"]["listTournaments"][number];

const emptyForm = {
  teamId: 0,
  name: "",
  description: "",
  startDate: "",
  startTime: "",
  status: "upcoming" as "upcoming" | "ongoing" | "completed",
  youtubeLiveUrl: "",
  instagramLiveUrl: "",
  numberOfMatches: 6,
  logoKey: null as string | null,
  logoUrl: null as string | null,
};

export default function TournamentsAdmin() {
  const utils = trpc.useUtils();
  const { data: teamList, isLoading: teamsLoading, isError: teamsError } = trpc.admin.listTeams.useQuery();
  const { data: list, isLoading } = trpc.admin.listTournaments.useQuery();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tournament | null>(null);
  const [form, setForm] = useState(emptyForm);

  const refresh = () => {
    utils.admin.listTournaments.invalidate();
    utils.public.tournaments.invalidate();
    utils.public.live.invalidate();
  };

  const upsert = trpc.admin.upsertTournament.useMutation({
    onSuccess: () => {
      toast.success(editing ? "Tournament updated successfully." : "Tournament created successfully.");
      setOpen(false);
      refresh();
    },
    onError: (e) => toast.error(`Unable to save tournament. ${e.message}`),
  });
  const del = trpc.admin.deleteTournament.useMutation({
    onSuccess: () => {
      toast.success("Tournament deleted.");
      refresh();
    },
    onError: (e) => toast.error(`Unable to delete tournament. ${e.message}`),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, teamId: teamList?.[0]?.id ?? 0 });
    setOpen(true);
  };
  const openEdit = (t: Tournament) => {
    setEditing(t);
    setForm({
      teamId: t.teamId ?? 0,
      name: t.name,
      description: t.description ?? "",
      startDate: t.startDate ? new Date(t.startDate).toISOString().slice(0, 10) : "",
      startTime: t.startTime ?? "",
      status: t.status,
      youtubeLiveUrl: t.youtubeLiveUrl ?? "",
      instagramLiveUrl: t.instagramLiveUrl ?? "",
      numberOfMatches: t.numberOfMatches,
      logoKey: t.logoKey,
      logoUrl: t.logoUrl,
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.name.trim()) return toast.error("Tournament name is required.");
    if (!form.teamId) return toast.error("Please select a team.");
    upsert.mutate({
      id: editing?.id,
      teamId: form.teamId,
      name: form.name.trim(),
      description: form.description || null,
      startDate: form.startDate ? new Date(form.startDate) : null,
      startTime: form.startTime || null,
      status: form.status,
      youtubeLiveUrl: form.youtubeLiveUrl || null,
      instagramLiveUrl: form.instagramLiveUrl || null,
      numberOfMatches: form.numberOfMatches,
      logoKey: form.logoKey,
    });
  };

  return (
    <AdminLayout title="Tournaments">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{list?.length ?? 0} tournaments</p>
        <Button onClick={openCreate} className="gap-2 bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]">
          <Plus className="h-4 w-4" /> New Tournament
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading tournaments...</p>
      ) : (
        <div className="space-y-3">
          {(list ?? []).map((t) => (
            <div key={t.id} className="glass flex flex-wrap items-center gap-4 rounded-xl p-4">
              {t.logoUrl ? (
                <img src={t.logoUrl} alt="" className="h-12 w-12 rounded-lg object-contain" />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-border font-display text-sm font-bold text-muted-foreground">
                  {t.name.slice(0, 2).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-display font-bold">{t.name}</p>
                  <StatusBadge status={t.status} />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t.team?.name} · {formatDate(t.startDate)} {t.startTime ? `· ${t.startTime}` : ""} · {t.numberOfMatches} matches
                </p>
              </div>
              <div className="flex gap-1.5">
                <Link to={`/admin/tournaments/${t.id}`}>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Settings2 className="h-4 w-4" /> Matches
                  </Button>
                </Link>
                <Button variant="outline" size="icon" onClick={() => openEdit(t)} aria-label={`Edit ${t.name}`}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button variant="outline" size="icon" aria-label={`Delete ${t.name}`}>
                      <Trash2 className="h-4 w-4 text-[hsl(var(--tsg-red))]" />
                    </Button>
                  }
                  title={`Delete ${t.name}?`}
                  description="All matches, lineup data and comments for this tournament will be removed."
                  onConfirm={() => del.mutate({ id: t.id })}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong max-h-[90vh] overflow-y-auto border-border sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Tournament" : "New Tournament"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="BGMI Pro Scrims — Week 4" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Team *</Label>
                <Select
                  value={form.teamId ? String(form.teamId) : ""}
                  onValueChange={(v) => setForm({ ...form, teamId: Number(v) })}
                  disabled={teamsLoading || !!teamsError || (teamList ?? []).length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={teamsLoading ? "Loading teams..." : teamsError ? "Failed to load teams" : "Select team"} />
                  </SelectTrigger>
                  <SelectContent>
                    {teamsError ? (
                      <SelectItem value="" disabled>Error loading teams</SelectItem>
                    ) : (teamList ?? []).length === 0 ? (
                      <SelectItem value="" disabled>No teams available</SelectItem>
                    ) : (
                      (teamList ?? []).map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as typeof form.status })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="ongoing">Ongoing (Live)</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div>
                <Label>Time</Label>
                <Input value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} placeholder="7:00 PM IST" />
              </div>
              <div>
                <Label>Matches</Label>
                <Input type="number" inputMode="numeric" min={0} value={form.numberOfMatches} onChange={(e) => setForm({ ...form, numberOfMatches: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>YouTube Live URL</Label>
                <Input value={form.youtubeLiveUrl} onChange={(e) => setForm({ ...form, youtubeLiveUrl: e.target.value })} placeholder="https://youtube.com/..." />
              </div>
              <div>
                <Label>Instagram Live URL</Label>
                <Input value={form.instagramLiveUrl} onChange={(e) => setForm({ ...form, instagramLiveUrl: e.target.value })} placeholder="https://instagram.com/..." />
              </div>
            </div>
            <ImageUpload
              label="Tournament Logo"
              value={form.logoKey}
              previewUrl={form.logoUrl}
              category="tournament-logos"
              onUploaded={(key, url) => setForm({ ...form, logoKey: key, logoUrl: url })}
            />
            <div className="sticky bottom-0 -mx-6 flex justify-end gap-2 border-t border-border bg-[hsl(224_45%_6%)] px-6 py-3">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={upsert.isPending} className="bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]">
                {upsert.isPending ? "Saving tournament..." : "Save Tournament"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
