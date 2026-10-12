import { useState } from "react";
import { Pencil, Plus, Trash2, Instagram, Youtube } from "lucide-react";
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

type Staff = RouterOutputs["admin"]["listStaff"][number];

const emptyForm = {
  teamId: 0,
  name: "",
  role: "",
  bio: "",
  joinedDate: "",
  status: "active" as "active" | "former",
  photoKey: null as string | null,
  photoUrl: null as string | null,
  instagram: "",
  youtube: "",
  displayOrder: 0,
};

export default function StaffAdmin() {
  const utils = trpc.useUtils();
  const [teamFilter, setTeamFilter] = useState<number | "all">("all");
  const { data: teamList } = trpc.admin.listTeams.useQuery();
  const { data: staffList, isLoading } = trpc.admin.listStaff.useQuery(
    teamFilter === "all" ? undefined : { teamId: teamFilter },
  );
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [form, setForm] = useState(emptyForm);

  const refresh = () => {
    utils.admin.listStaff.invalidate();
    utils.public.teams.invalidate();
  };

  const upsert = trpc.admin.upsertStaff.useMutation({
    onSuccess: () => {
      toast.success(editing ? "Staff updated successfully." : "Staff added successfully.");
      setOpen(false);
      refresh();
    },
    onError: (e) => toast.error(`Unable to save staff. ${e.message}`),
  });
  const del = trpc.admin.deleteStaff.useMutation({
    onSuccess: () => {
      toast.success("Staff removed.");
      refresh();
    },
    onError: (e) => toast.error(`Unable to remove staff. ${e.message}`),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, teamId: teamList?.[0]?.id ?? 0 });
    setOpen(true);
  };
  const openEdit = (s: Staff) => {
    setEditing(s);
    setForm({
      teamId: s.teamId ?? 0,
      name: s.name,
      role: s.role,
      bio: s.bio ?? "",
      joinedDate: s.joinedDate ? new Date(s.joinedDate).toISOString().slice(0, 10) : "",
      status: s.status,
      photoKey: s.photoKey,
      photoUrl: s.photoUrl,
      instagram: s.instagram ?? "",
      youtube: s.youtube ?? "",
      displayOrder: s.displayOrder,
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.name.trim()) return toast.error("Name is required.");
    if (!form.teamId) return toast.error("Please select a team.");
    upsert.mutate({
      id: editing?.id,
      teamId: form.teamId,
      name: form.name.trim(),
      role: form.role.trim() || "Other",
      photoKey: form.photoKey,
      bio: form.bio || null,
      joinedDate: form.joinedDate ? new Date(form.joinedDate) : null,
      status: form.status,
      instagram: form.instagram.trim() || null,
      youtube: form.youtube.trim() || null,
      displayOrder: form.displayOrder,
    });
  };

  return (
    <AdminLayout title="Staff">
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
        <Button onClick={openCreate} className="gap-2 bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]">
          <Plus className="h-4 w-4" /> Add Staff
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading staff...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="p-3">Staff</th>
                <th className="p-3">Team</th>
                <th className="p-3">Role</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(staffList ?? []).map((s) => (
                <tr key={s.id} className="border-b border-border/50 last:border-0">
                  <td className="p-3">
                    <span className="flex items-center gap-2.5 font-semibold">
                      <PlayerPhoto ign={s.name} photoUrl={s.photoUrl} className="h-8 w-8 text-[10px]" rounded="rounded-md" />
                      {s.name}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">{s.team?.name}</td>
                  <td className="p-3 text-muted-foreground">{s.role}</td>
                  <td className="p-3">
                    <span className={cn(
                      "rounded-full border px-2 py-0.5 text-xs font-semibold uppercase",
                      s.status === "active" && "border-[hsl(var(--tsg-blue)/0.5)] text-[hsl(var(--tsg-blue))]",
                      s.status === "former" && "border-[hsl(var(--tsg-red)/0.5)] text-[hsl(var(--tsg-red))]",
                    )}>
                      {s.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1.5">
                      <Button variant="outline" size="icon" onClick={() => openEdit(s)} aria-label={`Edit ${s.name}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button variant="outline" size="icon" aria-label={`Delete ${s.name}`}>
                            <Trash2 className="h-4 w-4 text-[hsl(var(--tsg-red))]" />
                          </Button>
                        }
                        title={`Remove ${s.name}?`}
                        description="This will remove this staff member from the team."
                        onConfirm={() => del.mutate({ id: s.id })}
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
            <DialogTitle>{editing ? "Edit Staff" : "Add Staff"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Coach name" />
              </div>
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
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Role *</Label>
                <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="e.g. Coach, Analyst, Manager" />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as typeof form.status })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="former">Former</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
              <Label>Bio</Label>
              <Textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Instagram</Label>
                <div className="relative">
                  <Input value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} placeholder="https://instagram.com/..." />
                  <Instagram className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div>
                <Label>YouTube</Label>
                <div className="relative">
                  <Input value={form.youtube} onChange={(e) => setForm({ ...form, youtube: e.target.value })} placeholder="https://youtube.com/..." />
                  <Youtube className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>
            <ImageUpload
              label="Staff Photo"
              value={form.photoKey}
              previewUrl={form.photoUrl}
              category="player-photos"
              onUploaded={(key, url) => setForm({ ...form, photoKey: key, photoUrl: url })}
            />
            <div className="sticky bottom-0 -mx-6 flex justify-end gap-2 border-t border-border bg-[hsl(224_45%_6%)] px-6 py-3">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={upsert.isPending} className="bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]">
                {upsert.isPending ? "Saving..." : "Save Staff"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
