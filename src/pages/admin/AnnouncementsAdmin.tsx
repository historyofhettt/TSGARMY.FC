import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Megaphone, Plus, Pencil, Trash2, Send, CalendarClock,
  ExternalLink, Link2, Users, UserRound, Eye, EyeOff, X,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { timeAgo, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Priority = "normal" | "important" | "urgent";
type Status = "draft" | "scheduled" | "published";
type TargetType = "everyone" | "role" | "users";

type Link = { url: string; label: string };

type TargetUser = { id: number; name: string; username: string; role: string };

const EMPTY_FORM = {
  title: "",
  message: "",
  imageKey: null as string | null,
  imageUrl: null as string | null,
  priority: "normal" as Priority,
  status: "draft" as Status,
  scheduledAt: "" as string,
  targetType: "everyone" as TargetType,
  targetRole: "" as string,
  targetUserIds: [] as number[],
  targetUsers: [] as TargetUser[],
  links: [] as Link[],
  buttonStyle: "primary" as ButtonStyle,
  buttonIcon: "" as string,
  youtubeVideoId: null as string | null,
  layout: "compact" as Layout,
};

type ButtonStyle = "primary" | "outline" | "ghost";
type Layout = "compact" | "card" | "banner";

const PRIORITY_OPTIONS: { value: Priority; label: string; className: string }[] = [
  { value: "normal", label: "Normal", className: "bg-border text-muted-foreground" },
  { value: "important", label: "Important", className: "bg-[hsl(var(--tsg-blue)/0.15)] text-[hsl(var(--tsg-blue))]" },
  { value: "urgent", label: "Urgent", className: "bg-[hsl(var(--tsg-red)/0.15)] text-[hsl(var(--tsg-red))]" },
];

const STATUS_BADGE: Record<Status, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-border text-muted-foreground" },
  scheduled: { label: "Scheduled", className: "bg-[hsl(var(--tsg-blue)/0.15)] text-[hsl(var(--tsg-blue))]" },
  published: { label: "Published", className: "bg-[hsl(var(--tsg-red)/0.15)] text-[hsl(var(--tsg-red))]" },
};

const TARGET_LABELS: Record<TargetType, string> = {
  everyone: "Everyone",
  role: "Role",
  users: "Selected users",
};

