import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, Zap, ZapOff, Paintbrush, Youtube, LayoutGrid } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { ImageUpload } from "@/components/admin/ImageUpload";
import type { NotificationTypeSlug } from "@contracts/constants";

const TYPE_ICONS: Record<string, string> = {
  admin_announcement: "📢",
  player_live: "🔴",
  clutch_highlight: "🎥",
  engagement: "❤️",
};

const TYPE_DESCRIPTIONS: Record<string, string> = {
  admin_announcement:
    "Official announcements from the TSG admin team. Supports rich messages, images, links, priorities, scheduling and audience targeting.",
  player_live:
    "Sent automatically when a player goes live on stream.",
  clutch_highlight:
    "Sent automatically when new clutch / highlight content is published.",
  engagement:
    "Sent automatically when someone likes, comments on, or replies to a user's content.",
};

const LAYOUT_OPTIONS: { value: string; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "card", label: "Card" },
  { value: "banner", label: "Banner" },
];

export default function NotificationTypesAdmin() {
  useEffect(() => {
    document.title = "Notification Types | Admin";
  }, []);

  const utils = trpc.useUtils();
  const { data: types, isLoading } = trpc.admin.listNotificationTypes.useQuery();

  const setActive = trpc.admin.setNotificationTypeActive.useMutation({
    onSuccess: () => {
      toast.success("Notification type updated.");
      utils.admin.listNotificationTypes.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const setAutomatic = trpc.admin.setNotificationTypeAutomatic.useMutation({
    onSuccess: () => {
      toast.success("Notification type updated.");
      utils.admin.listNotificationTypes.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const updateSettings = trpc.admin.updateNotificationTypeSettings.useMutation({
    onSuccess: () => {
      toast.success("Notification type settings updated.");
      utils.admin.listNotificationTypes.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const [editingType, setEditingType] = useState<{
    slug: string;
    name: string;
    description: string | null;
    titleTemplate: string | null;
    messageTemplate: string | null;
    imageKey: string | null;
    imageUrl: string | null;
    priority: "normal" | "important" | "urgent";
    linkUrl: string | null;
    linkLabel: string | null;
    buttonStyle: "primary" | "outline" | "ghost";
    buttonIcon: string | null;
    youtubeEnabled: boolean;
    youtubeAutoThumbnail: boolean;
    youtubeCustomThumbnailKey: string | null;
    youtubeCustomThumbnailUrl: string | null;
    layout: "compact" | "card" | "banner";
  } | null>(null);

  const openSettings = (t: NonNullable<typeof types>[number]) => {
    setEditingType({
      slug: t.slug,
      name: t.name,
      description: t.description ?? null,
      titleTemplate: t.titleTemplate ?? null,
      messageTemplate: t.messageTemplate ?? null,
      imageKey: t.imageKey ?? null,
      imageUrl: null,
      priority: (t.priority as "normal" | "important" | "urgent") ?? "normal",
      linkUrl: t.linkUrl ?? null,
      linkLabel: t.linkLabel ?? null,
      buttonStyle: (t.buttonStyle as "primary" | "outline" | "ghost") ?? "primary",
      buttonIcon: t.buttonIcon ?? null,
      youtubeEnabled: t.youtubeEnabled ?? false,
      youtubeAutoThumbnail: t.youtubeAutoThumbnail ?? true,
      youtubeCustomThumbnailKey: t.youtubeCustomThumbnailKey ?? null,
      youtubeCustomThumbnailUrl: null,
      layout: (t.layout as "compact" | "card" | "banner") ?? "compact",
    });
  };

  const saveSettings = async () => {
    if (!editingType) return;
    await updateSettings.mutateAsync({
      slug: editingType.slug,
      name: editingType.name,
      description: editingType.description,
      titleTemplate: editingType.titleTemplate,
      messageTemplate: editingType.messageTemplate,
      imageKey: editingType.imageKey,
      priority: editingType.priority,
      linkUrl: editingType.linkUrl,
      linkLabel: editingType.linkLabel,
      buttonStyle: editingType.buttonStyle,
      buttonIcon: editingType.buttonIcon,
      youtubeEnabled: editingType.youtubeEnabled,
      youtubeAutoThumbnail: editingType.youtubeAutoThumbnail,
      youtubeCustomThumbnailKey: editingType.youtubeCustomThumbnailKey,
      layout: editingType.layout,
    });
    setEditingType(null);
  };

  return (
    <AdminLayout title="Notification Types">
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        Manage the four notification types. Toggle <strong>Active</strong> to
        enable or disable delivery of a type — inactive types never send. Toggle{" "}
        <strong>Automatic</strong> to control whether the type is generated
        automatically by site events or only sent manually by an admin. Click
        "Edit Settings" to customize templates, images, links, button styles,
        YouTube thumbnails, and layout.
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(types ?? []).map((t) => {
            const slug = t.slug as NotificationTypeSlug;
            const icon = TYPE_ICONS[slug] ?? "🔔";
            return (
              <div
                key={t.id}
                className={`glass rounded-xl p-5 ${!t.isActive ? "opacity-70" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl leading-none">{icon}</span>
                    <div>
                      <p className="font-display text-base font-bold">{t.name}</p>
                      <p className="text-xs text-muted-foreground">/{slug}</p>
                    </div>
                  </div>
                  <Badge
                    variant={t.isActive ? "default" : "secondary"}
                    className={
                      t.isActive
                        ? "bg-[hsl(var(--tsg-blue)/0.15)] text-[hsl(var(--tsg-blue))]"
                        : ""
                    }
                  >
                    {t.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <p className="mt-3 text-sm text-muted-foreground">
                  {TYPE_DESCRIPTIONS[slug] ?? t.description}
                </p>

                <div className="mt-5 space-y-4 border-t border-border pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-semibold">
                        <Bell className="h-3.5 w-3.5" /> Active
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.isActive
                          ? "Notifications of this type are delivered."
                          : "Notifications of this type are blocked."}
                      </p>
                    </div>
                    <Switch
                      checked={t.isActive}
                      onCheckedChange={(checked) =>
                        setActive.mutate({ slug: t.slug, isActive: checked })
                      }
                      disabled={setActive.isPending}
                      aria-label={`Toggle ${t.name} active`}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-semibold">
                        {t.isAutomatic ? (
                          <Zap className="h-3.5 w-3.5" />
                        ) : (
                          <ZapOff className="h-3.5 w-3.5" />
                        )}
                        Automatic
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.isAutomatic
                          ? "Generated automatically by site events."
                          : "Sent manually by an admin only."}
                      </p>
                    </div>
                    <Switch
                      checked={t.isAutomatic}
                      onCheckedChange={(checked) =>
                        setAutomatic.mutate({ slug: t.slug, isAutomatic: checked })
                      }
                      disabled={setAutomatic.isPending}
                      aria-label={`Toggle ${t.name} automatic`}
                    />
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => openSettings(t)}
                  >
                    <Paintbrush className="h-3 w-3" /> Edit Settings
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Settings dialog */}
      <Dialog
        open={!!editingType}
        onOpenChange={(open) => {
          if (!open) setEditingType(null);
        }}
      >
        <DialogContent className="glass-strong max-h-[90vh] w-full max-w-3xl border-border p-0">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle className="font-display text-lg font-bold">
              Edit {editingType?.name ?? ""}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Customize the title/message templates, image, link, button styling,
              YouTube thumbnail, and layout for this notification type.
            </DialogDescription>
          </DialogHeader>
          {editingType && (
            <div className="grid gap-4 p-6">
              <div>
                <Label>Name</Label>
                <Input
                  value={editingType.name}
                  onChange={(e) =>
                    setEditingType({ ...editingType, name: e.target.value })
                  }
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={editingType.description ?? ""}
                  onChange={(e) =>
                    setEditingType({
                      ...editingType,
                      description: e.target.value || null,
                    })
                  }
                  rows={3}
                  className="mt-1.5"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Title Template</Label>
                  <Input
                    value={editingType.titleTemplate ?? ""}
                    onChange={(e) =>
                      setEditingType({
                        ...editingType,
                        titleTemplate: e.target.value || null,
                      })
                    }
                    placeholder="e.g. {{playerName}} is live"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Message Template</Label>
                  <Input
                    value={editingType.messageTemplate ?? ""}
                    onChange={(e) =>
                      setEditingType({
                        ...editingType,
                        messageTemplate: e.target.value || null,
                      })
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
                    value={editingType.priority}
                    onValueChange={(v) =>
                      setEditingType({
                        ...editingType,
                        priority: v as "normal" | "important" | "urgent",
                      })
                    }
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="important">Important</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Layout</Label>
                  <Select
                    value={editingType.layout}
                    onValueChange={(v) =>
                      setEditingType({
                        ...editingType,
                        layout: v as "compact" | "card" | "banner",
                      })
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

              <div>
                <Label>Button Style</Label>
                <Select
                  value={editingType.buttonStyle}
                  onValueChange={(v) =>
                    setEditingType({
                      ...editingType,
                      buttonStyle: v as "primary" | "outline" | "ghost",
                    })
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
                  value={editingType.buttonIcon ?? ""}
                  onChange={(e) =>
                    setEditingType({
                      ...editingType,
                      buttonIcon: e.target.value || null,
                    })
                  }
                  placeholder="e.g. Eye, ExternalLink"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label>Image (optional)</Label>
                <div className="mt-1.5">
                  <ImageUpload
                    value={editingType.imageKey}
                    previewUrl={editingType.imageUrl}
                    category="other"
                    onUploaded={(key, url) =>
                      setEditingType({
                        ...editingType,
                        imageKey: key,
                        imageUrl: url,
                      })
                    }
                  />
                </div>
              </div>

              <div>
                <Label>Link URL (optional)</Label>
                <Input
                  value={editingType.linkUrl ?? ""}
                  onChange={(e) =>
                    setEditingType({
                      ...editingType,
                      linkUrl: e.target.value || null,
                    })
                  }
                  placeholder="https://..."
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label>Link Label (optional)</Label>
                <Input
                  value={editingType.linkLabel ?? ""}
                  onChange={(e) =>
                    setEditingType({
                      ...editingType,
                      linkLabel: e.target.value || null,
                    })
                  }
                  placeholder="e.g. Watch Live"
                  className="mt-1.5"
                />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <Youtube className="h-4 w-4" />
                  <div>
                    <Label>YouTube Enabled</Label>
                    <p className="text-xs text-muted-foreground">
                      Extract YouTube thumbnail from link URLs automatically.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={editingType.youtubeEnabled}
                  onCheckedChange={(checked) =>
                    setEditingType({ ...editingType, youtubeEnabled: checked })
                  }
                />
              </div>

              {editingType.youtubeEnabled && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <LayoutGrid className="h-4 w-4" />
                      <Label>Auto Thumbnail</Label>
                    </div>
                    <Switch
                      checked={editingType.youtubeAutoThumbnail}
                      onCheckedChange={(checked) =>
                        setEditingType({
                          ...editingType,
                          youtubeAutoThumbnail: checked,
                        })
                      }
                    />
                  </div>
                  {!editingType.youtubeAutoThumbnail && (
                    <div>
                      <Label>Custom YouTube Thumbnail</Label>
                      <div className="mt-1.5">
                        <ImageUpload
                          value={editingType.youtubeCustomThumbnailKey}
                          previewUrl={editingType.youtubeCustomThumbnailUrl}
                          category="other"
                          onUploaded={(key, url) =>
                            setEditingType({
                              ...editingType,
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
          )}
          <DialogFooter className="border-t border-border px-6 py-4">
            <Button variant="outline" onClick={() => setEditingType(null)}>
              Cancel
            </Button>
            <Button
              onClick={saveSettings}
              disabled={updateSettings.isPending}
              className="gap-1.5 bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]"
            >
              Save settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
