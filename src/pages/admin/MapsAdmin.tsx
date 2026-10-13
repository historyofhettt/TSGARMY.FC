import { useState } from "react";
import { ArrowDown, ArrowUp, Map, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { RouterOutputs } from "@contracts/types";

type GameMap = RouterOutputs["admin"]["listMaps"][number];

const emptyForm = {
  name: "",
  imageKey: null as string | null,
  imageUrl: null as string | null,
  isActive: true,
};

export default function MapsAdmin() {
  const utils = trpc.useUtils();
  const { data: mapList, isLoading } = trpc.admin.listMaps.useQuery();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GameMap | null>(null);
  const [form, setForm] = useState(emptyForm);

  const refresh = () => {
    utils.admin.listMaps.invalidate();
    utils.public.listMaps.invalidate();
  };

  const upsert = trpc.admin.upsertMap.useMutation({
    onSuccess: () => {
      toast.success(editing ? "Map updated successfully." : "Map created successfully.");
      setOpen(false);
      refresh();
    },
    onError: (e) => toast.error(`Unable to save map. ${e.message}`),
  });

  const toggle = trpc.admin.toggleMapActive.useMutation({
    onSuccess: () => refresh(),
    onError: (e) => toast.error(e.message),
  });

  const remove = trpc.admin.deleteMap.useMutation({
    onSuccess: () => {
      toast.success("Map deleted.");
      refresh();
    },
    onError: (e) => toast.error(`Unable to delete map. ${e.message}`),
  });

  const reorder = trpc.admin.reorderMaps.useMutation({
    onSuccess: () => refresh(),
    onError: (e) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (m: GameMap) => {
    setEditing(m);
    setForm({
      name: m.name,
      imageKey: m.imageKey,
      imageUrl: m.imageUrl,
      isActive: m.isActive,
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.name.trim()) {
      toast.error("Map name is required.");
      return;
    }
    upsert.mutate({
      id: editing?.id,
      name: form.name.trim(),
      imageKey: form.imageKey,
      isActive: form.isActive,
      displayOrder: editing ? editing.displayOrder : (mapList?.length ?? 0) + 1,
    });
  };

  const move = (index: number, dir: -1 | 1) => {
    if (!mapList) return;
    const next = [...mapList];
    const [item] = next.splice(index, 1);
    next.splice(index + dir, 0, item);
    reorder.mutate({ items: next.map((m, i) => ({ id: m.id, displayOrder: i + 1 })) });
  };

  return (
    <AdminLayout title="Global Map Library">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{mapList?.length ?? 0} maps</p>
        <Button onClick={openCreate} className="gap-2 bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]">
          <Plus className="h-4 w-4" /> Add Map
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12" />
                <TableHead>Map</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mapList?.map((m, i) => (
                <TableRow key={m.id} className={m.isActive ? "" : "opacity-50"}>
                  <TableCell>
                    <div className="flex flex-col">
                      <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => move(i, -1)}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" disabled={i === mapList.length - 1} onClick={() => move(i, 1)}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {m.imageUrl ? (
                        <img src={m.imageUrl} alt={m.name} className="h-12 w-20 rounded object-cover" />
                      ) : (
                        <span className="flex h-12 w-20 items-center justify-center rounded border border-border bg-background/40">
                          <Map className="h-5 w-5 text-muted-foreground" />
                        </span>
                      )}
                      <span className="font-medium">{m.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={m.isActive}
                        onCheckedChange={(v) => toggle.mutate({ id: m.id, isActive: v })}
                      />
                      <Badge variant={m.isActive ? "default" : "secondary"}>
                        {m.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-[hsl(var(--tsg-red))]" />
                        </Button>
                      }
                      title={`Delete ${m.name}?`}
                      description="Maps used by matches cannot be deleted. This cannot be undone."
                      onConfirm={() => remove.mutate({ id: m.id })}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && !mapList?.length && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No maps yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong max-h-[90vh] overflow-y-auto border-border sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Map" : "Add Map"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="m-name">Map Name *</Label>
              <Input
                id="m-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Bermuda"
                maxLength={128}
              />
            </div>
            <ImageUpload
              label="Map Image (uploaded once, reused by all matches)"
              value={form.imageKey}
              previewUrl={form.imageUrl}
              category="other"
              onUploaded={(key, url) => setForm({ ...form, imageKey: key, imageUrl: url })}
            />
            <div className="flex items-center gap-2">
              <Switch
                id="m-active"
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
              />
              <Label htmlFor="m-active">Active (selectable for new matches)</Label>
            </div>
            <div className="sticky bottom-0 -mx-6 flex justify-end gap-2 border-t border-border bg-[hsl(224_45%_6%)] px-6 py-3">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={save}
                disabled={upsert.isPending}
                className="bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]"
              >
                {upsert.isPending ? "Saving map..." : "Save Map"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
