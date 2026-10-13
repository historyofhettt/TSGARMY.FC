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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { ImageUpload } from "@/components/admin/ImageUpload";

const EMPTY_OPTION = { text: "", isCorrect: false, displayOrder: 0 };
const EMPTY = { question: "", xpReward: 0, cardRewardId: null as number | null, cardRewardName: "" as string, timerSeconds: null as number | null, isActive: true, imageKey: null as string | null, imageUrl: null as string | null, options: [EMPTY_OPTION, EMPTY_OPTION, EMPTY_OPTION, EMPTY_OPTION] };

export default function QuizAdmin() {
  const utils = trpc.useUtils();
  const { data: list, isLoading } = trpc.admin.listQuizQuestions.useQuery();
  const { data: allCards } = trpc.admin.listCards.useQuery();
  const createMutation = trpc.admin.createQuizQuestion.useMutation({ onSuccess: () => { toast.success("Question created."); setOpen(false); refresh(); }, onError: (e) => toast.error(e.message) });
  const updateMutation = trpc.admin.updateQuizQuestion.useMutation({ onSuccess: () => { toast.success("Question updated."); setOpen(false); refresh(); }, onError: (e) => toast.error(e.message) });
  const deleteMutation = trpc.admin.deleteQuizQuestion.useMutation({ onSuccess: () => { toast.success("Question deleted."); refresh(); }, onError: (e) => toast.error(e.message) });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(EMPTY);

  const refresh = () => {
    utils.admin.listQuizQuestions.invalidate();
  };

  const openCreate = () => { setEditing(null); setForm({ ...EMPTY }); setOpen(true); };
  const openEdit = (q: any) => {
    setEditing(q);
    const cardName = q.cardRewardId ? (allCards ?? []).find((c: any) => c.id === q.cardRewardId)?.name ?? "" : "";
    setForm({ question: q.question, xpReward: q.xpReward, cardRewardId: q.cardRewardId ?? null, cardRewardName: cardName, timerSeconds: q.timerSeconds, isActive: q.isActive, imageKey: q.imageKey ?? null, imageUrl: q.imageUrl ?? null, options: q.options?.length ? q.options.map((o: any) => ({ text: o.text, isCorrect: o.isCorrect, displayOrder: o.displayOrder ?? 0 })) : EMPTY.options });
    setOpen(true);
  };

  const save = () => {
    if (!form.question.trim()) return toast.error("Question is required.");
    const correctCount = form.options.filter((o) => o.isCorrect).length;
    if (correctCount !== 1) return toast.error("Exactly one option must be marked as correct.");
    if (editing) {
      updateMutation.mutate({ id: editing.id, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  return (
    <AdminLayout title="TSG Quiz">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted-foreground">Manage quiz questions and auto-reward correct answers.</p>
        <Button onClick={openCreate} className="bg-[hsl(var(--tsg-blue))]"><Plus className="h-4 w-4 mr-1" /> CREATE</Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit" : "Create"} Quiz Question</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
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
                <Label>Timer (seconds, optional)</Label>
                <Input type="number" value={form.timerSeconds ?? ""} onChange={(e) => setForm({ ...form, timerSeconds: e.target.value ? parseInt(e.target.value) : null })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Card Reward (optional)</Label>
              {form.cardRewardId ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold">{form.cardRewardName || `Card #${form.cardRewardId}`}</span>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, cardRewardId: null, cardRewardName: "" })}
                    className="text-xs text-muted-foreground underline hover:text-foreground"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <Select onValueChange={(v) => { const c = (allCards ?? []).find((c: any) => String(c.id) === v); setForm({ ...form, cardRewardId: c?.id ?? null, cardRewardName: c?.name ?? "" }); }}>
                  <SelectTrigger><SelectValue placeholder="Select a card to reward" /></SelectTrigger>
                  <SelectContent>
                    {(allCards ?? []).filter((c: any) => c.isActive).map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name} ({c.category}) — {c.remainingSupply} left</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <ImageUpload
              label="Question Image (optional)"
              value={form.imageKey}
              previewUrl={form.imageUrl}
              category="achievement-images"
              onUploaded={(key, url) => setForm({ ...form, imageKey: key, imageUrl: url })}
            />
            <div className="space-y-2">
              <Label>Options (min 4, exactly 1 correct)</Label>
              {form.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input value={opt.text} onChange={(e) => { const next = [...form.options]; next[i] = { ...next[i], text: e.target.value }; setForm({ ...form, options: next }); }} placeholder={`Option ${i + 1}`} />
                  <label className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                    <input type="radio" name="correct" checked={opt.isCorrect} onChange={() => { const next = form.options.map((o, idx) => ({ ...o, isCorrect: idx === i })); setForm({ ...form, options: next }); }} />
                    Correct
                  </label>
                  {form.options.length > 4 && <Button size="sm" variant="outline" onClick={() => { const next = form.options.filter((_: any, idx: number) => idx !== i); setForm({ ...form, options: next }); }}>X</Button>}
                </div>
              ))}
              {form.options.length < 10 && <Button size="sm" variant="outline" onClick={() => setForm({ ...form, options: [...form.options, { text: "", isCorrect: false, displayOrder: form.options.length }] })}>+ ADD OPTION</Button>}
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
          {(list ?? []).map((q) => (
            <div key={q.id} className="glass rounded-xl p-4">
                   <div className="flex items-center gap-2 mb-2">
                     <span className="font-display font-bold text-sm">{q.question}</span>
                     {q.xpReward > 0 && <Badge variant="outline">+{q.xpReward} XP</Badge>}
                     {q.cardRewardId && <Badge variant="outline" className="border-purple-500/50 text-purple-400">Card Reward</Badge>}
                     <Badge variant={q.isActive ? "default" : "secondary"}>{q.isActive ? "ACTIVE" : "INACTIVE"}</Badge>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {q.options.map((o) => (
                  <span key={o.id} className={`text-xs rounded border px-2 py-0.5 ${o.isCorrect ? "border-emerald-500 text-emerald-400" : "border-border"}`}>{o.text} {o.isCorrect && <CheckCircle2 className="inline h-3 w-3" />}</span>
                ))}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(q)}><Pencil className="h-3 w-3 mr-1" /> Edit</Button>
                <ConfirmDialog trigger={<Button size="sm" variant="outline" className="text-[hsl(var(--tsg-red))]"><Trash2 className="h-3 w-3 mr-1" /> Delete</Button>} title="Delete this question?" onConfirm={() => deleteMutation.mutate({ id: q.id })} />
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
