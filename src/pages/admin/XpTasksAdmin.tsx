import { useState } from "react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";

const EMPTY = { title: "", description: "", actionUrl: "", xpReward: 0, isActive: true, displayOrder: 0, deadlineAt: null as string | null };

export default function XpTasksAdmin() {
  const utils = trpc.useUtils();
  const { data: list, isLoading } = trpc.admin.listXpTasks.useQuery();
  const createMutation = trpc.admin.createXpTask.useMutation({ onSuccess: () => { toast.success("Task created."); setOpen(false); refresh(); }, onError: (e) => toast.error(e.message) });
  const updateMutation = trpc.admin.updateXpTask.useMutation({ onSuccess: () => { toast.success("Task updated."); setOpen(false); refresh(); }, onError: (e) => toast.error(e.message) });
  const deleteMutation = trpc.admin.deleteXpTask.useMutation({ onSuccess: () => { toast.success("Task deleted."); refresh(); }, onError: (e) => toast.error(e.message) });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(EMPTY);

  const refresh = () => {
    utils.admin.listXpTasks.invalidate();
    utils.public.listXpTasks.invalidate();
  };

  const openCreate = () => { setEditing(null); setForm({ ...EMPTY }); setOpen(true); };
  const openEdit = (t: any) => { setEditing(t); setForm({ title: t.title, description: t.description ?? "", actionUrl: t.actionUrl ?? "", xpReward: t.xpReward, isActive: t.isActive, displayOrder: t.displayOrder, deadlineAt: t.deadlineAt ? new Date(t.deadlineAt).toISOString().slice(0,16) : null }); setOpen(true); };

  const save = () => {
    if (!form.title.trim()) return toast.error("Title is required.");
    if (editing) {
      updateMutation.mutate({ id: editing.id, ...form, deadlineAt: form.deadlineAt ? new Date(form.deadlineAt) : null });
    } else {
      createMutation.mutate({ ...form, deadlineAt: form.deadlineAt ? new Date(form.deadlineAt) : null });
    }
  };

  return (
    <AdminLayout title="XP Tasks">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted-foreground">Manage one-time XP tasks for fans.</p>
        <Button onClick={openCreate} className="bg-[hsl(var(--tsg-blue))]"><Plus className="h-4 w-4 mr-1" /> CREATE</Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit" : "Create"} XP Task</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Action URL</Label>
              <Input value={form.actionUrl} onChange={(e) => setForm({ ...form, actionUrl: e.target.value })} placeholder="https://..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>XP Reward</Label>
                <Input type="number" value={form.xpReward} onChange={(e) => setForm({ ...form, xpReward: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Display Order</Label>
                <Input type="number" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Deadline (optional)</Label>
              <Input type="datetime-local" value={form.deadlineAt ?? ""} onChange={(e) => setForm({ ...form, deadlineAt: e.target.value || null })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              <Label>Active</Label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={createMutation.isPending || updateMutation.isPending}>Cancel</Button>
            <Button onClick={save} disabled={createMutation.isPending || updateMutation.isPending}>{createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {isLoading ? <p className="text-muted-foreground">Loading...</p> : (
        <div className="space-y-3">
          {(list ?? []).map((t) => (
            <div key={t.id} className="glass rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-display font-bold text-sm">{t.title}</span>
                <Badge variant="outline">+{t.xpReward} XP</Badge>
                <Badge variant={t.isActive ? "default" : "secondary"}>{t.isActive ? "ACTIVE" : "INACTIVE"}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{t.description}</p>
              {t.actionUrl && <a href={t.actionUrl} target="_blank" rel="noreferrer" className="text-xs text-[hsl(var(--tsg-blue))] hover:underline">{t.actionUrl}</a>}
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" onClick={() => openEdit(t)}><Pencil className="h-3 w-3 mr-1" /> Edit</Button>
                <ConfirmDialog trigger={<Button size="sm" variant="outline" className="text-[hsl(var(--tsg-red))]"><Trash2 className="h-3 w-3 mr-1" /> Delete</Button>} title="Delete this task?" description="All completions will also be removed." onConfirm={() => deleteMutation.mutate({ id: t.id })} />
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
