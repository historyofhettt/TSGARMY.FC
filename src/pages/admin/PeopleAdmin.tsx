import { useState } from "react";
import { Crown, Pencil, Plus, Trash2 } from "lucide-react";
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
import type { RouterOutputs } from "@contracts/types";

type Person = RouterOutputs["admin"]["listPeople"][number];

const emptyForm = {
  kind: "owner" as "owner" | "legend",
  name: "",
  position: "",
  description: "",
  photoKey: null as string | null,
  photoUrl: null as string | null,
  instagram: "",
  youtube: "",
  x: "",
  displayOrder: 0,
};

export default function PeopleAdmin() {
  const utils = trpc.useUtils();
  const { data: list, isLoading } = trpc.admin.listPeople.useQuery();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [form, setForm] = useState(emptyForm);

  const refresh = () => {
    utils.admin.listPeople.invalidate();
    utils.public.people.invalidate();
  };

  const upsert = trpc.admin.upsertPerson.useMutation({
    onSuccess: () => {
      toast.success(editing ? "Person updated." : "Person added.");
      setOpen(false);
      refresh();
    },
    onError: (e) => toast.error(`Unable to save. ${e.message}`),
  });
  const del = trpc.admin.deletePerson.useMutation({
    onSuccess: () => {
      toast.success("Deleted.");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const openCreate = (kind: "owner" | "legend") => {
    setEditing(null);
    setForm({ ...emptyForm, kind });
    setOpen(true);
  };
  const openEdit = (p: Person) => {
    setEditing(p);
    setForm({
      kind: p.kind,
      name: p.name,
      position: p.position ?? "",
      description: p.description ?? "",
      photoKey: p.photoKey,
      photoUrl: p.photoUrl,
      instagram: p.instagram ?? "",
      youtube: p.youtube ?? "",
      x: p.x ?? "",
      displayOrder: p.displayOrder,
    });
    setOpen(true);
  };

  const owners = (list ?? []).filter((p) => p.kind === "owner");
  const legends = (list ?? []).filter((p) => p.kind === "legend");

  const PersonCard = ({ p }: { p: Person }) => (
    <div className="glass rounded-xl p-5">
      <div className="flex items-start gap-4">
        <PlayerPhoto ign={p.name} photoUrl={p.photoUrl} className="h-16 w-16 text-lg" rounded="rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold">{p.name}</p>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{p.position ?? (p.kind === "legend" ? "Legend" : "Owner")}</p>
          {p.description && <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>}
        </div>
        <div className="flex gap-1.5">
          <Button variant="outline" size="icon" onClick={() => openEdit(p)} aria-label={`Edit ${p.name}`}>
            <Pencil className="h-4 w-4" />
          </Button>
          <ConfirmDialog
            trigger={
              <Button variant="outline" size="icon" aria-label={`Delete ${p.name}`}>
                <Trash2 className="h-4 w-4 text-[hsl(var(--tsg-red))]" />
              </Button>
            }
            title={`Delete ${p.name}?`}
            onConfirm={() => del.mutate({ id: p.id })}
          />
        </div>
      </div>
    </div>
  );

  return (
    <AdminLayout title="Owners & TSG Legend">
      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-10">
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-sm font-bold tracking-widest">OWNERS</h2>
              <Button size="sm" onClick={() => openCreate("owner")} className="gap-1.5 bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]">
                <Plus className="h-4 w-4" /> Add Owner
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {owners.map((p) => <PersonCard key={p.id} p={p} />)}
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-sm font-bold tracking-widest">
                <Crown className="h-4 w-4 text-[hsl(var(--tsg-blue))]" /> TSG LEGEND
              </h2>
              {legends.length === 0 && (
                <Button size="sm" onClick={() => openCreate("legend")} className="gap-1.5 bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]">
                  <Plus className="h-4 w-4" /> Add Legend
                </Button>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {legends.map((p) => <PersonCard key={p.id} p={p} />)}
            </div>
          </section>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong max-h-[90vh] overflow-y-auto border-border sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit" : "Add"} {form.kind === "legend" ? "TSG Legend" : "Owner"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Position</Label>
                <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="Owner / Founder..." />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <ImageUpload
              label="Photo"
              value={form.photoKey}
              previewUrl={form.photoUrl}
              category="owner-photos"
              onUploaded={(key, url) => setForm({ ...form, photoKey: key, photoUrl: url })}
            />
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Instagram</Label>
                <Input value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} />
              </div>
              <div>
                <Label>YouTube</Label>
                <Input value={form.youtube} onChange={(e) => setForm({ ...form, youtube: e.target.value })} />
              </div>
              <div>
                <Label>X</Label>
                <Input value={form.x} onChange={(e) => setForm({ ...form, x: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Display Order</Label>
              <Input type="number" inputMode="numeric" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })} />
            </div>
            <div className="sticky bottom-0 -mx-6 flex justify-end gap-2 border-t border-border bg-[hsl(224_45%_6%)] px-6 py-3">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                disabled={upsert.isPending}
                className="bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]"
                onClick={() => {
                  if (!form.name.trim()) return toast.error("Name is required.");
                  upsert.mutate({
                    id: editing?.id,
                    kind: form.kind,
                    name: form.name.trim(),
                    position: form.position || null,
                    description: form.description || null,
                    photoKey: form.photoKey,
                    instagram: form.instagram || null,
                    youtube: form.youtube || null,
                    x: form.x || null,
                    displayOrder: form.displayOrder,
                  });
                }}
              >
                {upsert.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
