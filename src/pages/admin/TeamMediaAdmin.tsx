import { useState, useRef } from "react";
import { Pencil, Plus, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
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

type TeamMedia = RouterOutputs["admin"]["listTeamMedia"][number];

const emptyForm = {
  teamId: 0,
  name: "",
  description: "",
  date: "",
  photos: [] as string[],
  link: "",
  isActive: "active" as "active" | "hidden",
  displayOrder: 0,
};

export default function TeamMediaAdmin() {
  const utils = trpc.useUtils();
  const [teamFilter, setTeamFilter] = useState<number | "all">("all");
  const { data: teamList } = trpc.admin.listTeams.useQuery();
  const { data: mediaList, isLoading } = trpc.admin.listTeamMedia.useQuery(
    teamFilter === "all" ? undefined : { teamId: teamFilter },
  );
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMedia | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const uploadMutation = trpc.storage.upload.useMutation();
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    utils.admin.listTeamMedia.invalidate();
    utils.public.teams.invalidate();
  };

  const upsert = trpc.admin.upsertTeamMedia.useMutation({
    onSuccess: () => {
      toast.success(editing ? "Media updated successfully." : "Media added successfully.");
      setOpen(false);
      refresh();
    },
    onError: (e) => toast.error(`Unable to save media. ${e.message}`),
  });
  const del = trpc.admin.deleteTeamMedia.useMutation({
    onSuccess: () => {
      toast.success("Media removed.");
      refresh();
    },
    onError: (e) => toast.error(`Unable to remove media. ${e.message}`),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, teamId: teamList?.[0]?.id ?? 0 });
    setOpen(true);
  };
  const openEdit = (m: TeamMedia) => {
    setEditing(m);
    setForm({
      teamId: m.teamId ?? 0,
      name: m.name,
      description: m.description ?? "",
      date: m.date ? new Date(m.date).toISOString().slice(0, 10) : "",
      photos: m.photos ? JSON.parse(m.photos) : [],
      link: m.link ?? "",
      isActive: m.isActive,
      displayOrder: m.displayOrder,
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
      description: form.description || null,
      date: form.date ? new Date(form.date) : null,
      photos: form.photos.length > 0 ? JSON.stringify(form.photos) : null,
      link: form.link || null,
      isActive: form.isActive,
      displayOrder: form.displayOrder,
    });
  };

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const buffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), ""),
        );
        const res = await uploadMutation.mutateAsync({
          name: file.name,
          contentBase64: base64,
          contentType: file.type || "image/png",
          category: "team-media",
        });
        setForm((f) => ({ ...f, photos: [...f.photos, res.key] }));
      }
      toast.success("Photos uploaded.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <AdminLayout title="Team Media">
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
          <Plus className="h-4 w-4" /> Add Collection
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading media...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="p-3">Collection</th>
                <th className="p-3">Team</th>
                <th className="p-3">Photos</th>
                <th className="p-3">Link</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(mediaList ?? []).map((m) => (
                <tr key={m.id} className="border-b border-border/50 last:border-0">
                  <td className="p-3">
                    <span className="font-semibold">{m.name}</span>
                    {m.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{m.description}</p>
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground">{m.team?.name}</td>
                  <td className="p-3 text-muted-foreground">
                    {m.photos ? JSON.parse(m.photos).length : 0}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {m.link ? (
                      <a href={m.link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[hsl(var(--tsg-blue))] hover:underline">
                        <ExternalLink className="h-3 w-3" /> Link
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-3">
                    <span className={cn(
                      "rounded-full border px-2 py-0.5 text-xs font-semibold uppercase",
                      m.isActive === "active" && "border-[hsl(var(--tsg-blue)/0.5)] text-[hsl(var(--tsg-blue))]",
                      m.isActive === "hidden" && "border-[hsl(var(--tsg-red)/0.5)] text-[hsl(var(--tsg-red))]",
                    )}>
                      {m.isActive}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1.5">
                      <Button variant="outline" size="icon" onClick={() => openEdit(m)} aria-label={`Edit ${m.name}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button variant="outline" size="icon" aria-label={`Delete ${m.name}`}>
                            <Trash2 className="h-4 w-4 text-[hsl(var(--tsg-red))]" />
                          </Button>
                        }
                        title={`Delete ${m.name}?`}
                        description="This will permanently delete this media collection."
                        onConfirm={() => del.mutate({ id: m.id })}
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
            <DialogTitle>{editing ? "Edit Collection" : "Add Collection"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="FFMIC LAN Photos" />
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
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.isActive} onValueChange={(v) => setForm({ ...form, isActive: v as typeof form.isActive })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="hidden">Hidden</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label>External Link (Google Drive, etc.)</Label>
              <Input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://drive.google.com/..." />
            </div>
            <div>
              <Label>Photos</Label>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml"
                multiple
                className="hidden"
                onChange={handleFiles}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="gap-2"
              >
                {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                {uploading ? "Uploading..." : form.photos.length > 0 ? "Add More Photos" : "Choose Photos"}
              </Button>
              <p className="mt-1 text-xs text-muted-foreground">PNG, JPG, WebP up to 8 MB each</p>
            </div>
            {form.photos.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {form.photos.map((k, i) => (
                  <div key={i} className="relative">
                    <PlayerPhoto ign={form.name} photoUrl={`/uploads/${k}`} className="h-20 w-full" rounded="rounded-md" />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, photos: form.photos.filter((_, idx) => idx !== i) })}
                      className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-xs text-muted-foreground hover:text-[hsl(var(--tsg-red))]"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="sticky bottom-0 -mx-6 flex justify-end gap-2 border-t border-border bg-[hsl(224_45%_6%)] px-6 py-3">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={upsert.isPending} className="bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]">
                {upsert.isPending ? "Saving..." : "Save Collection"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
