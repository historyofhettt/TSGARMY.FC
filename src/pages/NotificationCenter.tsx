import { useEffect } from "react";
import { useNavigate } from "react-router";
import { Bell, CheckCheck, Check, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/PageLayout";
import type { NotificationTypeSlug } from "@contracts/constants";

const TYPE_ICONS: Record<string, string> = {
  admin_announcement: "📢",
  player_live: "🔴",
  clutch_highlight: "🎥",
  engagement: "❤️",
};

const TYPE_LABELS: Record<string, string> = {
  admin_announcement: "Announcement",
  player_live: "Player Live",
  clutch_highlight: "Clutch / Highlight",
  engagement: "Engagement",
};

const PRIORITY_BADGE: Record<string, { label: string; className: string }> = {
  normal: { label: "Normal", className: "bg-border text-muted-foreground" },
  important: {
    label: "Important",
    className: "bg-[hsl(var(--tsg-blue)/0.15)] text-[hsl(var(--tsg-blue))]",
  },
  urgent: {
    label: "Urgent",
    className: "bg-[hsl(var(--tsg-red)/0.15)] text-[hsl(var(--tsg-red))]",
  },
};

export default function NotificationCenter() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const { data: unreadData } = trpc.user.notificationUnreadCount.useQuery(
    undefined,
    { enabled: isAuthenticated, refetchInterval: 30_000 },
  );
  const { data: history, isLoading } = trpc.user.notificationHistory.useQuery(
    { limit: 100 },
    { enabled: isAuthenticated },
  );

  const markRead = trpc.user.markNotificationRead.useMutation({
    onSuccess: () => {
      utils.user.notificationUnreadCount.invalidate();
      utils.user.notificationHistory.invalidate();
    },
  });
  const markAllRead = trpc.user.markAllNotificationsRead.useMutation({
    onSuccess: () => {
      toast.success("All notifications marked as read.");
      utils.user.notificationUnreadCount.invalidate();
      utils.user.notificationHistory.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const recordClick = trpc.user.recordNotificationClick.useMutation();

  useEffect(() => {
    document.title = "Notifications | TSG";
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated) {
    return null;
  }

  const unread = unreadData?.count ?? 0;

  const handleClick = (n: (typeof history extends (infer T)[] | undefined ? T : never)) => {
    void recordClick.mutateAsync({ id: n.id }).catch(() => {});
    if (!n.isRead) {
      void markRead.mutateAsync({ id: n.id }).catch(() => {});
    }
    if (n.linkUrl) {
      navigate(n.linkUrl);
    }
  };

  return (
    <PageLayout>
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-24 md:px-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>
          <h1 className="font-display text-2xl font-bold tracking-wide md:text-3xl">
            Notifications
          </h1>
          {unread > 0 && (
            <span className="rounded-full bg-[hsl(var(--tsg-red)/0.15)] px-2.5 py-1 text-xs font-bold text-[hsl(var(--tsg-red))]">
              {unread} unread
            </span>
          )}
          {unread > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto gap-1.5 text-xs"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </Button>
          )}
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading notifications...</p>
        ) : !history || history.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <Bell className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-display text-lg font-bold">No notifications</p>
            <p className="mt-1 text-sm text-muted-foreground">
              You're all caught up. Announcements, live streams and engagement
              will show up here.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {history.map((n) => {
              const icon =
                TYPE_ICONS[n.typeSlug as NotificationTypeSlug] ?? "🔔";
              const typeLabel =
                TYPE_LABELS[n.typeSlug as NotificationTypeSlug] ?? "Notification";
              const priority = PRIORITY_BADGE[n.priority] ?? PRIORITY_BADGE.normal;
              return (
                <li key={n.id}>
                  <button
                    onClick={() => handleClick(n)}
                    className={cn(
                      "glass w-full rounded-xl border-l-4 p-4 text-left transition hover:border-[hsl(var(--tsg-blue)/0.4)]",
                      !n.isRead
                        ? "border-l-[hsl(var(--tsg-blue))]"
                        : "border-l-border",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 text-2xl leading-none">{icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "text-sm",
                              !n.isRead ? "font-bold" : "font-semibold",
                            )}
                          >
                            {n.title}
                          </span>
                          {!n.isRead && (
                            <span className="h-2 w-2 rounded-full bg-[hsl(var(--tsg-blue))]" />
                          )}
                        </div>
                        {n.message && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {n.message}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                            {typeLabel}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 font-semibold",
                              priority.className,
                            )}
                          >
                            {priority.label}
                          </span>
                          <span className="text-muted-foreground">
                            {timeAgo(n.createdAt)}
                          </span>
                          {n.linkUrl && n.linkLabel && (
                            <span className="font-semibold text-[hsl(var(--tsg-blue))]">
                              {n.linkLabel} →
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {n.isRead ? (
                          <Check className="h-4 w-4 text-muted-foreground/40" />
                        ) : (
                          <Check className="h-4 w-4 text-[hsl(var(--tsg-blue))]" />
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PageLayout>
  );
}
