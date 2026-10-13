import { EyeOff, Eye, Pin, PinOff, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function CommentsAdmin() {
  const utils = trpc.useUtils();
  const { data: list, isLoading } = trpc.admin.listComments.useQuery();
  const { data: reportList, isLoading: isReportsLoading } = trpc.admin.listContentCommentReports.useQuery();
  const moderate = trpc.admin.moderateComment.useMutation({
    onSuccess: () => {
      toast.success("Comment updated.");
      utils.admin.listComments.invalidate();
      utils.admin.listContentCommentReports.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const resolveReport = trpc.admin.resolveContentCommentReport.useMutation({
    onSuccess: () => {
      toast.success("Report resolved.");
      utils.admin.listContentCommentReports.invalidate();
      utils.admin.listComments.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <AdminLayout title="Comment Moderation" minRole="moderator">
      {isLoading ? (
        <p className="text-muted-foreground">Loading comments...</p>
      ) : (list ?? []).length === 0 ? (
        <p className="glass rounded-xl p-10 text-center text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <div className="space-y-3">
          {(list ?? []).map((c) => (
            <div
              key={c.id}
              className={cn("glass rounded-xl p-4", c.hidden && "opacity-50")}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{c.userName ?? "User"}</span>
                <span>on {c.tournamentName}</span>
                <span>{timeAgo(c.createdAt)}</span>
                {c.pinned && (
                  <span className="flex items-center gap-1 font-bold uppercase text-[hsl(var(--tsg-blue))]">
                    <Pin className="h-3 w-3" /> Pinned
                  </span>
                )}
                {c.hidden && (
                  <span className="flex items-center gap-1 font-bold uppercase text-[hsl(var(--tsg-red))]">
                    <EyeOff className="h-3 w-3" /> Hidden
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm">{c.content}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-xs"
                  onClick={() => moderate.mutate({ id: c.id, action: c.pinned ? "unpin" : "pin" })}
                >
                  {c.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                  {c.pinned ? "Unpin" : "Pin"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-xs"
                  onClick={() => moderate.mutate({ id: c.id, action: c.hidden ? "unhide" : "hide" })}
                >
                  {c.hidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  {c.hidden ? "Unhide" : "Hide"}
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button size="sm" variant="outline" className="gap-1 text-xs">
                      <Trash2 className="h-3 w-3 text-[hsl(var(--tsg-red))]" /> Delete
                    </Button>
                  }
                  title="Delete this comment?"
                  description="This cannot be undone."
                  onConfirm={() => moderate.mutate({ id: c.id, action: "delete" })}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8">
        <h2 className="mb-4 font-display text-lg font-bold tracking-wide text-[hsl(var(--tsg-blue))]">
          Universal Comment Reports
        </h2>
        {isReportsLoading ? (
          <p className="text-muted-foreground">Loading reports...</p>
        ) : (reportList ?? []).length === 0 ? (
          <p className="glass rounded-xl p-6 text-center text-sm text-muted-foreground">No reports to review.</p>
        ) : (
          <div className="space-y-3">
            {(reportList ?? []).map((r) => (
              <div
                key={r.id}
                className={cn("glass rounded-xl p-4", r.status !== "pending" && "opacity-60")}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <AlertTriangle className="h-3 w-3 text-[hsl(var(--tsg-red))]" />
                  <span className="font-semibold text-foreground">{r.reporterUsername ?? r.reporterId}</span>
                  <span>reported on {r.refTable}:{r.refId}</span>
                  <Badge variant={r.status === "pending" ? "outline" : "secondary"}>
                    {r.status}
                  </Badge>
                  <span>{timeAgo(r.createdAt)}</span>
                  <span>Reason: {r.reason}</span>
                  {r.customReason && <span className="font-medium">"{r.customReason}"</span>}
                </div>
                <p className="mt-2 text-sm">{r.content}</p>
                {r.status === "pending" && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolveReport.mutate({ id: r.id, action: "dismiss" })}
                    >
                      Dismiss Report
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolveReport.mutate({ id: r.id, action: "resolve" })}
                    >
                      Resolve
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button size="sm" variant="outline" className="gap-1 text-xs">
                          <Trash2 className="h-3 w-3 text-[hsl(var(--tsg-red))]" /> Delete Comment
                        </Button>
                      }
                      title="Delete this comment?"
                      description="This cannot be undone."
                      onConfirm={() => resolveReport.mutate({ id: r.id, action: "delete_comment" })}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
