import { useState } from "react";
import {
  Globe, Youtube, Twitch, Instagram, Plus, Edit2, Trash2, Play, Pause,
  Shield, Loader2, Users,
} from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { hasAtLeastRole } from "@contracts/constants";
import type { Role } from "@contracts/constants";

const PLATFORM_OPTIONS = [
  { value: "youtube", label: "YouTube", icon: Youtube },
  { value: "twitch", label: "Twitch", icon: Twitch },
  { value: "instagram", label: "Instagram", icon: Instagram },
  { value: "discord", label: "Discord", icon: Globe },
  { value: "kick", label: "Kick (maps to Other)", icon: Globe },
  { value: "facebook", label: "Facebook (maps to Other)", icon: Globe },
  { value: "other", label: "Other", icon: Globe },
];

const BUILTIN_ROLES: { value: string; label: string }[] = [
  { value: "fan", label: "Fan" },
  { value: "player", label: "Player" },
  { value: "moderator", label: "Moderator" },
  { value: "admin", label: "Admin" },
];

function PlatformIcon({ platform }: { platform: string }) {
  const Icon = PLATFORM_OPTIONS.find((p) => p.value === platform)?.icon ?? Globe;
  return <Icon className="h-4 w-4" />;
}

type LiveLink = {
  id: number;
  userId: number;
  userName?: string | null;
  userUsername?: string | null;
  userRole?: string | null;
  playerId?: number | null;
  ign?: string | null;
  teamId?: number | null;
  teamName?: string | null;
  ownershipType: "personal" | "team";
  platform: string;
  displayPlatform: string | null;
  liveUrl: string;
  isLive: boolean;
  isManuallyLive: boolean;
  title: string | null;
  description: string | null;
  viewerCount: number;
  thumbnailKey: string | null;
  thumbnailUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export default function LiveChannels() {
  const { user, role } = useAuth();
  const utils = trpc.useUtils();

  const { data: enabledRolesData, isLoading: rolesLoading } = trpc.public.getLiveSectionEnabledRoles.useQuery();
  const enabledRoles = enabledRolesData?.enabledRoles ?? ["player"];
  const canAccess = !!user && (hasAtLeastRole(user.role, role as Role) || enabledRoles.includes(user.role ?? ""));

  const { data: customRoles } = trpc.admin.listRoles.useQuery(undefined, {
    enabled: hasAtLeastRole(role, "moderator"),
  });

  const { data: teamsData } = trpc.public.teams.useQuery();
  const teams = teamsData ?? [];

  const { data: linksData, isLoading: linksLoading } = trpc.liveLinks.adminList.useQuery(
    {},
    { enabled: hasAtLeastRole(role, "moderator") },
  );
  const links = (linksData ?? []) as LiveLink[];

  const { data: myLinksData, isLoading: myLinksLoading } = trpc.liveLinks.getMyLinks.useQuery(
    undefined,
    { enabled: !!user && !hasAtLeastRole(role, "moderator") },
  );
  const myLinks = (myLinksData ?? []) as LiveLink[];

  const [showFormDialog, setShowFormDialog] = useState(false);
  const [editingLink, setEditingLink] = useState<LiveLink | null>(null);
  const [form, setForm] = useState({
    ownershipType: "personal" as "personal" | "team",
    teamId: undefined as number | undefined,
    platform: "youtube",
    displayPlatform: "",
    liveUrl: "",
    title: "",
    description: "",
    isLive: true,
  });

  const saveRolesMutation = trpc.admin.updateLiveSectionEnabledRoles.useMutation({
    onSuccess: () => {
      utils.public.getLiveSectionEnabledRoles.invalidate();
      toast.success("Live section access updated.");
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const createMutation = trpc.liveLinks.create.useMutation({
    onSuccess: () => {
      utils.liveLinks.adminList?.invalidate();
      utils.liveLinks.getMyLinks?.invalidate();
      toast.success("Channel saved.");
      setShowFormDialog(false);
      resetForm();
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const updateMutation = trpc.liveLinks.update.useMutation({
    onSuccess: () => {
      utils.liveLinks.adminList?.invalidate();
      utils.liveLinks.getMyLinks?.invalidate();
      toast.success("Channel updated.");
      setShowFormDialog(false);
      setEditingLink(null);
      resetForm();
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const deleteMutation = trpc.liveLinks.delete.useMutation({
    onSuccess: () => {
      utils.liveLinks.adminList?.invalidate();
      utils.liveLinks.getMyLinks?.invalidate();
      toast.success("Channel removed.");
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const toggleMutation = trpc.liveLinks.update.useMutation({
    onSuccess: () => {
      utils.liveLinks.adminList?.invalidate();
      utils.liveLinks.getMyLinks?.invalidate();
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  function resetForm() {
    setForm({
      ownershipType: "personal",
      teamId: undefined,
      platform: "youtube",
      displayPlatform: "",
      liveUrl: "",
      title: "",
      description: "",
      isLive: true,
    });
  }

  function handleEdit(link: LiveLink) {
    setEditingLink(link);
    setForm({
      ownershipType: link.ownershipType,
      teamId: link.teamId ?? undefined,
      platform: (link.platform === "other" && link.displayPlatform ? link.displayPlatform : link.platform) as "youtube" | "instagram" | "twitch" | "discord" | "kick" | "facebook" | "other",
      displayPlatform: link.displayPlatform ?? "",
      liveUrl: link.liveUrl,
      title: link.title ?? "",
      description: link.description ?? "",
      isLive: link.isLive,
    });
    setShowFormDialog(true);
  }

  function handleSubmit() {
    if (!form.liveUrl.trim()) {
      toast.error("A URL is required.");
      return;
    }

    const payload = {
      ownershipType: form.ownershipType,
      teamId: form.ownershipType === "team" ? form.teamId : undefined,
      platform: form.platform as "youtube" | "instagram" | "twitch" | "discord" | "kick" | "facebook" | "other",
      displayPlatform: form.platform === "kick" || form.platform === "facebook" ? form.platform : (form.displayPlatform || undefined),
      liveUrl: form.liveUrl.trim(),
      title: form.title.trim() || undefined,
      description: form.description.trim() || undefined,
      isLive: form.isLive,
    };

    if (editingLink) {
      updateMutation.mutate({ id: editingLink.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function handleRoleToggle(roleSlug: string) {
    const current = new Set(enabledRoles);
    if (current.has(roleSlug)) {
      current.delete(roleSlug);
    } else {
      current.add(roleSlug);
    }
    saveRolesMutation.mutate({ enabledRoles: Array.from(current) });
  }

  function handleDelete(link: LiveLink) {
    if (confirm("Remove this channel?")) {
      deleteMutation.mutate({ id: link.id });
    }
  }

  function handleToggleLive(link: LiveLink) {
    toggleMutation.mutate({
      id: link.id,
      isLive: !link.isLive,
    });
  }

  const allRoles = [
    ...BUILTIN_ROLES,
    ...(customRoles ?? []).filter((r) => !r.isBuiltIn).map((r) => ({ value: r.slug, label: r.name })),
  ];

  if (rolesLoading) {
    return (
      <AdminLayout title="Live Channels">
        <p className="text-muted-foreground">Loading...</p>
      </AdminLayout>
    );
  }

  if (!canAccess) {
    return (
      <AdminLayout title="Live Channels">
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 text-center">
          <Shield className="h-12 w-12 text-muted-foreground" />
          <div>
            <h2 className="font-display text-xl font-bold">Access Restricted</h2>
            <p className="text-sm text-muted-foreground">
              You don't have permission to view this section. Contact an admin.
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const visibleLinks = hasAtLeastRole(role, "moderator") ? links : myLinks;
  const isLoading = hasAtLeastRole(role, "moderator") ? linksLoading : myLinksLoading;
  const isAdmin = hasAtLeastRole(role, "admin");

  return (
    <AdminLayout title="Live Channels">
      <div className="space-y-6">
        {/* Role Access Configuration (Admin only) */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Role Access</CardTitle>
              <CardDescription>
                Grant or revoke access to the Live Channels section for each role.
                Roles not checked cannot view or manage live channels.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                {allRoles.map((r) => (
                  <div key={r.value} className="flex items-center gap-2">
                    <Switch
                      checked={enabledRoles.includes(r.value)}
                      onCheckedChange={() => handleRoleToggle(r.value)}
                      disabled={r.value === "admin" || saveRolesMutation.isPending}
                    />
                    <Label className="text-sm">{r.label}</Label>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Admin always has access.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Channel List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{hasAtLeastRole(role, "moderator") ? "All Live Channels" : "My Live Channels"}</CardTitle>
              <Button size="sm" onClick={() => { resetForm(); setEditingLink(null); setShowFormDialog(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Add Channel
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : visibleLinks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No live channels yet. Click the + button to add one.
              </p>
            ) : (
              <div className="space-y-3">
                {visibleLinks.map((link) => (
                  <div
                    key={link.id}
                    className={`flex items-center gap-3 rounded-lg border p-3 ${
                      link.isLive ? "border-red-500/30 bg-red-500/5" : "border-border bg-background/40"
                    }`}
                  >
                    <div className="flex-shrink-0">
                      {link.thumbnailUrl ? (
                        <img src={link.thumbnailUrl} alt={link.title ?? "channel"} className="h-10 w-10 rounded object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                          <PlatformIcon platform={link.displayPlatform ?? link.platform} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{link.title || "Untitled Channel"}</span>
                        {link.isLive && (
                          <Badge variant="destructive" className="text-xs">
                            LIVE
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {link.displayPlatform ?? link.platform}
                        {link.ownershipType === "team" && link.teamName && (
                          <>
                            {" "}
                            • <Users className="h-3 w-3 inline" /> {link.teamName}
                          </>
                        )}
                        {link.ign && <span> • Player: {link.ign}</span>}
                      </div>
                      <a
                        href={link.liveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-foreground truncate block"
                      >
                        {link.liveUrl}
                      </a>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => handleToggleLive(link)}
                        title={link.isLive ? "Set offline" : "Set live"}
                      >
                        {link.isLive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      {hasAtLeastRole(role, "moderator") && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(link)} title="Edit">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(link)} title="Delete" className="text-red-500">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Channel Form Dialog */}
      <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingLink ? "Edit Channel" : "Add New Channel"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Channel Type</Label>
              <Select
                value={form.ownershipType}
                onValueChange={(v: "personal" | "team") => {
                  setForm({ ...form, ownershipType: v, teamId: undefined });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal Channel</SelectItem>
                  <SelectItem value="team">Team Channel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.ownershipType === "team" && (
              <div>
                <Label>Team</Label>
                <Select
                  value={form.teamId?.toString() ?? ""}
                  onValueChange={(v) => setForm({ ...form, teamId: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams
                      .map((t) => (
                        <SelectItem key={t.id} value={t.id.toString()}>
                          {t.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Platform</Label>
              <Select
                value={form.platform}
                onValueChange={(v) => setForm({ ...form, platform: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORM_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <div className="flex items-center gap-2">
                        <p.icon className="h-4 w-4" />
                        <span>{p.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Kick and Facebook are stored as "Other" internally and mapped to the displayPlatform.
              </p>
            </div>

            <div>
              <Label>Live URL</Label>
              <Input
                type="url"
                placeholder="https://..."
                value={form.liveUrl}
                onChange={(e) => setForm({ ...form, liveUrl: e.target.value })}
              />
            </div>

            <div>
              <Label>Title (optional)</Label>
              <Input
                placeholder="Channel title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div>
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="Channel description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.isLive}
                onCheckedChange={(v) => setForm({ ...form, isLive: v })}
              />
              <Label>Set as live now</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFormDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editingLink ? "Update" : "Create"} Channel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
