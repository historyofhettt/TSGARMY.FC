import { useState } from "react";
import { Award, Calendar, User, Globe, Clock, CheckCircle, Package, XCircle } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { RouterOutputs } from "@contracts/types";

type Redemption = RouterOutputs["admin"]["listRewardRedemptions"][number];

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending", icon: Clock, color: "bg-yellow-500/20 text-yellow-400" },
  { value: "approved", label: "Approved", icon: CheckCircle, color: "bg-blue-500/20 text-blue-400" },
  { value: "processing", label: "Processing", icon: Package, color: "bg-purple-500/20 text-purple-400" },
  { value: "completed", label: "Completed", icon: CheckCircle, color: "bg-green-500/20 text-green-400" },
  { value: "rejected", label: "Rejected", icon: XCircle, color: "bg-red-500/20 text-red-400" },
];

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  processing: "Processing",
  completed: "Completed",
  rejected: "Rejected",
};

export default function RedemptionsAdmin() {
  const { role } = useAuth();
  const utils = trpc.useUtils();

  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "processing" | "completed" | "rejected" | null>(null);

  const { data: redemptions, isLoading, error } = trpc.admin.listRewardRedemptions.useQuery({
    category: categoryFilter ?? undefined,
    status: statusFilter ?? undefined,
    limit: 200,
  });

  const updateStatus = trpc.admin.updateRedemptionStatus.useMutation({
    onSuccess: () => {
      utils.admin.listRewardRedemptions.invalidate();
      toast.success("Redemption status updated.");
    },
    onError: (e: { message?: string }) => toast.error(e.message ?? "Error"),
  });

  const { data: categories } = trpc.admin.listFanRewards.useQuery(undefined, {
    select: (data) => [...new Set(data.map((r) => r.category))],
  });

  const [histOpen, setHistOpen] = useState(false);
  const [histRedemptionId, setHistRedemptionId] = useState<number | null>(null);

  const { data: history } = trpc.admin.getRedemptionHistory.useQuery(
    { redemptionId: histRedemptionId ?? 0 },
    { enabled: !!histRedemptionId && histRedemptionId > 0 },
  );

  if (!role || role !== "admin") {
    return (
      <AdminLayout title="Redemptions" minRole="admin">
        <p>Access denied. You must have admin permissions.</p>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout title="Redemptions" minRole="admin">
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
          <p className="font-medium">Failed to load redemptions</p>
          <p className="text-sm">{error.message}</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Redemptions" minRole="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Fan Rewards & Redemptions</h1>
            <p className="text-sm text-muted-foreground">
              Manage reward redemption requests. Redemptions are automatically grouped by reward category.
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={categoryFilter ?? "all"} onValueChange={(v) => setCategoryFilter(v === "all" ? null : v)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories?.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter ?? "all"} onValueChange={(v) => setStatusFilter(v === "all" ? null : (v as "pending" | "approved" | "processing" | "completed" | "rejected"))}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <p className="text-center text-muted-foreground py-10">Loading...</p>
        ) : !redemptions || redemptions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Award className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No redemptions found. Adjust your filters to see more.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupRedemptionsByCategory(redemptions).map(([cat, items]) => (
              <div key={cat} className="space-y-3">
                <h2 className="text-lg font-semibold border-b border-border pb-1">{cat}</h2>
                {items.map((r) => (
                  <RedemptionRow
                    key={r.id}
                    redemption={r}
                    onStatusChange={(status, notes) =>
                      updateStatus.mutate({ id: r.id, status, adminNotes: notes })
                    }
                    onViewHistory={() => {
                      setHistRedemptionId(r.id);
                      setHistOpen(true);
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        <Dialog open={histOpen} onOpenChange={setHistOpen}>
          <DialogContent className="glass-strong border-border max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Redemption History</DialogTitle>
            </DialogHeader>
            {history && history.length > 0 ? (
              <div className="space-y-3">
                {history.map((h) => (
                  <div key={h.id} className="border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">{STATUS_LABELS[h.status] ?? h.status}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(h.changedAt).toLocaleString()}
                      </span>
                    </div>
                    {h.adminName && <p className="text-xs text-muted-foreground mt-1">by {h.adminName}</p>}
                    {h.adminNotes && <p className="text-sm mt-1">{h.adminNotes}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No history available.</p>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

function groupRedemptionsByCategory(redemptions: Redemption[]) {
  const groups = new Map<string, Redemption[]>();
  for (const r of redemptions) {
    const cat = r.rewardCategory ?? "Uncategorized";
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(r);
  }
  return Array.from(groups.entries());
}

function RedemptionRow({
  redemption,
  onStatusChange,
  onViewHistory,
}: {
  redemption: Redemption;
   onStatusChange: (status: "pending" | "approved" | "processing" | "completed" | "rejected", notes: string | null) => void;
  onViewHistory: () => void;
}) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState("");

  const handleStatus = (status: string) => {
    if (status === "rejected") {
      setNotesOpen(true);
      setNotes(redemption.adminNotes ?? "");
    } else {
      onStatusChange(status as "pending" | "approved" | "processing" | "completed" | "rejected", null);
    }
  };

  const submitRejection = () => {
    onStatusChange("rejected", notes.trim() || null);
    setNotesOpen(false);
  };

  return (
    <div className="border border-border rounded-lg p-3 bg-card">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{redemption.rewardName}</span>
            <Badge variant="secondary">{redemption.rewardCategory}</Badge>
            <Badge className={STATUS_OPTIONS.find((s) => s.value === redemption.status)?.color ?? "bg-muted"}>
              {STATUS_LABELS[redemption.status] ?? redemption.status}
            </Badge>
          </div>
          <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {redemption.userName ?? `#${redemption.userId}`}
            </span>
            <span className="flex items-center gap-1">
              <Award className="h-3 w-3" />
              {redemption.xpSpent} XP
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(redemption.createdAt).toLocaleString()}
            </span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
            {redemption.instagramUsername && (
              <span className="flex items-center gap-1">
                <Globe className="h-3 w-3" />
                IG: @{redemption.instagramUsername}
              </span>
            )}
            {redemption.discordUsername && (
              <span className="flex items-center gap-1">
                <Globe className="h-3 w-3" />
                Discord: @{redemption.discordUsername}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <Select value={redemption.status} onValueChange={handleStatus}>
            <SelectTrigger className="w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={onViewHistory} aria-label="View history">
            <Clock className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {redemption.adminNotes && (
        <div className="mt-2 text-xs text-muted-foreground border-t border-border pt-2">
          <span className="font-medium">Admin notes:</span> {redemption.adminNotes}
        </div>
      )}

      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent className="glass-strong border-border">
          <DialogHeader>
            <DialogTitle>Rejection Notes</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="rejection-notes">Add a note (optional)</Label>
            <Textarea
              id="rejection-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Reason for rejection..."
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setNotesOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={submitRejection}>
                Reject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
