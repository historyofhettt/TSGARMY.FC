import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { TeamLogo } from "@/components/TeamLogo";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RouterOutputs } from "@contracts/types";

type Team = RouterOutputs["admin"]["listTeams"][number];

const emptyForm = {
  name: "",
  category: "",
  tagline: "",
  description: "",
  accent: "blue" as "blue" | "red",
  logoKey: null as string | null,
  logoUrl: null as string | null,
  instagram: "",
  youtube: "",
  x: "",
  displayOrder: 0,
};

export default function TeamsAdmin() {
  const utils = trpc.useUtils();
  const { data: teamList, isLoading } = trpc.admin.listTeams.useQuery();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);
  const [form, setForm] = useState(emptyForm);

  const refresh = () => {
    utils.admin.listTeams.invalidate();
    utils.public.teams.invalidate();
  };

  const upsert = trpc.admin.upsertTeam.useMutation({
    onSuccess: () => {
      toast.success(editing ? "Team updated successfully." : "Team created successfully.");
      setOpen(false);
      refresh();
    },
    onError: (e) => toast.error(`Unable to save team. ${e.message}`),
  });
  const del = trpc.admin.deleteTeam.useMutation({
    onSuccess: () => {
      toast.success("Team deleted.");
      refresh();
    },
    onError: (e) => toast.error(`Unable to delete team. ${e.message}`),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };
  const openEdit = (t: Team) => {
    setEditing(t);
    setForm({
      name: t.name,
      category: t.category ?? "",
      tagline: t.tagline ?? "",
      description: t.description ?? "",
      accent: t.accent,
      logoKey: t.logoKey,
      logoUrl: t.logoUrl,
      instagram: t.instagram ?? "",
      youtube: t.youtube ?? "",
      x: t.x ?? "",
      displayOrder: t.displayOrder,
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.name.trim()) {
      toast.error("Team name is required.");
      return;
    }
    upsert.mutate({
      id: editing?.id,
      name: form.name.trim(),
      category: form.category || undefined,
      tagline: form.tagline || null,
      description: form.description || null,
      accent: form.accent,
      logoKey: form.logoKey,
      instagram: form.instagram || null,
      youtube: form.youtube || null,
      x: form.x || null,
      displayOrder: form.displayOrder,
    });
  };

  return (
    <AdminLayout title="Teams">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{teamList?.length ?? 0} teams</p>
        <Button onClick={openCreate} className="gap-2 bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]">
          <Plus className="h-4 w-4" /> New Team
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading teams...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(teamList ?? []).map((t) => (
            <div key={t.id} className="glass rounded-xl p-5">
              <div className="flex items-start gap-4">
                <TeamLogo name={t.name} logoUrl={t.logoUrl} accent={t.accent} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="font-display font-bold">{t.name}</p>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{t.category}</p>
                  <p className="mt-1 text-xs text-muted-foreground">/teams/{t.slug}</p>
                </div>
                <div className="flex gap-1.5">
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
                    description="This also deletes its players, tournaments, matches and comments. This cannot be undone."
                    onConfirm={() => del.mutate({ id: t.id })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong max-h-[90vh] overflow-y-auto border-border sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Team" : "New Team"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="t-name">Name *</Label>
              <Input id="t-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="TSG ARMY" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="t-cat">Category</Label>
                <Input id="t-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Male Esports Team" />
              </div>
              <div>
                <Label>Accent</Label>
                <Select value={form.accent} onValueChange={(v) => setForm({ ...form, accent: v as "blue" | "red" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blue">Electric Blue</SelectItem>
                    <SelectItem value="red">Esports Red</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="t-tag">Tagline</Label>
              <Input id="t-tag" value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="t-desc">Description</Label>
              <Textarea id="t-desc" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <ImageUpload
              label="Team Logo"
              value={form.logoKey}
              previewUrl={form.logoUrl}
              category="team-logos"
              onUploaded={(key, url) => setForm({ ...form, logoKey: key, logoUrl: url })}
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
                {upsert.isPending ? "Saving team..." : "Save Team"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
