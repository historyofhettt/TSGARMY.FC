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
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
const EMPTY_OPTION = { text: "", displayOrder: 0 };
const EMPTY = { tournamentId: 0, question: "", xpReward: 0, timerSeconds: 0, closesAt: "", options: [EMPTY_OPTION, EMPTY_OPTION] };

export default function PredictionsAdmin() {
  const utils = trpc.useUtils();
  const { data: tournamentList } = trpc.admin.listPredictionTournaments.useQuery();
  const { data: list, isLoading } = trpc.admin.listPredictions.useQuery();
  const createMutation = trpc.admin.createPrediction.useMutation({ onSuccess: () => { toast.success("Prediction created."); setOpen(false); refresh(); }, onError: (e) => toast.error(e.message) });
  const updateMutation = trpc.admin.updatePrediction.useMutation({ onSuccess: () => { toast.success("Prediction updated."); setOpen(false); refresh(); }, onError: (e) => toast.error(e.message) });
  const setCorrectMutation = trpc.admin.setPredictionCorrectOption.useMutation({ onSuccess: () => { toast.success("Correct option set."); refresh(); }, onError: (e) => toast.error(e.message) });
  const deleteMutation = trpc.admin.deletePrediction.useMutation({ onSuccess: () => { toast.success("Prediction deleted."); refresh(); }, onError: (e) => toast.error(e.message) });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(EMPTY);
  const [correctOpen, setCorrectOpen] = useState(false);
  const [correctId, setCorrectId] = useState(0);

  const refresh = () => { utils.admin.listPredictions.invalidate(); };
  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY, tournamentId: tournamentList?.[0]?.id ?? 0 });
    setOpen(true);
  };
  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      tournamentId: p.tournamentId ?? 0,
      question: p.question,
      xpReward: p.xpReward,
      timerSeconds: p.timerSeconds ?? 0,
      options: (p.options?.length ? p.options : EMPTY.options).map((o: any) => ({ id: o.id, text: o.text, displayOrder: o.displayOrder ?? 0 })),
    closesAt: p.closesAt ? new Date(p.closesAt).toISOString().slice(0, 16) : "",
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.question.trim() || !form.tournamentId) return toast.error("Question and tournament are required.");
    if (form.options.length < 2) return toast.error("At least 2 options are required.");
    if (form.options.some((o: any) => !o.text.trim())) return toast.error("All options must have text.");
    const payload = { ...form, closesAt: form.closesAt ? new Date(form.closesAt) : new Date(), options: form.options.map((o: any, i: number) => ({ id: o.id || undefined, text: o.text, displayOrder: i })) };
    if (editing) {
      updateMutation.mutate({ id: editing.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };
  const setCorrect = (p: any) => {
    setCorrectId(p.id);
    setCorrectOpen(true);
  };
  const confirmCorrect = (optionId: number) => {
    setCorrectMutation.mutate({ id: correctId, correctOptionId: optionId });
    setCorrectOpen(false);
  };
  const statusBadge = (s: string) => {
    const map: Record<string, string> = { open: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", closed: "bg-amber-500/15 text-amber-400 border-amber-500/30", answered: "bg-blue-500/15 text-blue-400 border-blue-500/30" };
    return <Badge variant="outline" className={map[s] ?? ""}>{s.toUpperCase()}</Badge>;
  };

  return (
    <AdminLayout title="Tournament Predictions">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted-foreground">Manage predictions and auto-reward correct voters.</p>
        <Button onClick={openCreate} className="bg-[hsl(var(--tsg-blue))]"><Plus className="h-4 w-4 mr-1" /> CREATE</Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit" : "Create"} Prediction</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Tournament</Label>
              <Select value={String(form.tournamentId)} onValueChange={(v) => setForm({ ...form, tournamentId: parseInt(v) || 0 })}>
                <SelectTrigger><SelectValue placeholder="Select tournament" /></SelectTrigger>
                <SelectContent>
                  {(tournamentList ?? []).map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}{t.team ? ` - ${t.team.name}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Question</Label>
              <Textarea value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>XP Reward</Label>
                <Input type="number" value={form.xpReward} onChange={(e) => setForm({ ...form, xpReward: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Timer (seconds)</Label>
                <Input type="number" value={form.timerSeconds ?? ""} onChange={(e) => setForm({ ...form, timerSeconds: e.target.value ? parseInt(e.target.value) : 0 })} placeholder="0 = no timer" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Options (min 2)</Label>
              {form.options.map((opt: any, i: number) => (
                <div key={i} className="flex gap-2">
                  <Input value={opt.text} onChange={(e) => { const next = [...form.options]; next[i] = { ...next[i], text: e.target.value }; setForm({ ...form, options: next }); }} placeholder={`Option ${i + 1}`} />
                  {form.options.length > 2 && <Button size="sm" variant="outline" onClick={() => { const next = form.options.filter((_: any, idx: number) => idx !== i); setForm({ ...form, options: next }); }}>X</Button>}
                </div>
              ))}
              {form.options.length < 10 && <Button size="sm" variant="outline" onClick={() => setForm({ ...form, options: [...form.options, { text: "", displayOrder: form.options.length }] })}>+ ADD OPTION</Button>}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={createMutation.isPending || updateMutation.isPending}>Cancel</Button>
            <Button onClick={save} disabled={createMutation.isPending || updateMutation.isPending}>{createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save"}</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={correctOpen} onOpenChange={setCorrectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Select Correct Option</DialogTitle></DialogHeader>
          <div className="py-4">
            <Label className="mb-2 block">Choose the winning option:</Label>
            <div className="space-y-2">
              {(list ?? []).find((p: any) => p.id === correctId)?.options.map((opt: any) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => confirmCorrect(opt.id)}>
                    {opt.text}
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCorrectOpen(false)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>

      {isLoading ? <p className="text-muted-foreground">Loading...</p> : (
        <div className="space-y-3">
          {(list ?? []).map((p) => (
            <div key={p.id} className="glass rounded-xl p-4">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="font-display font-bold text-sm">{p.tournamentName}</span>
                {statusBadge(p.status)}
                <span className="text-xs text-muted-foreground">+{p.xpReward} XP</span>
                {p.timerSeconds && <span className="text-xs text-muted-foreground">{p.timerSeconds}s timer</span>}
                {p.correctOptionId && <span className="text-xs text-emerald-400">Correct set</span>}
              </div>
              <p className="text-sm mb-3">{p.question}</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(p.options ?? []).map((o: any) => (
                  <span key={o.id} className={`text-xs rounded border px-2 py-0.5 ${o.id === p.correctOptionId ? "border-emerald-500 text-emerald-400" : "border-border"}`}>{o.text}{o.id === p.correctOptionId && <CheckCircle2 className="inline h-3 w-3" />}</span>
                ))}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(p)}><Pencil className="h-3 w-3 mr-1" /> Edit</Button>
                <Button size="sm" variant="outline" onClick={() => setCorrect(p)} disabled={p.status === "answered"}><CheckCircle2 className="h-3 w-3 mr-1" /> Set Correct</Button>
                <ConfirmDialog trigger={<Button size="sm" variant="outline" className="text-[hsl(var(--tsg-red))]"><Trash2 className="h-3 w-3 mr-1" /> Delete</Button>} title="Delete this prediction?" onConfirm={() => deleteMutation.mutate({ id: p.id })} />
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
