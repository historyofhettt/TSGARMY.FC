import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { CheckCheck, Check } from "lucide-react";
import type { NotificationTypeSlug } from "@contracts/constants";

const TYPE_ICONS: Record<string, string> = {
  admin_announcement: "📢",
  player_live: "🔴",
  clutch_highlight: "🎥",
  engagement: "❤️",
};

const PRIORITY_STYLES: Record<string, string> = {
  normal: "",
  important: "border-l-[hsl(var(--tsg-blue))]",
  urgent: "border-l-[hsl(var(--tsg-red))]",
};

export function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();

  const { data: unreadData } = trpc.user.notificationUnreadCount.useQuery(
    undefined,
    { enabled: isAuthenticated, refetchInterval: 30_000 },
  );
  const { data: history } = trpc.user.notificationHistory.useQuery(
    { limit: 30 },
    { enabled: isAuthenticated && open },
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

  const unread = unreadData?.count ?? 0;

  if (!isAuthenticated) return null;

  const handleOpen = (next: boolean) => {
    setOpen(next);
  };

  const handleClickNotification = (n: (typeof history extends (infer T)[] | undefined ? T : never)) => {
    void recordClick.mutateAsync({ id: n.id }).catch(() => {});
    if (!n.isRead) {
      void markRead.mutateAsync({ id: n.id }).catch(() => {});
    }
    if (n.linkUrl) {
      setOpen(false);
      navigate(n.linkUrl);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:border-[hsl(var(--tsg-blue)/0.6)] hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[hsl(var(--tsg-red))] px-1 text-[10px] font-bold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="glass-strong w-80 border-border p-0 md:w-96"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-display text-sm font-bold tracking-wide">
            Notifications
          </p>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-muted-foreground"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[24rem]">
          {!history || history.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              No notifications yet.
            </p>
          ) : (
            <ul className="divide-y divide-border/50">
              {history.map((n) => {
                const icon =
                  TYPE_ICONS[n.typeSlug as NotificationTypeSlug] ?? "🔔";
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => handleClickNotification(n)}
                      className={cn(
                        "flex w-full items-start gap-3 border-l-2 px-4 py-3 text-left transition hover:bg-accent",
                        !n.isRead && "bg-[hsl(var(--tsg-blue)/0.06)]",
                        PRIORITY_STYLES[n.priority] ?? "",
                      )}
                    >
                      <span className="mt-0.5 text-lg leading-none">{icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              "truncate text-sm",
                              !n.isRead ? "font-semibold" : "font-medium",
                            )}
                          >
                            {n.title}
                          </span>
                          {!n.isRead && (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-[hsl(var(--tsg-blue))]" />
                          )}
                        </span>
                        {(n.imageUrl || n.youtubeThumbnailUrl) && (
                          <div className="mt-1.5 flex gap-2">
                            {n.imageUrl && (
                              <img
                                src={n.imageUrl}
                                alt={n.title}
                                className="h-12 w-12 shrink-0 rounded object-cover"
                                loading="lazy"
                              />
                            )}
                            {n.youtubeThumbnailUrl && (
                              <img
                                src={n.youtubeThumbnailUrl}
                                alt={n.title}
                                className="h-12 w-12 shrink-0 rounded object-cover"
                                loading="lazy"
                              />
                            )}
                          </div>
                        )}
                        {n.message && (
                          <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">
                            {n.message}
                          </span>
                        )}
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          {timeAgo(n.createdAt)}
                          {n.linkUrl && n.linkLabel && (
                            <span className="ml-2 text-[hsl(var(--tsg-blue))]">
                              {n.linkLabel} →
                            </span>
                          )}
                        </span>
                      </span>
                      {n.isRead ? (
                        <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                      ) : (
                        <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-[hsl(var(--tsg-blue))]" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
        <div className="border-t border-border px-4 py-2">
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block text-center text-xs font-semibold text-[hsl(var(--tsg-blue))] hover:underline"
          >
            View all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
