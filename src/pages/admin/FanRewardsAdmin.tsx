import { useState } from "react";
import { Plus, Pencil, Trash2, Package } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import type { RouterOutputs } from "@contracts/types";

type Reward = RouterOutputs["admin"]["listFanRewards"][number];

const CATEGORIES = [
  "Merchandise",
  "Digital",
  "Event",
  "Mobile",
  "Laptop",
  "Gaming",
  "Other",
];

const emptyForm = {
  name: "",
  category: "Merchandise",
  description: "",
  photoKey: null as string | null,
  photoUrl: null as string | null,
  xpCost: 0,
  stock: 0,
  isActive: true,
  eligibilityJson: "",
  details: "",
};

export default function FanRewardsAdmin() {
  const utils = trpc.useUtils();
  const { data: rewards, isLoading, error } = trpc.admin.listFanRewards.useQuery();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Reward | null>(null);
  const [form, setForm] = useState(emptyForm);

  const upsert = trpc.admin.upsertFanReward.useMutation({
    onSuccess: () => {
      toast.success(editing ? "Reward updated." : "Reward created.");
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      refresh();
    },
    onError: (e: { message?: string }) => toast.error(e.message ?? "Error"),
  });

  const remove = trpc.admin.deleteFanReward.useMutation({
    onSuccess: () => {
      toast.success("Reward deleted.");
      refresh();
    },
    onError: (e: { message?: string }) => toast.error(e.message ?? "Error"),
  });

  const toggleActive = trpc.admin.upsertFanReward.useMutation({
    onSuccess: () => {
      utils.admin.listFanRewards.invalidate();
    },
    onError: (e: { message?: string }) => toast.error(e.message ?? "Error"),
  });

  function refresh() {
    utils.admin.listFanRewards.invalidate();
  }

  function openEdit(reward?: Reward) {
    if (reward) {
      setEditing(reward);
      setForm({
        name: reward.name,
        category: reward.category,
        description: reward.description ?? "",
        photoKey: reward.photoKey,
        photoUrl: reward.photoUrl,
        xpCost: reward.xpCost,
        stock: reward.stock,
        isActive: reward.isActive,
        eligibilityJson: reward.eligibilityJson ?? "",
        details: reward.details ?? "",
      });
    } else {
      setEditing(null);
      setForm(emptyForm);
    }
    setOpen(true);
  }

  function handleSave() {
    if (!form.name.trim()) {
      toast.error("Name is required.");
      return;
    }
    if (form.xpCost < 0) {
      toast.error("XP cost cannot be negative.");
      return;
    }
    if (form.stock < 0) {
      toast.error("Stock cannot be negative.");
      return;
    }
    upsert.mutate({
      id: editing?.id,
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim() || null,
      photoKey: form.photoKey,
      xpCost: form.xpCost,
      stock: form.stock,
      isActive: form.isActive,
      eligibilityJson: form.eligibilityJson.trim() || null,
      details: form.details.trim() || null,
    });
  }

  if (error) {
    return (
      <AdminLayout title="Fan Rewards" minRole="admin">
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
          <p className="font-medium">Failed to load rewards</p>
          <p className="text-sm">{error.message}</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Fan Rewards" minRole="moderator">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Fan Rewards</h1>
            <p className="text-sm text-muted-foreground">Manage redeemable rewards that fans can purchase with XP.</p>
          </div>
          <Button onClick={() => openEdit()} variant="default">
            <Plus className="h-4 w-4 mr-2" />
            Add Reward
          </Button>
        </div>

        {isLoading ? (
          <p className="text-center text-muted-foreground py-10">Loading...</p>
        ) : !rewards || rewards.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No rewards yet. Create one above to get started.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rewards.map((r) => (
              <div key={r.id} className="group rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold">{r.name}</h3>
                      <span className="text-xs rounded-full bg-muted px-2 py-0.5">{r.category}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{r.description}</p>
                    <div className="mt-2 flex items-center gap-4 text-xs">
                      <span className="font-semibold text-[hsl(var(--tsg-blue))]">{r.xpCost} XP</span>
                      <span className="text-muted-foreground">{r.availableStock} left</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(r)} aria-label="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="sm" aria-label="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      }
                      title="Delete reward?"
                      description="This cannot be undone. The reward will be removed from all listings."
                      confirmLabel="Delete"
                      onConfirm={() => {
                        if (window.confirm(`Type DELETE to confirm deleting "${r.name}".`) || r.name === "") {
                          remove.mutate({ id: r.id });
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Switch
                    checked={r.isActive}
                    onCheckedChange={(checked) =>
                      toggleActive.mutate({
                        id: r.id,
                        name: r.name,
                        category: r.category,
                        description: r.description ?? undefined,
                        photoKey: r.photoKey ?? undefined,
                        xpCost: r.xpCost,
                        stock: r.stock,
                        isActive: checked,
                      })
                    }
                  />
                  <Label className="text-xs">Active</Label>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="glass-strong border-border max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Reward" : "Add Reward"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. TSG Hoodie"
                />
              </div>
              <div>
                <Label htmlFor="category">Category *</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  placeholder="Describe the reward..."
                />
              </div>
              <div>
                <Label htmlFor="details">Details (optional)</Label>
                <Textarea
                  id="details"
                  value={form.details}
                  onChange={(e) => setForm({ ...form, details: e.target.value })}
                  rows={2}
                  placeholder="e.g. Size: L, Color: Navy"
                />
              </div>
              <div>
                <Label>Photo</Label>
                <ImageUpload
                  value={form.photoKey}
                  previewUrl={form.photoUrl}
                  category="other"
                  onUploaded={(key, url) => setForm({ ...form, photoKey: key, photoUrl: url ?? null })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="xpCost">XP Cost *</Label>
                  <Input
                    id="xpCost"
                    type="number"
                    min={0}
                    value={form.xpCost}
                    onChange={(e) => setForm({ ...form, xpCost: Math.max(0, parseInt(e.target.value) || 0) })}
                  />
                </div>
                <div>
                  <Label htmlFor="stock">Stock Quantity *</Label>
                  <Input
                    id="stock"
                    type="number"
                    min={0}
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: Math.max(0, parseInt(e.target.value) || 0) })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="eligibilityJson">Eligibility (optional)</Label>
                <Input
                  id="eligibilityJson"
                  value={form.eligibilityJson}
                  onChange={(e) => setForm({ ...form, eligibilityJson: e.target.value })}
                  placeholder='e.g. {"minXp": 1000, "role": "fan"}'
                />
                <p className="text-xs text-muted-foreground mt-1">JSON string of eligibility requirements.</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="isActive"
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
                />
                <Label htmlFor="isActive">Active / Redeemable</Label>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={upsert.isPending}>
                  {upsert.isPending ? "Saving..." : editing ? "Update" : "Create"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
