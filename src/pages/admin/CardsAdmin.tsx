import { useState } from "react";
import { Gem, Plus, Pencil, Trash2, Trophy } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CATEGORY_COLORS, CATEGORY_LABELS, type CardCategory } from "@/components/CardDisplay";
import type { RouterOutputs } from "@contracts/types";

type Card = RouterOutputs["admin"]["listCards"][number];
type Achievement = RouterOutputs["admin"]["listAchievements"][number];
type UnlockMethod = "daily_streak" | "xp_milestone" | "achievement" | "event" | "manual" | "exclusive";

const CATEGORY_LABELS_ADMIN: Record<CardCategory, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  event: "Event",
  exclusive: "Exclusive",
};

const emptyForm = {
  name: "",
  slug: "",
  description: "",
  imageKey: null as string | null,
  imageUrl: null as string | null,
  category: "common" as CardCategory,
  totalSupply: 10,
  claimedSupply: 0,
  unlockMethod: "manual" as UnlockMethod,
  unlockRequirement: "",
  isActive: true,
};

export default function CardsAdmin() {
  const utils = trpc.useUtils();
  const { data: cardsList, isLoading } = trpc.admin.listCards.useQuery();
  const { data: userList } = trpc.admin.listUsers.useQuery();
  const { data: allCards } = trpc.admin.listCards.useQuery();
   const { data: achievements } = trpc.admin.listAchievements.useQuery();
   const { data: cardRewards } = trpc.admin.listAchievementCardRewards.useQuery();
   const { data: cardList } = trpc.admin.listCards.useQuery();

   const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Card | null>(null);
  const [form, setForm] = useState(emptyForm);

  const [streakOpen, setStreakOpen] = useState(false);
  const [streakEditing, setStreakEditing] = useState<{ id?: number; streakDays: number; cardId: string; isActive: boolean } | null>(null);

  const [xpOpen, setXpOpen] = useState(false);
  const [xpEditing, setXpEditing] = useState<{ id?: number; xpThreshold: number; cardId: string; isActive: boolean } | null>(null);

  const [achOpen, setAchOpen] = useState(false);
  const [achForm, setAchForm] = useState({ achievementId: "", cardId: "" });

  const [userAchOpen, setUserAchOpen] = useState(false);
  const [userAchEditing, setUserAchEditing] = useState<Achievement | null>(null);
  const [userAchForm, setUserAchForm] = useState({
    name: "",
    description: "",
    iconKey: null as string | null,
    iconUrl: null as string | null,
    badge: "",
    tag: "",
    category: "",
    requirementType: "manual",
    requirementValue: null as number | null,
    xpReward: 0,
    isActive: true,
    linkedCardId: null as number | null,
  });

  const [grantOpen, setGrantOpen] = useState(false);
  const [grantForm, setGrantForm] = useState({ userId: "", cardId: "", quantity: 1, note: "" });

  const [revokeUserId, setRevokeUserId] = useState<string>("");
  const [revokeCardId, setRevokeCardId] = useState<string>("");
  const [revokeReason, setRevokeReason] = useState("");
  const { data: revokeCollection } = trpc.admin.getUserCardCollection.useQuery(
    { userId: Number(revokeUserId) },
    { enabled: !!revokeUserId && revokeUserId !== "" },
  );
  const revokeMutation = trpc.admin.revokeCardFromUser.useMutation({
    onSuccess: () => {
      toast.success("Card revoked from user.");
      setRevokeUserId("");
      setRevokeCardId("");
      setRevokeReason("");
      utils.admin.getUserCardCollection.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const refresh = () => {
    utils.admin.listCards.invalidate();
    utils.admin.listStreakCardRewards.invalidate();
    utils.admin.listXpCardMilestones.invalidate();
    utils.admin.listAchievementCardRewards.invalidate();
    utils.admin.listAchievements.invalidate();
  };

  const upsert = trpc.admin.upsertCard.useMutation({
    onSuccess: () => {
      toast.success(editing ? "Card updated." : "Card created.");
      setOpen(false);
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = trpc.admin.deleteCard.useMutation({
    onSuccess: () => {
      toast.success("Card deleted.");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const saveStreakReward = trpc.admin.upsertStreakCardReward.useMutation({
    onSuccess: () => {
      toast.success("Streak card reward saved.");
      setStreakOpen(false);
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const delStreak = trpc.admin.deleteStreakCardReward.useMutation({
    onSuccess: () => { toast.success("Streak reward deleted."); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const saveXpMilestone = trpc.admin.upsertXpCardMilestone.useMutation({
    onSuccess: () => {
      toast.success("XP milestone saved.");
      setXpOpen(false);
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const delXp = trpc.admin.deleteXpCardMilestone.useMutation({
    onSuccess: () => { toast.success("XP milestone deleted."); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const saveAchReward = trpc.admin.upsertAchievementCardReward.useMutation({
    onSuccess: () => {
      toast.success("Achievement card reward saved.");
      setAchOpen(false);
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const delAch = trpc.admin.deleteAchievementCardReward.useMutation({
    onSuccess: () => { toast.success("Achievement reward deleted."); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const saveUserAchievement = trpc.admin.upsertAchievement.useMutation({
    onSuccess: (data) => {
      toast.success(userAchEditing ? "User achievement updated." : "User achievement created.");
      const achId = userAchEditing?.id ?? data.id;
      if (userAchForm.linkedCardId !== null) {
        const existing = cardRewards?.find((r) => r.achievementId === achId);
        if (existing && Number(existing.cardId) !== userAchForm.linkedCardId) {
          deleteCardRewardInline.mutate({ id: existing.id });
        }
        saveCardRewardInline.mutate({ achievementId: achId, cardId: userAchForm.linkedCardId });
      } else {
        const existing = cardRewards?.find((r) => r.achievementId === achId);
        if (existing) {
          deleteCardRewardInline.mutate({ id: existing.id });
        } else {
          setUserAchOpen(false);
          refresh();
        }
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteUserAchievement = trpc.admin.deleteAchievement.useMutation({
    onSuccess: () => {
      toast.success("User achievement deleted.");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const saveCardRewardInline = trpc.admin.upsertAchievementCardReward.useMutation({
    onSuccess: () => {
      setUserAchOpen(false);
      refresh();
    },
  });

  const deleteCardRewardInline = trpc.admin.deleteAchievementCardReward.useMutation({
    onSuccess: () => {
      setUserAchOpen(false);
      refresh();
    },
  });

  const grantCardMutation = trpc.admin.grantCardToUser.useMutation({
    onSuccess: () => {
      toast.success("Card granted to user.");
      setGrantOpen(false);
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const saveCard = () => {
    if (!form.name.trim()) return toast.error("Card name is required.");
    if (!form.slug.trim()) return toast.error("Slug is required.");
    if (form.totalSupply < 1) return toast.error("Total supply must be at least 1.");
    upsert.mutate({
      id: editing?.id,
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description || null,
      imageKey: form.imageKey || null,
      category: form.category,
      totalSupply: form.totalSupply,
      claimedSupply: editing ? editing.claimedSupply : undefined,
      unlockMethod: form.unlockMethod,
      unlockRequirement: form.unlockRequirement || null,
      isActive: form.isActive,
    });
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (c: Card) => {
    setEditing(c);
    setForm({
      name: c.name,
      slug: c.slug,
      description: c.description ?? "",
      imageKey: c.imageKey,
      imageUrl: null,
      category: c.category,
      totalSupply: c.totalSupply,
      claimedSupply: c.claimedSupply,
      unlockMethod: c.unlockMethod as UnlockMethod,
      unlockRequirement: c.unlockRequirement ?? "",
      isActive: c.isActive,
    });
    setOpen(true);
  };

  const openStreakEdit = (r?: { id: number; streakDays: number; cardId: number; isActive: boolean }) => {
    if (r) {
      setStreakEditing({ id: r.id, streakDays: r.streakDays, cardId: String(r.cardId), isActive: r.isActive });
    } else {
      setStreakEditing({ streakDays: 10, cardId: "", isActive: true });
    }
    setStreakOpen(true);
  };

  const handleSaveStreakReward = () => {
    if (!streakEditing || !streakEditing.cardId) return toast.error("Select a card.");
    saveStreakReward.mutate({ id: streakEditing.id, streakDays: streakEditing.streakDays, cardId: Number(streakEditing.cardId), isActive: streakEditing.isActive });
  };

  const openXpEdit = (m?: { id: number; xpThreshold: number; cardId: number; isActive: boolean }) => {
    if (m) {
      setXpEditing({ id: m.id, xpThreshold: m.xpThreshold, cardId: String(m.cardId), isActive: m.isActive });
    } else {
      setXpEditing({ xpThreshold: 1000, cardId: "", isActive: true });
    }
    setXpOpen(true);
  };

  const handleSaveXpMilestone = () => {
    if (!xpEditing || !xpEditing.cardId) return toast.error("Select a card.");
    saveXpMilestone.mutate({ id: xpEditing.id, xpThreshold: xpEditing.xpThreshold, cardId: Number(xpEditing.cardId), isActive: xpEditing.isActive });
  };

  const handleSaveAchReward = () => {
    if (!achForm.achievementId || !achForm.cardId) return toast.error("Select achievement and card.");
    saveAchReward.mutate({ achievementId: Number(achForm.achievementId), cardId: Number(achForm.cardId) });
  };

  const handleSaveUserAchievement = () => {
    if (!userAchForm.name.trim()) return toast.error("Achievement name is required.");
    saveUserAchievement.mutate({
      id: userAchEditing?.id,
      name: userAchForm.name.trim(),
      description: userAchForm.description || null,
      iconKey: userAchForm.iconKey || null,
      badge: userAchForm.badge || null,
      tag: userAchForm.tag || null,
      category: userAchForm.category || null,
      requirementType: userAchForm.requirementType as "xp_milestone" | "login_streak" | "quiz_completion" | "task_completion" | "manual",
      requirementValue: userAchForm.requirementValue,
      xpReward: userAchForm.xpReward,
      isActive: userAchForm.isActive,
    });
  };

  const openUserAchEdit = (a: Achievement) => {
    setUserAchEditing(a);
    const existingLink = cardRewards?.find((r) => r.achievementId === a.id);
    setUserAchForm({
      name: a.name,
      description: a.description ?? "",
      iconKey: a.iconKey ?? null,
      iconUrl: a.iconUrl ?? null,
      badge: a.badge ?? "",
      tag: a.tag ?? "",
      category: a.category ?? "",
      requirementType: a.requirementType ?? "manual",
      requirementValue: a.requirementValue ?? null,
      xpReward: a.xpReward ?? 0,
      isActive: a.isActive,
      linkedCardId: existingLink ? Number(existingLink.cardId) : null,
    });
    setUserAchOpen(true);
  };

  const openUserAchCreate = () => {
    setUserAchEditing(null);
    setUserAchForm({
      name: "",
      description: "",
      iconKey: null,
      iconUrl: null,
      badge: "",
      tag: "",
      category: "",
      requirementType: "manual",
      requirementValue: null,
      xpReward: 0,
      isActive: true,
      linkedCardId: null,
    });
    setUserAchOpen(true);
  };

  const handleSaveGrant = () => {
    if (!grantForm.userId || !grantForm.cardId) return toast.error("Select user and card.");
    grantCardMutation.mutate({
      userId: Number(grantForm.userId),
      cardId: Number(grantForm.cardId),
      quantity: grantForm.quantity,
      note: grantForm.note || undefined,
    });
  };

  const activeCards = (cardsList ?? []).filter((c) => c.isActive);
  const inactiveCards = (cardsList ?? []).filter((c) => !c.isActive);

  return (
    <AdminLayout title="Card Collection">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{cardsList?.length ?? 0} cards</p>
        <Button onClick={openCreate} className="gap-2 bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]">
          <Plus className="h-4 w-4" /> New Card
        </Button>
      </div>

      <Tabs defaultValue="cards" onValueChange={(v) => setGrantOpen(v === "grant")} className="space-y-6">
        <TabsList>
          <TabsTrigger value="cards">Cards</TabsTrigger>
          <TabsTrigger value="streak-rewards">Streak Rewards</TabsTrigger>
          <TabsTrigger value="xp-milestones">XP Milestones</TabsTrigger>
          <TabsTrigger value="achievement-rewards">Achievement Rewards</TabsTrigger>
          <TabsTrigger value="user-achievements">User Achievements</TabsTrigger>
          <TabsTrigger value="grant">Grant Card</TabsTrigger>
          <TabsTrigger value="revoke">Revoke Card</TabsTrigger>
        </TabsList>

        <TabsContent value="cards">
          {isLoading ? (
            <p className="text-muted-foreground">Loading cards...</p>
          ) : (cardsList ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No cards yet. Create your first card!</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[...activeCards, ...inactiveCards].map((c) => (
                <CardPreview key={c.id} card={c} onEdit={() => openEdit(c)} onDelete={() => remove.mutate({ id: c.id })} />
              ))}
            </div>
          )}
        </TabsContent>

          <TabsContent value="streak-rewards">
            <StreakRewardsTab onAdd={() => openStreakEdit()} onEdit={openStreakEdit} onDelete={(id) => delStreak.mutate({ id })} />
          </TabsContent>

          <TabsContent value="xp-milestones">
            <XpMilestonesTab onAdd={() => openXpEdit()} onEdit={openXpEdit} onDelete={(id) => delXp.mutate({ id })} />
          </TabsContent>

         <TabsContent value="achievement-rewards">
           <AchievementRewardsTab onAdd={() => setAchOpen(true)} onDelete={(id) => delAch.mutate({ id })} />
         </TabsContent>

         <TabsContent value="user-achievements">
           <UserAchievementsTab onAdd={() => openUserAchCreate()} onEdit={openUserAchEdit} onDelete={(id) => deleteUserAchievement.mutate({ id })} />
         </TabsContent>

         <TabsContent value="grant">
          <GrantCardTab
            open={grantOpen}
            onOpenChange={setGrantOpen}
            users={userList ?? []}
            cards={activeCards}
            form={grantForm}
            setForm={setGrantForm}
            onSave={handleSaveGrant}
          />
        </TabsContent>

        <TabsContent value="revoke">
          <div className="space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label>Search User</Label>
                <Select value={revokeUserId} onValueChange={setRevokeUserId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {(userList ?? []).map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.username ?? u.name ?? u.email ?? `User #${u.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {revokeUserId && (
              <>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Label>Card to Revoke</Label>
                    <Select value={revokeCardId} onValueChange={setRevokeCardId}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select a card copy" />
                      </SelectTrigger>
                      <SelectContent>
                        {(revokeCollection ?? []).filter((r) => !r.revoked).map((r) => (
                          <SelectItem key={r.id} value={String(r.id)}>
                            <div className="flex items-center gap-2">
                              <span className="truncate max-w-[250px]">{r.card.name}</span>
                              <span className="text-xs text-muted-foreground">#{r.copyNumber}/{r.card.totalSupply}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Label>Reason (optional)</Label>
                    <Input
                      placeholder="e.g., Rule violation"
                      value={revokeReason}
                      onChange={(e) => setRevokeReason(e.target.value)}
                      className="h-10"
                    />
                  </div>
                </div>

                <Button
                  variant="destructive"
                  disabled={!revokeCardId || revokeMutation.isPending}
                  onClick={() => {
                    if (!revokeCardId) return;
                    if (!confirm(`Revoke this card copy from this user? This cannot be undone.`)) return;
                    revokeMutation.mutate({
                      userId: Number(revokeUserId),
                      userCardId: Number(revokeCardId),
                      reason: revokeReason || undefined,
                    });
                  }}
                >
                  {revokeMutation.isPending ? "Revoking..." : "Revoke Card Copy"}
                </Button>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Card Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong max-h-[90vh] overflow-y-auto border-border sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Card" : "New Card"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Golden Dragon" />
            </div>
            <div>
              <Label>Slug *</Label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="golden-dragon" />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as CardCategory })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="common">Common</SelectItem>
                  <SelectItem value="rare">Rare</SelectItem>
                  <SelectItem value="epic">Epic</SelectItem>
                  <SelectItem value="legendary">Legendary</SelectItem>
                  <SelectItem value="event">Event</SelectItem>
                  <SelectItem value="exclusive">Exclusive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Total Supply *</Label>
              <Input type="number" inputMode="numeric" min={1} value={form.totalSupply} onChange={(e) => setForm({ ...form, totalSupply: Number(e.target.value) || 1 })} />
            </div>
            <div>
              <Label>Unlock Method</Label>
              <Select value={form.unlockMethod} onValueChange={(v) => setForm({ ...form, unlockMethod: v as UnlockMethod })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily_streak">Daily Streak</SelectItem>
                  <SelectItem value="xp_milestone">XP Milestone</SelectItem>
                  <SelectItem value="achievement">Achievement</SelectItem>
                  <SelectItem value="event">Event</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="exclusive">Exclusive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Unlock Requirement</Label>
              <Input value={form.unlockRequirement} onChange={(e) => setForm({ ...form, unlockRequirement: e.target.value })} placeholder="e.g. 30 days, 10k XP" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <ImageUpload
              label="Card Artwork"
              value={form.imageKey}
              previewUrl={form.imageUrl}
              category="card-artwork"
              onUploaded={(key, url) => setForm({ ...form, imageKey: key, imageUrl: url })}
            />
            <div className="flex items-center gap-2">
              <input id="card-active" type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="h-4 w-4 rounded border-border" />
              <Label htmlFor="card-active">Active</Label>
            </div>
            <div className="sticky bottom-0 -mx-6 flex justify-end gap-2 border-t border-border bg-[hsl(224_45%_6%)] px-6 py-3">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={saveCard} disabled={upsert.isPending} className="bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]">
                {upsert.isPending ? "Saving..." : "Save Card"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Streak Reward Dialog */}
      <Dialog open={streakOpen} onOpenChange={setStreakOpen}>
        <DialogContent className="glass-strong border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{streakEditing?.id ? "Edit Streak Reward" : "New Streak Reward"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Streak Days *</Label>
              <Input type="number" min={1} value={streakEditing?.streakDays ?? 10} onChange={(e) => setStreakEditing({ ...streakEditing!, streakDays: Number(e.target.value) || 1 })} placeholder="e.g. 30" />
            </div>
            <div>
              <Label>Card *</Label>
              <Select value={streakEditing?.cardId ?? ""} onValueChange={(v) => setStreakEditing({ ...streakEditing!, cardId: v })}>
                <SelectTrigger><SelectValue placeholder="Select a card" /></SelectTrigger>
                <SelectContent>
                  {(allCards ?? []).filter((c) => c.isActive).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name} ({CATEGORY_LABELS[c.category as CardCategory]})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="streak-active"
                type="checkbox"
                checked={streakEditing?.isActive ?? true}
                onChange={(e) => setStreakEditing({ ...streakEditing!, isActive: e.target.checked })}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="streak-active" className="text-sm font-normal">Active</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setStreakOpen(false); setStreakEditing(null); }}>Cancel</Button>
              <Button onClick={handleSaveStreakReward} disabled={saveStreakReward.isPending} className="bg-[hsl(var(--tsg-blue))]">{saveStreakReward.isPending ? "Saving..." : "Save"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* XP Milestone Dialog */}
      <Dialog open={xpOpen} onOpenChange={setXpOpen}>
        <DialogContent className="glass-strong border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{xpEditing?.id ? "Edit XP Milestone" : "New XP Milestone"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>XP Threshold *</Label>
              <Input type="number" min={0} value={xpEditing?.xpThreshold ?? 1000} onChange={(e) => setXpEditing({ ...xpEditing!, xpThreshold: Number(e.target.value) || 0 })} placeholder="e.g. 10000" />
            </div>
            <div>
              <Label>Card *</Label>
              <Select value={xpEditing?.cardId ?? ""} onValueChange={(v) => setXpEditing({ ...xpEditing!, cardId: v })}>
                <SelectTrigger><SelectValue placeholder="Select a card" /></SelectTrigger>
                <SelectContent>
                  {(allCards ?? []).filter((c) => c.isActive).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name} ({CATEGORY_LABELS[c.category as CardCategory]})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="xp-active"
                type="checkbox"
                checked={xpEditing?.isActive ?? true}
                onChange={(e) => setXpEditing({ ...xpEditing!, isActive: e.target.checked })}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="xp-active" className="text-sm font-normal">Active</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setXpOpen(false); setXpEditing(null); }}>Cancel</Button>
              <Button onClick={handleSaveXpMilestone} disabled={saveXpMilestone.isPending} className="bg-[hsl(var(--tsg-blue))]">{saveXpMilestone.isPending ? "Saving..." : "Save"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Achievement Reward Dialog */}
      <Dialog open={achOpen} onOpenChange={setAchOpen}>
        <DialogContent className="glass-strong border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Achievement Card Reward</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Achievement *</Label>
              <Select value={achForm.achievementId} onValueChange={(v) => setAchForm({ ...achForm, achievementId: v })}>
                <SelectTrigger><SelectValue placeholder="Select an achievement" /></SelectTrigger>
                <SelectContent>
                  {(achievements ?? []).map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Card *</Label>
              <Select value={achForm.cardId} onValueChange={(v) => setAchForm({ ...achForm, cardId: v })}>
                <SelectTrigger><SelectValue placeholder="Select a card" /></SelectTrigger>
                <SelectContent>
                  {(allCards ?? []).filter((c) => c.isActive).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name} ({CATEGORY_LABELS[c.category as CardCategory]})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAchOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveAchReward} disabled={saveAchReward.isPending} className="bg-[hsl(var(--tsg-blue))]">Save</Button>
            </div>
          </div>
        </DialogContent>
       </Dialog>

      {/* User Achievement Edit Dialog */}
      <Dialog open={userAchOpen} onOpenChange={setUserAchOpen}>
        <DialogContent className="glass-strong max-h-[90vh] overflow-y-auto border-border sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{userAchEditing ? "Edit User Achievement" : "New User Achievement"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input value={userAchForm.name} onChange={(e) => setUserAchForm({ ...userAchForm, name: e.target.value })} placeholder="First Blood" />
            </div>
            <div>
              <Label>Badge</Label>
              <Input value={userAchForm.badge} onChange={(e) => setUserAchForm({ ...userAchForm, badge: e.target.value })} placeholder="Gold" />
            </div>
            <div>
              <Label>Tag</Label>
              <Input value={userAchForm.tag} onChange={(e) => setUserAchForm({ ...userAchForm, tag: e.target.value })} placeholder="season1" />
            </div>
            <div>
              <Label>Category</Label>
              <Input value={userAchForm.category} onChange={(e) => setUserAchForm({ ...userAchForm, category: e.target.value })} placeholder="Tournament" />
            </div>
            <div>
              <Label>Requirement Type</Label>
              <Select value={userAchForm.requirementType} onValueChange={(v) => setUserAchForm({ ...userAchForm, requirementType: v })}>
                <SelectTrigger><SelectValue placeholder="Select requirement type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="xp_milestone">XP Milestone</SelectItem>
                  <SelectItem value="login_streak">Login Streak</SelectItem>
                  <SelectItem value="quiz_completion">Quiz Completion</SelectItem>
                  <SelectItem value="task_completion">Task Completion</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Requirement Value</Label>
              <Input type="number" inputMode="numeric" value={userAchForm.requirementValue ?? ""} onChange={(e) => setUserAchForm({ ...userAchForm, requirementValue: e.target.value ? Number(e.target.value) : null })} placeholder="100" />
            </div>
            <div>
              <Label>XP Reward</Label>
              <Input type="number" inputMode="numeric" value={userAchForm.xpReward} onChange={(e) => setUserAchForm({ ...userAchForm, xpReward: Number(e.target.value) || 0 })} placeholder="50" />
            </div>
            <div>
              <Label>Linked Card</Label>
              <Select
                value={userAchForm.linkedCardId ? String(userAchForm.linkedCardId) : ""}
                onValueChange={(v) => setUserAchForm({ ...userAchForm, linkedCardId: v ? Number(v) : null })}
              >
                <SelectTrigger><SelectValue placeholder="Select a card (optional)" /></SelectTrigger>
                <SelectContent>
                  {(cardList ?? []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name} ({c.category})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea rows={2} value={userAchForm.description} onChange={(e) => setUserAchForm({ ...userAchForm, description: e.target.value })} />
            </div>
            <div>
              <Label>Icon Key</Label>
              <Input value={userAchForm.iconKey ?? ""} onChange={(e) => setUserAchForm({ ...userAchForm, iconKey: e.target.value })} placeholder="achievements/first-blood.png" />
            </div>
            <ImageUpload
              label="Achievement Icon"
              value={userAchForm.iconKey}
              previewUrl={userAchForm.iconUrl}
              category="achievement-images"
              onUploaded={(key, url) => setUserAchForm({ ...userAchForm, iconKey: key, iconUrl: url })}
            />
            <div className="flex items-center gap-2">
              <input
                id="ua-active"
                type="checkbox"
                checked={userAchForm.isActive}
                onChange={(e) => setUserAchForm({ ...userAchForm, isActive: e.target.checked })}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="ua-active" className="text-sm font-normal">Active</Label>
            </div>
            <div className="sticky bottom-0 -mx-6 flex justify-end gap-2 border-t border-border bg-[hsl(224_45%_6%)] px-6 py-3">
              <Button variant="outline" onClick={() => setUserAchOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveUserAchievement} disabled={saveUserAchievement.isPending} className="bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]">
                {saveUserAchievement.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
     </AdminLayout>
  );
}

function CardPreview({
  card,
  onEdit,
  onDelete,
}: {
  card: Card;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const soldOut = card.remainingSupply <= 0;
  const colorClass = CATEGORY_COLORS[card.category as CardCategory] ?? "border-gray-500/40 text-gray-400";
  return (
    <div className={`group relative rounded-xl border ${colorClass} p-4 transition hover:shadow-lg`}>
      <div className="mb-3 aspect-[3/4] w-full overflow-hidden rounded-lg border border-border/30 bg-background/40">
        {card.imageUrl ? (
          <img src={card.imageUrl} alt={card.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Gem className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        {soldOut && <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs font-bold text-white">SOLD OUT</span>}
      </div>
      <h3 className="font-display font-bold">{card.name}</h3>
      <p className="text-xs uppercase tracking-widest">{CATEGORY_LABELS_ADMIN[card.category as CardCategory]}</p>
      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        <p>Supply: {card.claimedSupply}/{card.totalSupply}</p>
        <p>Holders: {card.holderCount}</p>
        <p>Remaining: {card.remainingSupply}</p>
      </div>
      <div className="mt-3 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
        <Button variant="outline" size="icon" onClick={onEdit} aria-label={`Edit ${card.name}`}><Pencil className="h-4 w-4" /></Button>
        <ConfirmDialog
          trigger={
            <Button variant="outline" size="icon" aria-label={`Delete ${card.name}`}><Trash2 className="h-4 w-4 text-[hsl(var(--tsg-red))]" /></Button>
          }
          title={`Delete ${card.name}?`}
          description="This will permanently delete this card."
          onConfirm={onDelete}
        />
      </div>
    </div>
  );
}

// Streak Rewards Tab
function StreakRewardsTab({ onAdd, onEdit, onDelete }: { onAdd: () => void; onEdit: (r: { id: number; streakDays: number; cardId: number; isActive: boolean }) => void; onDelete: (id: number) => void }) {
  const { data, isLoading } = trpc.admin.listStreakCardRewards.useQuery();
  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{data?.length ?? 0} streak card rewards</p>
        <Button size="sm" onClick={onAdd} className="gap-1.5 bg-[hsl(var(--tsg-blue))]"><Plus className="h-4 w-4" /> Add Reward</Button>
      </div>
      <div className="space-y-2">
        {(data ?? []).map((r) => (
          <div key={r.id} className="glass flex items-center justify-between rounded-lg p-3">
            <div>
              <p className="font-semibold">{r.streakDays} day streak → <span className="text-[hsl(var(--tsg-blue))]">{r.cardName}</span></p>
              <p className="text-xs text-muted-foreground">{r.streakDays} consecutive days · {r.isActive ? "Active" : "Inactive"}</p>
            </div>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" onClick={() => onEdit(r)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => onDelete(r.id)}><Trash2 className="h-4 w-4 text-[hsl(var(--tsg-red))]" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// XP Milestones Tab
function XpMilestonesTab({ onAdd, onEdit, onDelete }: { onAdd: () => void; onEdit: (m: { id: number; xpThreshold: number; cardId: number; isActive: boolean }) => void; onDelete: (id: number) => void }) {
  const { data, isLoading } = trpc.admin.listXpCardMilestones.useQuery();
  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{data?.length ?? 0} XP milestones</p>
        <Button size="sm" onClick={onAdd} className="gap-1.5 bg-[hsl(var(--tsg-blue))]"><Plus className="h-4 w-4" /> Add Milestone</Button>
      </div>
      <div className="space-y-2">
        {(data ?? []).map((m) => (
          <div key={m.id} className="glass flex items-center justify-between rounded-lg p-3">
            <div>
              <p className="font-semibold">{m.xpThreshold.toLocaleString()} XP → <span className="text-[hsl(var(--tsg-red))]">{m.cardName}</span></p>
              <p className="text-xs text-muted-foreground">Reach {m.xpThreshold.toLocaleString()} XP · {m.isActive ? "Active" : "Inactive"}</p>
            </div>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" onClick={() => onEdit(m)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => onDelete(m.id)}><Trash2 className="h-4 w-4 text-[hsl(var(--tsg-red))]" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Achievement Rewards Tab
function AchievementRewardsTab({ onAdd, onDelete }: { onAdd: () => void; onDelete: (id: number) => void }) {
  const { data, isLoading } = trpc.admin.listAchievementCardRewards.useQuery();
  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{data?.length ?? 0} achievement card rewards</p>
        <Button size="sm" onClick={onAdd} className="gap-1.5 bg-[hsl(var(--tsg-blue))]"><Plus className="h-4 w-4" /> Add Reward</Button>
      </div>
      <div className="space-y-2">
        {(data ?? []).map((r) => (
          <div key={r.id} className="glass flex items-center justify-between rounded-lg p-3">
            <div>
              <p className="font-semibold">{r.achievementName} → <span className="text-[hsl(var(--tsg-blue))]">{r.cardName}</span></p>
              <p className="text-xs text-muted-foreground">Achievement reward</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => onDelete(r.id)}><Trash2 className="h-4 w-4 text-[hsl(var(--tsg-red))]" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// User Achievements Tab
function UserAchievementsTab({ onAdd, onEdit, onDelete }: { onAdd: () => void; onEdit: (a: Achievement) => void; onDelete: (id: number) => void }) {
  const { data: list, isLoading } = trpc.admin.listAchievements.useQuery();
  const { data: cardRewards } = trpc.admin.listAchievementCardRewards.useQuery();
  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{list?.length ?? 0} user achievements</p>
        <Button size="sm" onClick={onAdd} className="gap-1.5 bg-[hsl(var(--tsg-blue))]"><Plus className="h-4 w-4" /> Add Achievement</Button>
      </div>
      <div className="space-y-2">
        {(list ?? []).map((a) => {
          const linked = cardRewards?.find((r) => r.achievementId === a.id);
          return (
            <div key={a.id} className="glass flex items-center justify-between rounded-lg p-3">
              <div className="flex items-center gap-3">
                <Trophy className="h-4 w-4 text-[hsl(var(--tsg-blue))]" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{a.name}</p>
                    {a.badge && <span className="text-xs font-bold text-amber-400">[{a.badge}]</span>}
                    {a.tag && <span className="text-xs uppercase text-muted-foreground">#{a.tag}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{a.category || "Uncategorized"} · {a.isActive ? "Active" : "Inactive"}{a.xpReward > 0 ? ` · +${a.xpReward} XP` : ""}{linked && ` · Card: ${linked.cardName}`}</p>
                </div>
              </div>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" onClick={() => onEdit(a)}><Pencil className="h-4 w-4" /></Button>
                <ConfirmDialog
                  trigger={<Button variant="outline" size="sm"><Trash2 className="h-4 w-4 text-[hsl(var(--tsg-red))]" /></Button>}
                  title={`Delete ${a.name}?`}
                  description="This will permanently delete this achievement."
                  onConfirm={() => onDelete(a.id)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Grant Card Tab
function GrantCardTab({ open, onOpenChange, users, cards, form, setForm, onSave }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  users: { id: number; name: string | null; username: string | null }[];
  cards: Card[];
  form: { userId: string; cardId: string; quantity: number; note: string };
  setForm: (f: typeof form) => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Grant Card to User</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>User *</Label>
            <Select value={form.userId} onValueChange={(v) => setForm({ ...form, userId: v })}>
              <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>{u.name ?? u.username ?? `User #${u.id}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Card *</Label>
            <Select value={form.cardId} onValueChange={(v) => setForm({ ...form, cardId: v })}>
              <SelectTrigger><SelectValue placeholder="Select card" /></SelectTrigger>
              <SelectContent>
                {cards.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name} ({CATEGORY_LABELS[c.category as CardCategory]}) — {c.remainingSupply} left</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Quantity</Label>
            <Input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) || 1 })} />
          </div>
          <div>
            <Label>Note</Label>
            <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Reason for grant" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={onSave} className="bg-[hsl(var(--tsg-blue))]">Grant</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
