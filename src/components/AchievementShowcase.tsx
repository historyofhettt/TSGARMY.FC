import { Trophy, Gem, CheckCircle2, Lock } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";

function classForBadge(badge: string | null | undefined): string {
  if (!badge) return "bg-slate-500/20 text-slate-400";
  const b = badge.toLowerCase();
  if (b.includes("gold") || b.includes("platinum")) return "bg-amber-400/20 text-amber-400";
  if (b.includes("silver")) return "bg-slate-400/20 text-slate-300";
  if (b.includes("bronze")) return "bg-amber-800/30 text-amber-700";
  return "bg-[hsl(var(--tsg-blue)/0.2)] text-[hsl(var(--tsg-blue))]";
}

export default function AchievementShowcase() {
  const { data: earned, isLoading: earnedLoading } = trpc.user.myAchievements.useQuery();
  const { data: progress, isLoading: progressLoading } = trpc.user.achievementProgress.useQuery();

  const isLoading = earnedLoading || progressLoading;

  if (isLoading) {
    return (
      <section className="mt-10">
        <p className="text-sm text-muted-foreground">Loading achievements...</p>
      </section>
    );
  }

  if (!progress || progress.length === 0) {
    return (
      <section className="mt-10">
        <p className="text-sm text-muted-foreground">No achievements available yet.</p>
      </section>
    );
  }

  const earnedIds = new Set((earned ?? []).map((a) => a.id));

  const earnedList = progress.filter((a) => earnedIds.has(a.id));
  const lockedList = progress.filter((a) => !earnedIds.has(a.id));

  return (
    <section className="mt-10 space-y-8">
      <div>
        <h2 className="font-display text-lg font-black tracking-wide text-foreground">
          Achievements ({earnedList.length} / {progress.length})
        </h2>
        <p className="text-xs text-muted-foreground">
          {earnedList.length} earned · {lockedList.length} remaining
        </p>
      </div>

      {earnedList.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-[hsl(var(--tsg-blue))]">
            Earned
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {earnedList.map((a) => (
              <AchievementCard key={a.id} ach={a} earned={true} />
            ))}
          </div>
        </div>
      )}

      {lockedList.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Locked
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lockedList.map((a) => (
              <AchievementCard key={a.id} ach={a} earned={false} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

type AchievementCardProps = {
  ach: {
    id: number;
    name: string;
    description: string | null;
    iconKey: string | null;
    iconUrl: string | null;
    badge: string | null;
    tag: string | null;
    category: string | null;
    requirementType: string | null;
    requirementValue: number | null;
    xpReward: number;
    isActive: boolean;
    earned: boolean;
    progress: number;
    target: number | null;
    linkedCardId: number | null;
    cardName: string | null;
    cardImageUrl: string | null;
  };
  earned: boolean;
};

function AchievementCard({ ach, earned }: AchievementCardProps) {
  const isLocked = !earned;
  const cardRarityBorder = ach.cardImageUrl ? "border-border" : "border-border";

  return (
    <div
      className={cn(
        "glass relative flex items-center gap-3 rounded-xl border-2 p-3 transition-all",
        earned
          ? "border-[hsl(var(--tsg-blue)/0.5)] bg-[hsl(var(--tsg-blue)/0.08)]"
          : "border-border opacity-70",
        isLocked && "grayscale",
      )}
    >
      <div
        className={cn(
          "relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border bg-background/40",
          cardRarityBorder,
        )}
      >
        {ach.iconUrl ? (
          <img src={ach.iconUrl} alt={ach.name} className="h-10 w-10 rounded object-cover" />
        ) : (
          <Trophy className="h-6 w-6 text-[hsl(var(--tsg-blue))]" />
        )}
        {earned && (
          <CheckCircle2 className="absolute -right-1 -bottom-1 h-4 w-4 rounded-full border-2 border-background bg-[hsl(var(--tsg-blue))]" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="font-display font-bold">{ach.name}</p>
          {ach.badge && (
            <span
              className={cn(
                "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold",
                classForBadge(ach.badge),
              )}
            >
              {ach.badge}
            </span>
          )}
          {ach.tag && (
            <span className="text-[10px] uppercase text-muted-foreground">#{ach.tag}</span>
          )}
        </div>

        {ach.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{ach.description}</p>
        )}

        <div className="mt-1 flex items-center gap-2">
          {ach.xpReward > 0 && (
            <span className="flex items-center gap-1 text-xs font-semibold text-[hsl(var(--tsg-blue))]">
              <Trophy className="h-3 w-3" />
              {ach.xpReward} XP
            </span>
          )}
          {ach.linkedCardId && ach.cardName && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Gem className="h-3 w-3" />
              {ach.cardName}
            </span>
          )}
          {ach.requirementType && ach.target && (
            <span className="text-xs text-muted-foreground">
              {ach.requirementType.replace(/_/g, " ")}: {ach.target}
            </span>
          )}
        </div>

        {!earned && ach.target && ach.progress > 0 && (
          <div className="mt-1 h-1.5 w-full max-w-[120px] overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-[hsl(var(--tsg-blue))]"
              style={{ width: `${Math.min(ach.progress, 100)}%` }}
            />
          </div>
        )}
      </div>

      {!earned && (
        <Lock className="absolute top-2 right-2 h-4 w-4 text-muted-foreground/50" />
      )}
    </div>
  );
}
