import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Heart, MessageSquare, Pencil, Pin, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { timeAgo } from "@/lib/format";
import { UserAvatar } from "@/components/UserAvatar";
import { cn } from "@/lib/utils";
import { hasAtLeastRole } from "@contracts/constants";

type CommentItem = {
  id: number;
  content: string;
  parentId: number | null;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
  userId: number;
  userName: string | null;
  userUsername: string | null;
  userAvatar: string | null;
  userRole: string | null;
  reactions: number;
  reactedByMe: boolean;
  mine: boolean;
};

const ROLE_BADGE_STYLES: Record<string, string> = {
  admin: "border-[hsl(var(--tsg-red)/0.5)] text-[hsl(var(--tsg-red))]",
  moderator: "border-[hsl(var(--tsg-blue)/0.5)] text-[hsl(var(--tsg-blue))]",
  player: "border-emerald-500/50 text-emerald-400",
};

function RoleBadge({ role }: { role: string | null | undefined }) {
  if (!role) return null;
  const style = ROLE_BADGE_STYLES[role];
  if (!style) return null;
  return (
    <span
      className={cn(
        "rounded-full border px-1.5 py-px text-[9px] font-bold uppercase tracking-wider",
        style,
      )}
    >
      {role}
    </span>
  );
}

export function HighlightCommentSection({ highlightId }: { highlightId: number }) {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { data: comments, isLoading } = trpc.highlights.listComments.useQuery({ highlightId });

  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [editing, setEditing] = useState<CommentItem | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const invalidate = () => utils.highlights.listComments.invalidate({ highlightId });

  const createMut = trpc.highlights.createComment.useMutation({
    onSuccess: () => {
      setDraft("");
      setReplyTo(null);
      invalidate();
      toast.success("Comment posted.");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.highlights.updateComment.useMutation({
    onSuccess: () => {
      setEditing(null);
      invalidate();
      toast.success("Comment updated.");
    },
    onError: (e) => toast.error(e.message),
  });
  const removeMut = trpc.highlights.deleteComment.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Comment deleted.");
    },
    onError: (e) => toast.error(e.message),
  });
  const reactMut = trpc.highlights.reactComment.useMutation({
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  });

  const topLevel = (comments ?? []).filter((c) => !c.parentId);
  const repliesFor = (id: number) => (comments ?? []).filter((c) => c.parentId === id);

  const submit = () => {
    if (!draft.trim()) return;
    createMut.mutate({
      highlightId,
      content: draft,
      parentId: replyTo?.id ?? null,
    });
  };

  const CommentRow = ({ c, isReply }: { c: CommentItem; isReply?: boolean }) => (
    <article
      className={cn(
        "glass rounded-xl p-4",
        isReply && "ml-4 border-l-2 border-l-[hsl(var(--tsg-blue)/0.4)] md:ml-8",
      )}
    >
      <div className="flex items-center gap-2.5">
        <UserAvatar src={c.userAvatar} name={c.userName} username={c.userUsername ?? undefined} />
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
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => updateMut.mutate({ id: c.id, content: editDraft })}
              disabled={updateMut.isPending}
            >
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {c.content}
        </p>
      )}

      <div className="mt-3 flex items-center gap-1 text-xs">
        <button
          onClick={() =>
            isAuthenticated ? reactMut.mutate({ commentId: c.id }) : navigate("/login")
          }
          aria-label="Like comment"
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2 py-1 transition hover:bg-accent",
            c.reactedByMe
              ? "text-[hsl(var(--tsg-red))]"
              : "text-muted-foreground",
          )}
        >
          <Heart className={cn("h-3.5 w-3.5", c.reactedByMe && "fill-current")} /> {c.reactions}
        </button>
        {!isReply && (
          <button
            onClick={() =>
              isAuthenticated ? (setReplyTo(c), setDraft("")) : navigate("/login")
            }
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground transition hover:bg-accent"
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
              onClick={() => removeMut.mutate({ id: c.id })}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground transition hover:bg-accent hover:text-[hsl(var(--tsg-red))]"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </>
        )}
        {hasAtLeastRole(user?.role, "moderator") && !c.mine && (
          <button
            onClick={() => removeMut.mutate({ id: c.id })}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground transition hover:bg-accent hover:text-[hsl(var(--tsg-red))]"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </button>
        )}
      </div>
    </article>
  );

  return (
    <div className="space-y-4">
      {isAuthenticated ? (
        <div className="glass rounded-xl p-4">
          {replyTo && (
            <div className="mb-2 flex items-center justify-between rounded-md bg-accent/60 px-3 py-1.5 text-xs text-muted-foreground">
              <span>
                Replying to <b className="text-foreground">{replyTo.userName ?? replyTo.userUsername ?? "TSG Fan"}</b>
              </span>
              <button
                onClick={() => setReplyTo(null)}
                className="text-[hsl(var(--tsg-red))]"
              >
                Cancel
              </button>
            </div>
          )}
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Share your thoughts on this highlight..."
            rows={3}
            maxLength={2000}
            aria-label="Write a comment"
          />
          <div className="mt-2 flex justify-end">
            <Button
              onClick={submit}
              disabled={createMut.isPending || !draft.trim()}
              className="gap-2 bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]"
            >
              <Send className="h-4 w-4" /> {createMut.isPending ? "Posting..." : "Post"}
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

      {isLoading && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Loading comments...
        </p>
      )}
      {!isLoading && topLevel.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Be the first to share your thoughts.
        </p>
      )}
      {topLevel.map((c) => (
        <div key={c.id} className="space-y-3">
          <CommentRow c={c} />
          {repliesFor(c.id).map((r) => (
            <CommentRow key={r.id} c={r} isReply />
          ))}
        </div>
      ))}
    </div>
  );
}
