import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Heart, MessageSquare, Pencil, Pin, Send, Trash2, Flag } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { hasAtLeastRole } from "@contracts/constants";
import type { Role } from "@contracts/constants";
type CommentRefTable = "media_album" | "tournaments" | "highlights" | "fan_spotlight";

export type CommentItem = {
  id: number;
  refTable: string;
  refId: number;
  parentId: number | null;
  likes: number | null;
  likedByMe: boolean;
  mine: boolean;
  content: string;
  pinned: boolean | null;
  createdAt: Date;
  updatedAt: Date;
  userId: number;
  userName: string | null;
  userUsername: string | null;
  userAvatar: string | null;
  userRole: string | null;
};

const ROLE_BADGE_STYLES: Record<string, string> = {
  admin: "border-[hsl(var(--tsg-red)/0.5)] text-[hsl(var(--tsg-red))]",
  moderator: "border-[hsl(var(--tsg-blue)/0.5)] text-[hsl(var(--tsg-blue))]",
  player: "border-emerald-500/50 text-emerald-400",
};

function RoleBadge({ role }: { role: string | null }) {
  if (!role) return null;
  const style = ROLE_BADGE_STYLES[role];
  if (!style) return null;
  return (
    <span className={cn("rounded-full border px-1.5 py-px text-[9px] font-bold uppercase tracking-wider", style)}>
      {role}
    </span>
  );
}

const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment" },
  { value: "inappropriate", label: "Inappropriate" },
  { value: "offtopic", label: "Off-topic" },
  { value: "other", label: "Other" },
];