export default function AnnouncementsAdmin() {
  useEffect(() => {
    document.title = "Announcements | Admin";
  }, []);

  const utils = trpc.useUtils();
  const { data: list, isLoading } = trpc.admin.listAnnouncements.useQuery();
  const { data: roles } = trpc.admin.listNotificationRoles.useQuery();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<TargetUser[]>([]);

  const create = trpc.admin.createAnnouncement.useMutation({
    onSuccess: (res) => {
      toast.success("Announcement created.");
      utils.admin.listAnnouncements.invalidate();
      setOpen(false);
      return res;
    },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.admin.updateAnnouncement.useMutation({
    onSuccess: () => {
      toast.success("Announcement updated.");
      utils.admin.listAnnouncements.invalidate();
      setOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const publish = trpc.admin.publishAnnouncement.useMutation({
    onSuccess: (res) => {
      toast.success(`Published. ${res.delivered} notification(s) delivered.`);
      utils.admin.listAnnouncements.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const toggleActive = trpc.admin.setAnnouncementActive.useMutation({
    onSuccess: () => {
      toast.success("Announcement updated.");
      utils.admin.listAnnouncements.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.admin.deleteAnnouncement.useMutation({
    onSuccess: () => {
      toast.success("Announcement deleted.");
      utils.admin.listAnnouncements.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const sendManual = trpc.admin.sendManualNotification.useMutation({
    onSuccess: (res) => {
      toast.success(`Delivered ${res.delivered} notification(s).`);
      utils.admin.listAnnouncements.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const sendPlayerLive = trpc.admin.sendPlayerLive.useMutation({
    onSuccess: (res) => {
      toast.success(`Player Live: ${res.delivered} delivered.`);
    },
    onError: (e) => toast.error(e.message),
  });
  const sendClutch = trpc.admin.sendClutchHighlight.useMutation({
    onSuccess: (res) => {
      toast.success(`Clutch/Highlight: ${res.delivered} delivered.`);
    },
    onError: (e) => toast.error(e.message),
  });

  // Debounced user search for targeting
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    if (!open || form.targetType !== "users") {
      setDebouncedQuery("");
      return;
    }
    if (userQuery.trim().length < 2) {
      setDebouncedQuery("");
      return;
    }
    const t = setTimeout(() => setDebouncedQuery(userQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [userQuery, open, form.targetType]);

  const shouldSearch = debouncedQuery.length >= 2;
  const { data: searchData, isLoading: searching } = trpc.admin.searchUsers.useQuery(
    { query: debouncedQuery },
    { enabled: shouldSearch },
  );
  useEffect(() => {
    if (!shouldSearch) {
      setUserResults([]);
      return;
    }
    setUserResults((searchData ?? []) as TargetUser[]);
  }, [searchData, shouldSearch]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setUserQuery("");
    setUserResults([]);
    setOpen(true);
  };

  const openEdit = (a: (typeof list extends (infer T)[] | undefined ? T : never)) => {
    setEditingId(a.id);
    setForm({
      title: a.title,
      message: a.message,
      imageKey: a.imageKey ?? null,
      imageUrl: null,
      priority: a.priority as Priority,
      status: a.status as Status,
      scheduledAt: a.scheduledAt
        ? new Date(a.scheduledAt).toISOString().slice(0, 16)
        : "",
      targetType: a.targetType as TargetType,
      targetRole: a.targetRole ?? "",
      targetUserIds: (a as { targets?: { userId: number }[] }).targets?.map((t) => t.userId) ?? [],
      targetUsers: (a as { targets?: TargetUser[] }).targets ?? [],
      links: (a.links ?? []).map((l) => ({ url: l.url, label: l.label })),
      buttonStyle: (a.buttonStyle as ButtonStyle) ?? "primary",
      buttonIcon: a.buttonIcon ?? "",
      youtubeVideoId: a.youtubeVideoId ?? null,
      layout: (a.layout as Layout) ?? "compact",
    });
    setUserQuery("");
    setUserResults([]);
    setOpen(true);
  };

  const addLink = () => {
    setForm({ ...form, links: [...form.links, { url: "", label: "" }] });
  };
  const updateLink = (i: number, patch: Partial<Link>) => {
    const links = form.links.map((l, idx) => (idx === i ? { ...l, ...patch } : l));
    setForm({ ...form, links });
  };
  const removeLink = (i: number) => {
    setForm({ ...form, links: form.links.filter((_, idx) => idx !== i) });
  };

  const addTargetUser = (u: TargetUser) => {
    if (form.targetUserIds.includes(u.id)) return;
    setForm({
      ...form,
      targetUserIds: [...form.targetUserIds, u.id],
      targetUsers: [...form.targetUsers, u],
    });
    setUserQuery("");
    setUserResults([]);
  };
  const removeTargetUser = (id: number) => {
    setForm({
      ...form,
      targetUserIds: form.targetUserIds.filter((x) => x !== id),
      targetUsers: form.targetUsers.filter((u) => u.id !== id),
    });
  };

  const validate = (): string | null => {
    if (!form.title.trim()) return "Title is required.";
    if (!form.message.trim()) return "Message is required.";
    if (form.status === "scheduled" && !form.scheduledAt)
      return "Scheduled time is required.";
    if (form.targetType === "role" && !form.targetRole)
      return "Select a target role.";
    if (form.targetType === "users" && form.targetUserIds.length === 0)
      return "Select at least one user.";
    for (const l of form.links) {
      if (!l.url.trim() || !l.label.trim())
        return "Each link needs a URL and a label.";
      try {
        const u = new URL(l.url.trim());
        if (u.protocol !== "http:" && u.protocol !== "https:")
          return "Link URLs must be http(s).";
      } catch {
        return "Invalid link URL.";
      }
    }
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    const payload = {
      title: form.title.trim(),
      message: form.message.trim(),
      imageKey: form.imageKey ?? null,
      priority: form.priority,
      status: form.status,
      scheduledAt:
        form.status === "scheduled" && form.scheduledAt
          ? new Date(form.scheduledAt).toISOString()
          : null,
      targetType: form.targetType,
      targetRole: form.targetType === "role" ? form.targetRole : null,
      targetUserIds:
        form.targetType === "users" ? form.targetUserIds : null,
      links: form.links
        .filter((l) => l.url.trim() && l.label.trim())
        .map((l) => ({ url: l.url.trim(), label: l.label.trim() })),
      buttonStyle: form.buttonStyle,
      buttonIcon: form.buttonIcon || null,
      youtubeVideoId: form.youtubeVideoId,
      layout: form.layout,
    };
    if (editingId) {
      await update.mutateAsync({ id: editingId, ...payload });
    } else {
      await create.mutateAsync(payload);
    }
  };

  const priorityBadge = (p: Priority) => {
    const opt = PRIORITY_OPTIONS.find((o) => o.value === p) ?? PRIORITY_OPTIONS[0];
    return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", opt.className)}>{opt.label}</span>;
  };

  return (
    <AdminLayout title="Announcements">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Create rich announcements with images, links, priorities, scheduling
            and audience targeting. Published announcements deliver a notification
            to every targeted user.
          </p>
        </div>
        <Button onClick={openCreate} className="ml-auto gap-1.5 bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]">
          <Plus className="h-4 w-4" /> New Announcement
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (list ?? []).length === 0 ? (
        <p className="glass rounded-xl p-10 text-center text-sm text-muted-foreground">
          No announcements yet. Create your first one.
        </p>
      ) : (
        <div className="space-y-3">
          {(list ?? []).map((a) => {
            const status = STATUS_BADGE[a.status as Status] ?? STATUS_BADGE.draft;
            return (
              <div
                key={a.id}
                className={cn("glass rounded-xl p-4", !a.isActive && "opacity-60")}
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-base font-bold">{a.title}</span>
                      {priorityBadge(a.priority as Priority)}
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", status.className)}>
                        {status.label}
                      </span>
                      {!a.isActive && (
                        <span className="rounded-full bg-border px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {a.message}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> {a.targetCount} target(s)
                      </span>
                      <span className="flex items-center gap-1">
                        <Send className="h-3 w-3" /> {a.sentCount} sent
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" /> {a.readCount} read
                      </span>
                      <span className="flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" /> {a.clickCount} clicks
                      </span>
                      <span>·</span>
                      <span>
                        {TARGET_LABELS[a.targetType as TargetType]}
                        {a.targetType === "role" && a.targetRole ? `: ${a.targetRole}` : ""}
                      </span>
                      {a.scheduledAt && (
                        <span className="flex items-center gap-1">
                          <CalendarClock className="h-3 w-3" />
                          {formatDate(a.scheduledAt)}
                        </span>
                      )}
                      {a.publishedAt && (
                        <span>published {timeAgo(a.publishedAt)}</span>
                      )}
                    </div>
                    {(a.links ?? []).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(a.links ?? []).map((l, i) => (
                          <span key={i} className="flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11px] text-[hsl(var(--tsg-blue))]">
                            <Link2 className="h-3 w-3" /> {l.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {a.status !== "published" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs"
                        onClick={() => publish.mutate({ id: a.id })}
                        disabled={publish.isPending}
                      >
                        <Send className="h-3 w-3" /> Publish now
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs"
                      onClick={() => openEdit(a)}
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs"
                      onClick={() =>
                        toggleActive.mutate({ id: a.id, isActive: !a.isActive })
                      }
                    >
                      {a.isActive ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      {a.isActive ? "Disable" : "Enable"}
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button size="sm" variant="outline" className="gap-1 text-xs">
                          <Trash2 className="h-3 w-3 text-[hsl(var(--tsg-red))]" /> Delete
                        </Button>
                      }
                      title="Delete this announcement?"
                      description="This removes the announcement and all its delivered notifications. This cannot be undone."
                      onConfirm={() => remove.mutate({ id: a.id })}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manual send panel */}
      <div className="glass mt-8 rounded-xl p-5">
        <p className="mb-1 flex items-center gap-2 font-display text-base font-bold">
          <Megaphone className="h-4 w-4" /> Manual Send
        </p>
        <p className="mb-4 text-xs text-muted-foreground">
          Manually trigger an automatic notification type (Player Live, Clutch /
          Highlight, Engagement) to targeted users. Respects each type's Active
          setting.
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          <ManualSendCard
            title="Player Live"
            icon="🔴"
            description="Notify users a player is streaming."
            onSend={async () => {
              const name = window.prompt("Player name:");
              if (!name) return;
              const url = window.prompt("Stream URL (optional):") || null;
              const yt = window.prompt("YouTube Video ID (optional):") || null;
              await sendPlayerLive.mutateAsync({
                playerName: name,
                streamUrl: url,
                youtubeVideoId: yt,
              });
            }}
            pending={sendPlayerLive.isPending}
          />
          <ManualSendCard
            title="Clutch / Highlight"
            icon="🎥"
            description="Notify users of new highlight content."
            onSend={async () => {
              const title = window.prompt("Highlight title:");
              if (!title) return;
              const url = window.prompt("Highlight URL (optional):") || null;
              const yt = window.prompt("YouTube Video ID (optional):") || null;
              const img = window.prompt("Image Key (optional):") || null;
              await sendClutch.mutateAsync({
                title,
                highlightUrl: url,
                youtubeVideoId: yt,
                imageKey: img,
              });
            }}
            pending={sendClutch.isPending}
          />
          <ManualSendCard
            title="Engagement"
            icon="❤️"
            description="Send a test engagement notification."
            onSend={async () => {
              const title = window.prompt("Title:");
              if (!title) return;
              await sendManual.mutateAsync({
                type: "engagement",
                title,
                targetType: "everyone",
              });
            }}
            pending={sendManual.isPending}
          />
        </div>
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong max-h-[90vh] w-full max-w-2xl border-border p-0">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle className="font-display text-lg font-bold">
              {editingId ? "Edit Announcement" : "New Announcement"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Compose a rich announcement. Publish now, save as draft, or schedule.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] px-6 py-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="ann-title">Title</Label>
                <Input
                  id="ann-title"
                  value={form.title}
                  maxLength={255}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Announcement title"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="ann-message">Message</Label>
                <Textarea
                  id="ann-message"
                  value={form.message}
                  maxLength={10000}
                  rows={5}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Write your announcement..."
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label>Image (optional)</Label>
                <div className="mt-1.5">
                  <ImageUpload
                    value={form.imageKey}
                    previewUrl={form.imageUrl}
                    category="other"
                    onUploaded={(key, url) =>
                      setForm({ ...form, imageKey: key, imageUrl: url })
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Priority</Label>
                  <Select
                    value={form.priority}
                    onValueChange={(v) => setForm({ ...form, priority: v as Priority })}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm({ ...form, status: v as Status })}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="published">Publish now</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {form.status === "scheduled" && (
                <div>
                  <Label htmlFor="ann-schedule">Scheduled time</Label>
                  <Input
                    id="ann-schedule"
                    type="datetime-local"
                    value={form.scheduledAt}
                    onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
              )}

              <div>
                <Label>Target audience</Label>
                <Select
                  value={form.targetType}
                  onValueChange={(v) => setForm({ ...form, targetType: v as TargetType })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="everyone">Everyone</SelectItem>
                    <SelectItem value="role">Specific role</SelectItem>
                    <SelectItem value="users">Selected users</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.targetType === "role" && (
                <div>
                  <Label>Role</Label>
                  <Select
                    value={form.targetRole}
                    onValueChange={(v) => setForm({ ...form, targetRole: v })}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {(roles ?? []).map((r) => (
                        <SelectItem key={r.slug} value={r.slug}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {form.targetType === "users" && (
                <div>
                  <Label>Users</Label>
                  <Input
                    value={userQuery}
                    placeholder="Search users by name or username..."
                    onChange={(e) => setUserQuery(e.target.value)}
                    className="mt-1.5"
                  />
                  {searching && (
                    <p className="mt-1 text-xs text-muted-foreground">Searching...</p>
                  )}
                  {userResults.length > 0 && (
                    <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-1">
                      {userResults.map((u) => (
                        <li key={u.id}>
                          <button
                            type="button"
                            onClick={() => addTargetUser(u)}
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                          >
                            <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium">{u.name}</span>
                            <span className="text-xs text-muted-foreground">@{u.username}</span>
                            <span className="ml-auto text-[10px] uppercase text-muted-foreground">{u.role}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {form.targetUsers.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {form.targetUsers.map((u) => (
                        <span
                          key={u.id}
                          className="flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs"
                        >
                          {u.name}
                          <button
                            type="button"
                            onClick={() => removeTargetUser(u.id)}
                            aria-label={`Remove ${u.name}`}
                            className="text-muted-foreground hover:text-[hsl(var(--tsg-red))]"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <Label>Links (up to 10)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={addLink}
                    disabled={form.links.length >= 10}
                  >
                    <Plus className="h-3 w-3" /> Add link
                  </Button>
                </div>
                {form.links.length === 0 ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    No links. Add up to 10 links to attach to the announcement.
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {form.links.map((l, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input
                          value={l.label}
                          placeholder="Label"
                          maxLength={128}
                          onChange={(e) => updateLink(i, { label: e.target.value })}
                          className="w-40"
                        />
                        <Input
                          value={l.url}
                          placeholder="https://..."
                          maxLength={1024}
                          onChange={(e) => updateLink(i, { url: e.target.value })}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-[hsl(var(--tsg-red))]"
                          onClick={() => removeLink(i)}
                          aria-label="Remove link"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Button Style</Label>
                  <Select
                    value={form.buttonStyle}
                    onValueChange={(v) => setForm({ ...form, buttonStyle: v as ButtonStyle })}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primary">Primary</SelectItem>
                      <SelectItem value="outline">Outline</SelectItem>
                      <SelectItem value="ghost">Ghost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Layout</Label>
                  <Select
                    value={form.layout}
                    onValueChange={(v) => setForm({ ...form, layout: v as Layout })}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="compact">Compact</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="banner">Banner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Button Icon (optional)</Label>
                <Input
                  value={form.buttonIcon}
                  onChange={(e) => setForm({ ...form, buttonIcon: e.target.value })}
                  placeholder="e.g. Eye, ExternalLink"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label>YouTube Video ID / URL (optional)</Label>
                <Input
                  value={form.youtubeVideoId ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, youtubeVideoId: e.target.value || null })
                  }
                  placeholder="e.g. dQw4w9WgXcQ or https://youtube.com/watch?v=..."
                  className="mt-1.5"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  If provided, the announcement notification will include a YouTube
                  thumbnail (auto-fetched or custom).
                </p>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="border-t border-border px-6 py-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={create.isPending || update.isPending}
              className="gap-1.5 bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]"
            >
              {editingId ? "Save changes" : "Create announcement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

function ManualSendCard({
  title,
  icon,
  description,
  onSend,
  pending,
}: {
  title: string;
  icon: string;
  description: string;
  onSend: () => Promise<void>;
  pending: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-4">
      <p className="flex items-center gap-2 font-semibold">
        <span className="text-xl">{icon}</span> {title}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <Button
        size="sm"
        variant="outline"
        className="mt-3 gap-1 text-xs"
        onClick={() => void onSend()}
        disabled={pending}
      >
        <Send className="h-3 w-3" /> Send
      </Button>
    </div>
  );
}
