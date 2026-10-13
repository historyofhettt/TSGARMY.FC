import { useState } from "react";
import {
  Check, X, Trash2,
  Radio, Edit, Plus,
} from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/format";

type Tab = "reports" | "live-links" | "rules" | "logs";

export default function CommunityManager() {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<Tab>("reports");  const { data: reports, isLoading: reportsLoading } = trpc.admin.listCommentReports.useQuery();
  const { data: liveLinks, isLoading: linksLoading } = trpc.admin.listLiveLinks.useQuery();
  const { data: rulesData, isLoading: rulesLoading } = trpc.admin.listNotificationRules.useQuery();
  const { data: ruleLogs, isLoading: logsLoading } = trpc.admin.listNotificationRuleLogs.useQuery();

  const resolveReport = trpc.admin.resolveCommentReport.useMutation({
    onSuccess: () => { toast.success("Report resolved."); utils.admin.listCommentReports.invalidate(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const deleteRule = trpc.admin.deleteNotificationRule.useMutation({
    onSuccess: () => { toast.success("Rule deleted."); utils.admin.listNotificationRules.invalidate(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  return (
    <AdminLayout title="Community Manager" minRole="moderator">
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="space-y-4">
        <TabsList className="glass">
          <TabsTrigger value="reports">Comment Reports ({reports?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="live-links">Live Links ({liveLinks?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="rules">Notification Rules ({rulesData?.rules?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="logs">Rule Logs ({ruleLogs?.length ?? 0})</TabsTrigger>
        </TabsList>

        {/* ----------------------- Comment Reports ----------------------- */}
        <TabsContent value="reports">
          <ReportsSection
            reports={reports}
            loading={reportsLoading}
            onResolve={(id, action) => resolveReport.mutate({ id, action })}
          />
        </TabsContent>

        {/* ----------------------- Live Links ----------------------- */}
        <TabsContent value="live-links">
          <LiveLinksSection links={liveLinks} loading={linksLoading} />
        </TabsContent>

        {/* ----------------------- Notification Rules ----------------------- */}
        <TabsContent value="rules">
          <NotificationRulesSection
            rules={rulesData?.rules}
            types={rulesData?.notificationTypes}
            loading={rulesLoading}
            onDelete={(id) => deleteRule.mutate({ id })}
          />
        </TabsContent>

        {/* ----------------------- Rule Logs ----------------------- */}
        <TabsContent value="logs">
          <RuleLogsSection logs={ruleLogs} loading={logsLoading} />
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}

// ============================================================================
// Comment Reports Section
// ============================================================================

type Report = {
  id: number;
  commentId: number;
  commentContent: string | null;
  commentUserId: number | null;
  reporterId: number;
  reporterName: string | null;
  commentReporterName: string | null;
  commentReporterUsername: string | null;
  reason: string;
  customReason: string | null;
  status: string;
  createdAt: Date;
};

type ReportsSectionProps = {
  reports: Report[] | undefined;
  loading: boolean;
  onResolve: (id: number, action: "resolve" | "dismiss" | "delete_comment") => void;
};

const REASON_LABELS: Record<string, string> = {
  spam: "Spam",
  harassment: "Harassment",
  inappropriate: "Inappropriate",
  offtopic: "Off-topic",
  other: "Other",
};

function ReportsSection({ reports, loading, onResolve }: ReportsSectionProps) {
  if (loading) return <p className="text-muted-foreground">Loading reports...</p>;
  if (!reports || reports.length === 0) {
    return <p className="glass rounded-xl p-10 text-center text-sm text-muted-foreground">No reports pending.</p>;
  }

  const pending = reports.filter((r) => r.status === "pending");
  const resolved = reports.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold uppercase text-muted-foreground">
        Pending ({pending.length})
      </h3>
      {pending.map((r) => (
        <ReportCard key={r.id} report={r} onResolve={onResolve} />
      ))}

      {resolved.length > 0 && (
        <>
          <h3 className="text-sm font-semibold uppercase text-muted-foreground">
            History ({resolved.length})
          </h3>
          {resolved.map((r) => (
            <ReportCard key={r.id} report={r} onResolve={onResolve} />
          ))}
        </>
      )}
    </div>
  );
}

function ReportCard({ report, onResolve }: { report: Report; onResolve: (id: number, action: "resolve" | "dismiss" | "delete_comment") => void }) {
  const reasonLabel = REASON_LABELS[report.reason] ?? report.reason;
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant={report.status === "pending" ? "default" : "secondary"}>
          {report.status}
        </Badge>
          <span className="font-semibold text-foreground">{report.commentReporterName ?? "Anonymous"}</span>
        <span>reported a comment</span>
        <Badge variant="outline">{reasonLabel}</Badge>
        <span>{timeAgo(report.createdAt)}</span>
      </div>
      {report.customReason && (
        <p className="mt-2 text-sm italic">"{report.customReason}"</p>
      )}
      <p className="mt-2 text-sm">{report.commentContent}</p>
      <div className="mt-3 flex gap-1.5">
        <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => onResolve(report.id, "resolve")}>
          <Check className="h-3 w-3" /> Resolve
        </Button>
        <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => onResolve(report.id, "dismiss")}>
          <X className="h-3 w-3" /> Dismiss
        </Button>
        <ConfirmDialog
          trigger={
            <Button size="sm" variant="outline" className="gap-1 text-xs">
              <Trash2 className="h-3 w-3 text-[hsl(var(--tsg-red))]" /> Delete Comment
            </Button>
          }
          title="Delete this comment?"
          description="This cannot be undone."
          onConfirm={() => onResolve(report.id, "delete_comment")}
          confirmLabel="Delete"
        />
      </div>
    </div>
  );
}

// ============================================================================
// Live Links Section
// ============================================================================

type LiveLinkAdmin = {
  id: number;
  userId: number;
  userName: string | null;
  userUsername: string | null;
  userRole: string | null;
  playerId: number | null;
  ign: string | null;
  teamId: number | null;
  teamName: string | null;
  ownershipType: "personal" | "team";
  platform: string;
  displayPlatform: string | null;
  liveUrl: string;
  isLive: boolean;
  title: string | null;
  viewerCount: number;
  thumbnailKey: string | null;
  thumbnailUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};function LiveLinksSection({ links, loading }: {
   links: LiveLinkAdmin[] | undefined;
  loading: boolean;
}) {
  const utils = trpc.useUtils();
  const testNotification = trpc.liveLinks.adminTestNotification.useMutation({
    onSuccess: (data) => {
      toast.success(`Test notification triggered. ${data.delivered} delivered.`);
      utils.liveLinks.adminList?.invalidate();
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const handleTest = (link: LiveLinkAdmin) => {
    if (confirm("Send test notification for this live channel?")) {
      testNotification.mutate({ liveLinkId: link.id });
    }
  };

  if (loading) return <p className="text-muted-foreground">Loading live links...</p>;
  if (!links || links.length === 0) {
    return <p className="glass rounded-xl p-10 text-center text-sm text-muted-foreground">No live links yet.</p>;
  }

  return (
    <div className="space-y-3">
      {links.map((l) => (
        <div key={l.id} className="glass rounded-xl p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={l.isLive ? "default" : "secondary"}>
              {l.isLive ? "Live" : "Offline"}
            </Badge>
            <span className="font-semibold text-foreground">{l.userName ?? l.userUsername ?? "User"}</span>
            <Badge variant="outline">{l.displayPlatform ?? l.platform}</Badge>
            {l.ownershipType === "team" && l.teamName && (
              <>
                <Badge variant="outline">Team: {l.teamName}</Badge>
              </>
            )}
            {l.isLive && <span className="flex items-center gap-1"><Radio className="h-3 w-3 fill-red-500" /> {l.viewerCount} viewers</span>}
            <span>{timeAgo(l.createdAt)}</span>
          </div>
          {l.title && <p className="mt-1 font-medium">{l.title}</p>}
          <a
            href={l.liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block text-sm text-[hsl(var(--tsg-blue))] break-all"
          >
            {l.liveUrl}
          </a>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleTest(l)}
              disabled={testNotification.isPending}
            >
              Test Notification
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Notification Rules Section
// ============================================================================

type NotificationRuleRow = {
  id: number;
  name: string;
  description: string | null;
  notificationTypeId: number;
  notificationTypeName: string | null;
  platform: string;
  triggerRole: string;
  ownershipType: string;
  targetType: string;
  targetRole: string | null;
  targetTeamId: number | null;
  targetUserIds: string | null;
  titleTemplate: string | null;
  messageTemplate: string | null;
  buttonText: string | null;
  linkLabel: string | null;
  emoji: string | null;
  cooldownMinutes: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type NotificationTypeRow = {
  id: number;
  slug: string;
  name: string;
  icon: string | null;
  description: string | null;
  isActive: boolean;
  isAutomatic: boolean;
  defaultTemplateId: number | null;
  titleTemplate: string | null;
  messageTemplate: string | null;
  imageKey: string | null;
  priority: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  buttonStyle: string | null;
  buttonIcon: string | null;
  youtubeEnabled: boolean;
  youtubeAutoThumbnail: boolean;
  youtubeCustomThumbnailKey: string | null;
  layout: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function NotificationRulesSection({
  rules,
  types,
  loading,
  onDelete,
}: {
  rules: NotificationRuleRow[] | undefined;
  types: NotificationTypeRow[] | undefined;
  loading: boolean;
  onDelete: (id: number) => void;
}) {
  const [editingRule, setEditingRule] = useState<NotificationRuleRow | null>(null);
  const [showNew, setShowNew] = useState(false);
  const utils2 = trpc.useUtils();
  const toggleActive = trpc.admin.updateNotificationRule.useMutation({
    onSuccess: () => {
      utils2.admin.listNotificationRules.invalidate();
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const activeRule = editingRule ?? null;
  const showingForm = showNew || !!activeRule;

  if (loading) return <p className="text-muted-foreground">Loading rules...</p>;

  const existing = rules ?? [];

  const handleToggleActive = (rule: NotificationRuleRow) => {
    toggleActive.mutate({
      id: rule.id,
      name: rule.name,
      description: rule.description ?? null,
      notificationTypeId: rule.notificationTypeId,
      platform: rule.platform as "youtube" | "instagram" | "twitch" | "kick" | "facebook" | "other" | "any",
      triggerRole: rule.triggerRole as "player" | "co-owner" | "owner" | "staff" | "any",
      ownershipType: rule.ownershipType as "personal" | "team" | "any",
      targetType: rule.targetType as "everyone" | "role" | "users" | "followers" | "team",
      targetRole: rule.targetRole ?? null,
      targetTeamId: rule.targetTeamId ?? null,
      targetUserIds: rule.targetUserIds ? JSON.parse(rule.targetUserIds) : undefined,
      titleTemplate: rule.titleTemplate ?? null,
      messageTemplate: rule.messageTemplate ?? null,
      buttonText: rule.buttonText ?? null,
      linkLabel: rule.linkLabel ?? null,
      emoji: rule.emoji ?? null,
      cooldownMinutes: rule.cooldownMinutes,
      isActive: !rule.isActive,
    });
  };

  const handleEdit = (rule: NotificationRuleRow) => {
    setEditingRule(rule);
    setShowNew(false);
  };

  const handleCloseForm = () => {
    setShowNew(false);
    setEditingRule(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <Button size="sm" variant="outline" className="gap-1" onClick={() => { setShowNew(true); setEditingRule(null); }}>
          <Plus className="h-3 w-3" /> New Rule
        </Button>
      </div>

      {showingForm && (
        <RuleForm
          types={types}
          existing={activeRule}
          onSave={handleCloseForm}
          onCancel={handleCloseForm}
        />
      )}

      {existing.map((rule) => (
        <Card key={rule.id} className="glass">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">{rule.name}</CardTitle>
              <div className="flex items-center gap-2">
                <Switch
                  checked={rule.isActive}
                  onCheckedChange={() => handleToggleActive(rule)}
                />
                <Badge variant={rule.isActive ? "default" : "secondary"}>
                  {rule.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
            <CardDescription className="text-xs">
              {rule.notificationTypeName} · Platform: {rule.platform} · Trigger: {rule.triggerRole}
              {" · Ownership: " + rule.ownershipType}
              {" · Target: " + rule.targetType}
              {rule.targetRole && " (role=" + rule.targetRole + ")"}
              {rule.targetTeamId && " (team=" + rule.targetTeamId + ")"}
              {" · Cooldown: " + rule.cooldownMinutes + " min"}
            </CardDescription>
          </CardHeader>
          {rule.description && (
            <CardContent className="pt-0 text-sm text-muted-foreground">{rule.description}</CardContent>
          )}
          <CardContent className="flex gap-1.5 pt-0">
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-xs"
              onClick={() => handleEdit(rule)}
            >
              <Edit className="h-3 w-3" /> Edit
            </Button>
            <ConfirmDialog
              trigger={
                <Button size="sm" variant="outline" className="gap-1 text-xs">
                  <Trash2 className="h-3 w-3 text-[hsl(var(--tsg-red))]" /> Delete
                </Button>
              }
              title="Delete notification rule?"
              description="This cannot be undone."
              onConfirm={() => onDelete(rule.id)}
              confirmLabel="Delete"
            />
          </CardContent>
        </Card>
      ))}

      {existing.length === 0 && (
        <p className="text-sm text-muted-foreground">No notification rules configured.</p>
      )}
    </div>
  );
}

function RuleForm({ types, existing, onSave, onCancel }: {
  types: NotificationTypeRow[] | undefined;
  existing: NotificationRuleRow | null;
  onSave: () => void;
  onCancel: () => void;
}) {
  const isEdit = !!existing;
  const update = trpc.admin.updateNotificationRule.useMutation({
    onSuccess: () => { toast.success("Rule updated."); onSave(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });
  const create = trpc.admin.createNotificationRule.useMutation({
    onSuccess: () => { toast.success("Rule created."); onSave(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const [preview, setPreview] = useState<{ title: string; message: string } | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const targetUserIdsRaw = data.get("targetUserIds")?.toString().trim();
    const targetUserIds = targetUserIdsRaw
      ? targetUserIdsRaw.split(",").map((s: string) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n))
      : undefined;

    const payload = {
      name: data.get("name")?.toString() ?? "",
      description: data.get("description")?.toString() || null,
      notificationTypeId: parseInt(data.get("notificationTypeId")?.toString() ?? "0", 10),
      platform: (data.get("platform")?.toString() ?? "any") as "youtube" | "instagram" | "twitch" | "kick" | "facebook" | "other" | "any",
      triggerRole: (data.get("triggerRole")?.toString() ?? "any") as "player" | "co-owner" | "owner" | "staff" | "any",
      ownershipType: (data.get("ownershipType")?.toString() ?? "any") as "personal" | "team" | "any",
      targetType: (data.get("targetType")?.toString() ?? "everyone") as "everyone" | "role" | "users" | "followers" | "team",
      targetRole: data.get("targetRole")?.toString() || null,
      targetTeamId: data.get("targetTeamId") ? parseInt(data.get("targetTeamId")?.toString() ?? "0", 10) : null,
      targetUserIds,
      titleTemplate: data.get("titleTemplate")?.toString() || null,
      messageTemplate: data.get("messageTemplate")?.toString() || null,
      buttonText: data.get("buttonText")?.toString() || null,
      linkLabel: data.get("linkLabel")?.toString() || null,
      emoji: data.get("emoji")?.toString() || null,
      cooldownMinutes: parseInt(data.get("cooldownMinutes")?.toString() ?? "30", 10),
      isActive: data.get("isActive") === "on",
    };

    if (isEdit && existing) {
      update.mutate({ id: existing.id, ...payload });
    } else {
      create.mutate(payload);
    }
  };

  const handlePreview = () => {
    const form = document.querySelector("form") as HTMLFormElement | null;
    if (!form) return;
    const data = new FormData(form);
    const title = data.get("titleTemplate")?.toString() ?? "New Live Stream";
    const message = data.get("messageTemplate")?.toString() ?? "{{playerName}} is now live!";
    setPreview({ title, message });
  };

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-sm font-medium">{isEdit ? "Edit Rule" : "New Rule"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid gap-2">
            <Label>Name *</Label>
            <Input name="name" placeholder="e.g. 'Notify on Player Live Streams'" defaultValue={existing?.name} required />
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea name="description" placeholder="What this rule does..." defaultValue={existing?.description ?? ""} />
          </div>
          <div className="grid gap-2">
            <Label>Notification Type *</Label>
            <Select name="notificationTypeId" defaultValue={existing?.notificationTypeId.toString()} required>
              <SelectTrigger><SelectValue placeholder="Select a type" /></SelectTrigger>
              <SelectContent>
                {types?.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.name} ({t.slug})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Platform</Label>
              <Select name="platform" defaultValue={existing?.platform ?? "any"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="twitch">Twitch</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="kick">Kick</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Trigger Role</Label>
              <Select name="triggerRole" defaultValue={existing?.triggerRole ?? "any"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Role</SelectItem>
                  <SelectItem value="player">Player</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="co-owner">Co-Owner</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Ownership Type</Label>
              <Select name="ownershipType" defaultValue={existing?.ownershipType ?? "any"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="personal">Personal Only</SelectItem>
                  <SelectItem value="team">Team Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Target Type</Label>
              <Select name="targetType" defaultValue={existing?.targetType ?? "everyone"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="everyone">Everyone</SelectItem>
                  <SelectItem value="role">Role</SelectItem>
                  <SelectItem value="users">Specific Users</SelectItem>
                  <SelectItem value="followers">Followers</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Target Role (if role-based)</Label>
            <Input name="targetRole" placeholder="e.g. player, moderator, admin" defaultValue={existing?.targetRole ?? ""} />
          </div>
          <div className="grid gap-2">
            <Label>Target Team ID (if team-targeted)</Label>
            <Input name="targetTeamId" type="number" min="1" placeholder="e.g. 1 for TSG ARMY" defaultValue={existing?.targetTeamId?.toString() ?? ""} />
          </div>
          <div className="grid gap-2">
            <Label>Target User IDs (comma-separated, if user-based)</Label>
            <Input name="targetUserIds" placeholder="e.g. 1, 5, 12" defaultValue={existing?.targetUserIds ?? ""} />
          </div>
          <div className="space-y-2">
            <Label>Message Templates</Label>
            <Input name="titleTemplate" placeholder="Title template ({{playerName}}, {{platform}}, {{teamName}})" defaultValue={existing?.titleTemplate ?? ""} />
            <Textarea name="messageTemplate" placeholder="Message template" defaultValue={existing?.messageTemplate ?? ""} rows={3} />
            <div className="grid grid-cols-2 gap-3">
              <Input name="buttonText" placeholder="Button text" defaultValue={existing?.buttonText ?? ""} />
              <Input name="linkLabel" placeholder="Link label" defaultValue={existing?.linkLabel ?? ""} />
              <Input name="emoji" placeholder="Emoji (e.g. 🔴)" defaultValue={existing?.emoji ?? ""} />
            </div>
            <Button type="button" size="sm" variant="outline" className="gap-1" onClick={handlePreview}>
              Preview
            </Button>
            {preview && (
              <div className="rounded border border-border p-3 text-xs">
                <strong className="block">Title:</strong> {preview.title}
                <br />
                <strong className="block">Message:</strong> {preview.message}
                <br />
                Available placeholders: {JSON.stringify({ playerName: "Stream name", platform: "Platform", teamName: "Team name (if team)" })}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cooldown (minutes)</Label>
              <Input name="cooldownMinutes" type="number" min="1" max="1440" defaultValue={existing?.cooldownMinutes.toString() ?? "30"} />
            </div>
            <div className="flex items-center gap-2">
              <Switch name="isActive" id="isActive" defaultChecked={existing?.isActive ?? true} />
              <Label htmlFor="isActive" className="text-sm">Active</Label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" size="sm" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={create.isPending || update.isPending}>
              {isEdit ? "Update Rule" : "Create Rule"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Rule Logs Section
// ============================================================================

type RuleLog = {
  id: number;
  ruleId: number;
  ruleName: string | null;
  liveLinkId: number;
  triggeredAt: Date;
  deliveredCount: number;
  skipped: boolean;
  skipReason: string | null;
  createdAt: Date;
};

function RuleLogsSection({ logs, loading }: { logs: RuleLog[] | undefined; loading: boolean }) {
  if (loading) return <p className="text-muted-foreground">Loading logs...</p>;
  if (!logs || logs.length === 0) {
    return <p className="glass rounded-xl p-10 text-center text-sm text-muted-foreground">No rule logs yet.</p>;
  }

  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <div key={log.id} className="glass rounded-xl p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant={log.skipped ? "secondary" : "default"}>
              {log.skipped ? "Skipped" : "Delivered"} {log.deliveredCount > 0 && `(${log.deliveredCount})`}
            </Badge>
            <span className="font-semibold text-foreground">{log.ruleName ?? `Rule #${log.ruleId}`}</span>
            <span>Live link #{log.liveLinkId}</span>
            <span>{timeAgo(log.triggeredAt)}</span>
            {log.skipped && log.skipReason && (
              <span className="text-muted-foreground italic"> — {log.skipReason}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
