import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Copy,
  Eye,
  Send,
  Archive,
  RotateCcw,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

type Priority = "normal" | "important" | "urgent";
type Layout = "compact" | "card" | "banner";
type ButtonStyle = "primary" | "outline" | "ghost";

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "important", label: "Important" },
  { value: "urgent", label: "Urgent" },
];

const LAYOUT_OPTIONS: { value: Layout; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "card", label: "Card" },
  { value: "banner", label: "Banner" },
];

const EMPTY_FORM = {
  notificationTypeId: 0 as number,
  name: "",
  description: "" as string,
  titleTemplate: "",
  messageTemplate: "",
  imageKey: null as string | null,
  imageUrl: null as string | null,
  priority: "normal" as Priority,
  linkUrl: "" as string,
  linkLabel: "" as string,
  buttonStyle: "primary" as ButtonStyle,
  buttonIcon: "" as string,
  youtubeEnabled: false,
  youtubeAutoThumbnail: true,
  youtubeCustomThumbnailKey: null as string | null,
  youtubeCustomThumbnailUrl: null as string | null,
  layout: "compact" as Layout,
};

type TemplateForm = typeof EMPTY_FORM;

export default function NotificationTemplatesAdmin() {
  useEffect(() => {
    document.title = "Notification Templates | Admin";
  }, []);

  const utils = trpc.useUtils();
  const { data: types } = trpc.admin.listNotificationTypes.useQuery();
  const { data: templates, isLoading } = trpc.admin
    .listNotificationTemplates.useQuery({});

  const utilsTemplates = trpc.useUtils().admin.listNotificationTemplates;

  type TemplateItem = NonNullable<typeof templates>[number];

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TemplateForm>(EMPTY_FORM);

  const createTemplate = trpc.admin.createNotificationTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template created.");
      utilsTemplates.invalidate();
      setOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const updateTemplate = trpc.admin.updateNotificationTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template updated.");
      utilsTemplates.invalidate();
      setOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const archiveTemplate = trpc.admin.archiveNotificationTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template archived.");
      utilsTemplates.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const restoreTemplate = trpc.admin.restoreNotificationTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template restored.");
      utilsTemplates.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const duplicateTemplate = trpc.admin.duplicateNotificationTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template duplicated.");
      utilsTemplates.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const setDefaultTemplate = trpc.admin.setDefaultTemplate.useMutation({
    onSuccess: () => {
      toast.success("Default template updated.");
      utils.admin.listNotificationTypes.invalidate();
      utilsTemplates.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const sendTemplate = trpc.admin.sendTemplateNotification.useMutation({
    onSuccess: (res) => {
      toast.success(`Sent ${res.delivered} notification(s) to ${res.targetCount} recipients.`);
      utilsTemplates.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const previewTemplate = trpc.admin.previewNotificationTemplate.useMutation({
    onSuccess: (res) => {
      toast.message("Preview generated", {
        description: `${res.title} — ${res.message}`,
      });
    },
    onError: (e) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, notificationTypeId: types?.[0]?.id ?? 0 });
    setOpen(true);
  };

  const openEdit = (t: TemplateItem) => {
    setEditingId(t.id);
    setForm({
      notificationTypeId: t.notificationTypeId,
      name: t.name,
      description: t.description ?? "",
      titleTemplate: t.titleTemplate,
      messageTemplate: t.messageTemplate,
      imageKey: t.imageKey ?? null,
      imageUrl: t.imageUrl ?? null,
      priority: (t.priority ?? "normal") as Priority,
      linkUrl: t.linkUrl ?? "",
      linkLabel: t.linkLabel ?? "",
      buttonStyle: (t.buttonStyle ?? "primary") as ButtonStyle,
      buttonIcon: t.buttonIcon ?? "",
      youtubeEnabled: t.youtubeEnabled ?? false,
      youtubeAutoThumbnail: t.youtubeAutoThumbnail ?? true,
      youtubeCustomThumbnailKey: t.youtubeCustomThumbnailKey ?? null,
      youtubeCustomThumbnailUrl: null,
      layout: (t.layout ?? "compact") as Layout,
    });
    setOpen(true);
  };

  const save = async () => {
    const payload = {
      notificationTypeId: form.notificationTypeId,
      name: form.name,
      description: form.description || null,
      titleTemplate: form.titleTemplate,
      messageTemplate: form.messageTemplate,
      imageKey: form.imageKey ?? null,
      priority: form.priority,
      linkUrl: form.linkUrl || null,
      linkLabel: form.linkLabel || null,
      buttonStyle: form.buttonStyle,
      buttonIcon: form.buttonIcon || null,
      youtubeEnabled: form.youtubeEnabled,
      youtubeAutoThumbnail: form.youtubeAutoThumbnail,
      youtubeCustomThumbnailKey: form.youtubeCustomThumbnailKey ?? null,
      layout: form.layout,
    };

    if (editingId) {
      await updateTemplate.mutateAsync({ id: editingId, ...payload });
    } else {
      await createTemplate.mutateAsync(payload);
    }
  };

  const handleDuplicate = (t: TemplateItem) => {
    const name = window.prompt("New template name:", `${t.name} (copy)`);
    if (name && name.trim()) {
      void duplicateTemplate.mutateAsync({ id: t.id, name: name.trim() });
    }
  };

  const handleSend = (t: TemplateItem) => {
    void sendTemplate.mutateAsync({
      templateId: t.id,
      targetType: "everyone",
    });
  };

  const handlePreview = (t: TemplateItem) => {
    void previewTemplate.mutateAsync({
      id: t.id,
      placeholders: {
        playerName: "StreamPro",
        title: "Amazing Clutch!",
        actorName: "Gamer42",
        actionText: "liked",
        contentDesc: "your latest clutch",
      },
    });
  };

  const handleArchive = (t: TemplateItem) => {
    void archiveTemplate.mutateAsync({ id: t.id });
  };

  const handleRestore = (t: TemplateItem) => {
    void restoreTemplate.mutateAsync({ id: t.id });
  };

  const handleSetDefault = (t: TemplateItem) => {
    void setDefaultTemplate.mutate({ id: t.id });
  };

  return (
    <AdminLayout title="Notification Templates">
      <div className="mb-6 flex items-center justify-between">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Create and manage reusable notification templates. Templates define
          the title, message, image, link, button style, YouTube support, and
          layout for each notification type. Set a template as default for a
          type to use it automatically.
        </p>
        <Button
          onClick={openCreate}
          className="gap-1.5 bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]"
        >
          <Plus className="h-4 w-4" /> New Template
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (templates ?? []).length === 0 ? (
        <p className="glass rounded-xl p-10 text-center text-sm text-muted-foreground">
          No templates yet. Create your first template.
        </p>
      ) : (
        <div className="space-y-3">
          {(templates ?? []).map((t) => (
            <div key={t.id} className="glass rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-base font-bold">{t.name}</span>
                    {t.isDefault && (
                      <span className="rounded bg-[hsl(var(--tsg-blue)/0.15)] px-1.5 py-0.5 text-[10px] font-bold text-[hsl(var(--tsg-blue))]">
                        Default
                      </span>
                    )}
                    {t.isArchived && (
                      <span className="rounded bg-border px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                        Archived
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Type: {t.typeName} (/{t.typeSlug})
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {t.titleTemplate}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => handlePreview(t)}>
                    <Eye className="h-3 w-3" /> Preview
                  </Button>
                  {!t.isDefault && !t.isArchived && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSetDefault(t)}
                    >
                      Set Default
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => handleDuplicate(t)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleSend(t)}>
                    <Send className="h-3 w-3" />
                  </Button>
                  {!t.isArchived && (
                    <ConfirmDialog
                      trigger={
                        <Button size="sm" variant="outline" className="text-xs">
                          <Archive className="h-3 w-3" />
                        </Button>
                      }
                      title="Archive this template?"
                      description="Archived templates won't appear in new notifications."
                      onConfirm={() => handleArchive(t)}
                    />
                  )}
                  {t.isArchived && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRestore(t)}
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => openEdit(t)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong max-h-[90vh] w-full max-w-2xl border-border p-0">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle className="font-display text-lg font-bold">
              {editingId ? "Edit Template" : "New Template"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define a reusable notification template with customizable title,
              message, image, link, button style, YouTube thumbnail, and layout.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] px-6 py-4">
            <div className="space-y-4">
              <div>
                <Label>Notification Type</Label>
                <Select
                  value={String(form.notificationTypeId)}
                  onValueChange={(v) =>
                    setForm({ ...form, notificationTypeId: Number(v) })
                  }
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(types ?? []).map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.icon ?? "🔔"} {t.name} (/{t.slug})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Template Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Default Player Live"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label>Description (optional)</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  rows={2}
                  className="mt-1.5"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Title Template</Label>
                  <Input
                    value={form.titleTemplate}
                    onChange={(e) =>
                      setForm({ ...form, titleTemplate: e.target.value })
                    }
                    placeholder="e.g. {{playerName}} is live"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Message Template</Label>
                  <Input
                    value={form.messageTemplate}
                    onChange={(e) =>
                      setForm({ ...form, messageTemplate: e.target.value })
                    }
                    placeholder="e.g. Come watch {{playerName}} stream!"
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Priority</Label>
                  <Select
                    value={form.priority}
                    onValueChange={(v) =>
                      setForm({ ...form, priority: v as Priority })
                    }
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
                  <Label>Layout</Label>
                  <Select
                    value={form.layout}
                    onValueChange={(v) =>
                      setForm({ ...form, layout: v as Layout })
                    }
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LAYOUT_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Button Style</Label>
                  <Select
                    value={form.buttonStyle}
                    onValueChange={(v) =>
                      setForm({ ...form, buttonStyle: v as ButtonStyle })
                    }
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
                  <Label>Button Icon (optional)</Label>
                  <Input
                    value={form.buttonIcon}
                    onChange={(e) =>
                      setForm({ ...form, buttonIcon: e.target.value })
                    }
                    placeholder="e.g. Eye, ExternalLink"
                    className="mt-1.5"
                  />
                </div>
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
                  <Label>Link URL (optional)</Label>
                  <Input
                    value={form.linkUrl}
                    onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                    placeholder="https://..."
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Link Label (optional)</Label>
                  <Input
                    value={form.linkLabel}
                    onChange={(e) =>
                      setForm({ ...form, linkLabel: e.target.value })
                    }
                    placeholder="e.g. Watch Live"
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  <div>
                    <Label>YouTube Enabled</Label>
                    <p className="text-xs text-muted-foreground">
                      Extract YouTube thumbnail from link URLs automatically.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={form.youtubeEnabled}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, youtubeEnabled: checked })
                  }
                />
              </div>

              {form.youtubeEnabled && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      <Label>Auto Thumbnail</Label>
                    </div>
                    <Switch
                      checked={form.youtubeAutoThumbnail}
                      onCheckedChange={(checked) =>
                        setForm({ ...form, youtubeAutoThumbnail: checked })
                      }
                    />
                  </div>
                  {!form.youtubeAutoThumbnail && (
                    <div>
                      <Label>Custom YouTube Thumbnail</Label>
                      <div className="mt-1.5">
                        <ImageUpload
                          value={form.youtubeCustomThumbnailKey}
                          previewUrl={form.youtubeCustomThumbnailUrl}
                          category="other"
                          onUploaded={(key, url) =>
                            setForm({
                              ...form,
                              youtubeCustomThumbnailKey: key,
                              youtubeCustomThumbnailUrl: url,
                            })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter className="border-t border-border px-6 py-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={createTemplate.isPending || updateTemplate.isPending}
              className="gap-1.5 bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]"
            >
              {editingId ? "Save changes" : "Create template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