export function UniversalCommentSection({
  refTable,
  refId,
  title = "Comments",
  placeholder = "Share your thoughts...",
}: {
  refTable: CommentRefTable;
  refId: number;
  title?: string;
  placeholder?: string;
}) {
  const { user, isAuthenticated, role } = useAuth();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const { data: comments, isLoading } = trpc.public.listComments.useQuery(
    { refTable, refId },
    { staleTime: 30_000 },
  );

  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [editing, setEditing] = useState<CommentItem | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [reportComment, setReportComment] = useState<CommentItem | null>(null);
  const [reportReason, setReportReason] = useState("other");
  const [reportCustom, setReportCustom] = useState("");

  const invalidate = () => {
    void utils.public.listComments.invalidate({ refTable, refId });
  };

  const create = trpc.public.createComment.useMutation({
    onSuccess: () => {
      setDraft("");
      setReplyTo(null);
      invalidate();
      toast.success("Comment posted.");
    },
    onError: (e: { message?: string }) => toast.error(e.message ?? "Error"),
  });

  const update = trpc.public.updateComment.useMutation({
    onSuccess: () => {
      setEditing(null);
      invalidate();
      toast.success("Comment updated.");
    },
    onError: (e: { message?: string }) => toast.error(e.message ?? "Error"),
  });

  const remove = trpc.public.deleteComment.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Comment deleted.");
    },
    onError: (e: { message?: string }) => toast.error(e.message ?? "Error"),
  });

  const like = trpc.public.likeComment.useMutation({
    onSuccess: invalidate,
    onError: (e: { message?: string }) => toast.error(e.message ?? "Error"),
  });

  const submitReport = trpc.public.reportContentComment.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Report submitted. Moderators will review.");
      setReportComment(null);
      setReportReason("other");
      setReportCustom("");
    },
    onError: (e: { message?: string }) => toast.error(e.message ?? "Error"),
  });

  const topLevel = (comments ?? []).filter((c) => !c.parentId);
  const repliesFor = (id: number) => (comments ?? []).filter((c) => c.parentId === id);

  const submit = () => {
    if (!draft.trim()) return;
    create.mutate({ refTable, refId, content: draft, parentId: replyTo?.id ?? null });
  };

  const CommentRow = ({ c, isReply }: { c: CommentItem; isReply?: boolean }) => (
    <article className={cn("glass rounded-xl p-4", isReply && "ml-8 border-l-2 border-l-[hsl(var(--tsg-blue)/0.4)] md:ml-12")}>
      <div className="flex items-center gap-2.5">
        {c.userAvatar ? (
          <img
            src={c.userAvatar.startsWith("http") ? c.userAvatar : `/uploads/${c.userAvatar}`}
            alt=""
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--tsg-blue)/0.15)] text-xs font-bold text-[hsl(var(--tsg-blue))]">
            {(c.userName ?? "?").slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="text-sm font-semibold">
          {c.userUsername ? (
            <Link to={`/fans/${c.userUsername}`} className="hover:underline">
              {c.userName ?? "TSG Fan"}
            </Link>
          ) : (
            c.userName ?? "TSG Fan"
          )}
        </span>
        <RoleBadge role={c.userRole} />
        {c.pinned && (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--tsg-blue))]">
            <Pin className="h-3 w-3" /> Pinned
          </span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{timeAgo(c.createdAt)}</span>
      </div>

      {editing?.id === c.id ? (
        <div className="mt-3 space-y-2">
          <Textarea
            value={editDraft}
            onChange={(e) => setEditDraft(e.target.value)}
            rows={2}
            maxLength={2000}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => update.mutate({ id: c.id, content: editDraft })} disabled={update.isPending}>
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(null)} disabled={update.isPending}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{c.content}</p>
      )}

      <div className="mt-3 flex items-center gap-1 text-xs">
        <button
          onClick={() => {
            if (!isAuthenticated) return navigate("/login");
            like.mutate({ commentId: c.id });
          }}
          aria-label="Like comment"
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2 py-1 transition hover:bg-accent",
            c.likedByMe ? "text-[hsl(var(--tsg-red))]" : "text-muted-foreground",
          )}
        >
          <Heart className={cn("h-3.5 w-3.5", c.likedByMe && "fill-current")} /> {c.likes}
        </button>

        {!isReply && (
          <button
            onClick={() => {
              if (!isAuthenticated) return navigate("/login");
              setReplyTo(c);
              setDraft("");
            }}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground transition hover:bg-acent"
          >
            <MessageSquare className="h-3.5 w-3.5" /> Reply
          </button>
        )}

        {c.mine && (
          <>
            <button
              onClick={() => {
                setEditing(c);
                setEditDraft(c.content);
              }}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground transition hover:bg-accent"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <button
              onClick={() => remove.mutate({ id: c.id })}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground transition hover:bg-accent hover:text-[hsl(var(--tsg-red))]"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </>
        )}

        {hasAtLeastRole(role ?? (user?.role as Role | null) ?? "fan", "moderator") && !c.mine && (
          <button
            onClick={() => remove.mutate({ id: c.id })}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground transition hover:bg-accent hover:text-[hsl(var(--tsg-red))]"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </button>
        )}

        <button
          onClick={() => {
            if (!isAuthenticated) return navigate("/login");
            setReportComment(c);
          }}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground transition hover:bg-accent"
          aria-label="Report comment"
        >
          <Flag className="h-3.5 w-3.5" /> Report
        </button>
      </div>
    </article>
  );

  if (!isAuthenticated && !hasAtLeastRole(role ?? (user?.role as Role) ?? "fan", "moderator")) {
    // Allow non-authed to view comments; only require auth for actions
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{title}</h3>

      {isAuthenticated ? (
        <div className="glass rounded-xl p-4">
          {replyTo && (
            <div className="mb-2 flex items-center justify-between rounded-md bg-accent/60 px-3 py-1.5 text-xs text-muted-foreground">
              <span>
                Replying to <b className="text-foreground">{replyTo.userName}</b>
              </span>
              <button onClick={() => setReplyTo(null)} className="text-[hsl(var(--tsg-red))]">
                Cancel
              </button>
            </div>
          )}
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            rows={3}
            maxLength={2000}
            aria-label="Write a comment"
            disabled={create.isPending}
          />
          <div className="mt-2 flex justify-end">
            <Button
              onClick={submit}
              disabled={create.isPending || !draft.trim()}
              className="gap-2 bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]"
            >
              <Send className="h-4 w-4" /> {create.isPending ? "Posting..." : "Post"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="glass rounded-xl p-5 text-center">
          <p className="text-sm text-muted-foreground">Sign in to join the discussion.</p>
          <Button
            className="mt-3 bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]"
            onClick={() => navigate("/login")}
          >
            Login to Comment
          </Button>
        </div>
      )}

      {isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Loading comments...</p>}
      {!isLoading && topLevel.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">Be the first to share your thoughts.</p>
      )}

      {topLevel.map((c) => (
        <div key={c.id} className="space-y-3">
          <CommentRow c={c} />
          {repliesFor(c.id).map((r) => (
            <CommentRow key={r.id} c={r} isReply />
          ))}
        </div>
      ))}

      <Dialog open={!!reportComment} onOpenChange={() => setReportComment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Comment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Reason</Label>
              <Select value={reportReason} onValueChange={setReportReason}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {reportReason === "other" && (
              <div>
                <Label htmlFor="customReason">Details</Label>
                <Textarea
                  id="customReason"
                  value={reportCustom}
                  onChange={(e) => setReportCustom(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Provide additional context..."
                />
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setReportComment(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (!reportComment) return;
                  submitReport.mutate({
                    commentId: reportComment.id,
                    reason: reportReason as "spam" | "harassment" | "inappropriate" | "offtopic" | "other",
                    customReason: reportCustom || undefined,
                  });
                }}
                disabled={submitReport.isPending}
              >
                {submitReport.isPending ? "Submitting..." : "Submit Report"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
