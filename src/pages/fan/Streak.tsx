import { useState, useEffect } from "react";
import { PageLayout } from "@/components/PageLayout";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Streak() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const utils = trpc.useUtils();

  const { data: streak, isLoading, isError, error, refetch } = trpc.user.streakStatus.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const claimMutation = trpc.user.claimStreak.useMutation({
    onSuccess: (data) => {
      toast.success(`Claimed! +${data.xpAwarded} XP`);
      refetch();
      utils.user.myXpHistory.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const [claimedToday, setClaimedToday] = useState(false);
  const [showXpEarned, setShowXpEarned] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);

  useEffect(() => {
    if (streak?.lastLoginDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const lastLogin = new Date(streak.lastLoginDate);
      lastLogin.setHours(0, 0, 0, 0);
      setClaimedToday(today.getTime() === lastLogin.getTime());
    }
  }, [streak?.lastLoginDate]);

  const handleClaim = async () => {
    if (claimedToday) return;
    const result = await claimMutation.mutateAsync();
    setXpEarned(result.xpAwarded);
    setShowXpEarned(true);
    setClaimedToday(true);
  };

  if (authLoading) {
    return (
      <PageLayout>
        <div className="mx-auto max-w-2xl py-16 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[hsl(var(--tsg-blue))]" />
          <p className="mt-4">Verifying access...</p>
        </div>
      </PageLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <PageLayout>
        <div className="mx-auto max-w-2xl py-16 text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight mb-4">DAILY STREAK</h1>
          <p className="text-muted-foreground mb-8">
            Sign in to track your daily login streak and claim XP rewards.
          </p>
          <Button
            asChild
            className="bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]"
          >
            <a href="/login">SIGN IN</a>
          </Button>
        </div>
      </PageLayout>
    );
  }

  if (isLoading) {
    return (
      <PageLayout>
        <div className="mx-auto max-w-2xl py-16 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[hsl(var(--tsg-blue))]" />
          <p className="mt-4">Loading streak data...</p>
        </div>
      </PageLayout>
    );
  }

  if (isError || !streak) {
    return (
      <PageLayout>
        <div className="mx-auto max-w-2xl py-16 text-center">
          <p className="text-[hsl(var(--tsg-red))]">
            Failed to load streak data: {error?.message ?? "Unknown error"}
          </p>
        </div>
      </PageLayout>
    );
  }

  const { currentStreak, longestStreak, dailyLoginXp, streakBonusXp, maxStreakDays } = streak;
  const cappedStreak = Math.min(currentStreak, maxStreakDays);
  const nextStreakXp = dailyLoginXp + (cappedStreak > 1 ? (cappedStreak - 1) * streakBonusXp : 0);

  return (
    <PageLayout>
      <div className="mx-auto max-w-2xl py-12 px-4">
        <h1 className="font-display text-3xl font-bold tracking-tight mb-8 text-center">DAILY STREAK</h1>

        <Card className="bg-gradient-to-br from-[hsl(var(--tsg-blue)/0.15)] to-[hsl(var(--tsg-red)/0.1)] border-[hsl(var(--tsg-blue)/0.3)]">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-[hsl(var(--tsg-blue)/0.15)]">
              <Flame className="h-12 w-12 text-[hsl(var(--tsg-red))]" />
            </div>
            <div className="mb-4">
              <span className="font-display text-6xl font-black tracking-tight text-[hsl(var(--tsg-blue))]">
                {currentStreak}
              </span>
              <span className="ml-2 font-display text-xl font-bold text-muted-foreground">DAY</span>
            </div>
            <p className="text-lg text-muted-foreground mb-6">
              {currentStreak === 0 ? "Start your streak today!" : "Keep the fire burning!"}
            </p>

            <div className="flex flex-wrap justify-center gap-4 mb-6 text-sm">
              <Badge variant="outline" className="gap-1.5 px-3 py-1.5">
                <span className="font-semibold text-[hsl(var(--tsg-blue))]">{dailyLoginXp}</span> XP / day
              </Badge>
              <Badge variant="outline" className="gap-1.5 px-3 py-1.5">
                <span className="font-semibold text-[hsl(var(--tsg-red))]">{streakBonusXp}</span> XP bonus / day
              </Badge>
              <Badge variant="outline" className="gap-1.5 px-3 py-1.5">
                Max streak: <span className="font-semibold">{maxStreakDays}</span> days
              </Badge>
            </div>

            {showXpEarned && xpEarned > 0 && (
              <div className="mb-6 p-4 rounded-lg bg-[hsl(var(--tsg-green)/0.15)] border border-[hsl(var(--tsg-green)/0.3)] animate-pulse">
                <p className="font-display text-lg font-bold text-[hsl(var(--tsg-green))]">
                  +{xpEarned} XP EARNED!
                </p>
              </div>
            )}

            <Button
              onClick={handleClaim}
              disabled={claimedToday || claimMutation.isPending}
              className="w-full md:w-auto min-w-[200px] h-12 text-lg bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)] disabled:bg-[hsl(var(--tsg-blue)/0.4)] disabled:cursor-not-allowed"
            >
              {claimMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  CLAIMING...
                </>
              ) : claimedToday ? (
                <>
                  <CheckCircle className="h-5 w-5" />
                  ALREADY CLAIMED
                </>
              ) : (
                <>
                  <Flame className="h-5 w-5" />
                  CLAIM TODAY (+{nextStreakXp} XP)
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Card className="glass">
            <CardContent className="p-6 text-center">
              <p className="text-xs font-semibold tracking-widest text-muted-foreground mb-2">LONGEST STREAK</p>
              <p className="font-display text-3xl font-bold text-[hsl(var(--tsg-red))]">{longestStreak}</p>
              <p className="text-sm text-muted-foreground mt-1">days</p>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="p-6 text-center">
              <p className="text-xs font-semibold tracking-widest text-muted-foreground mb-2">NEXT CLAIM XP</p>
              <p className="font-display text-3xl font-bold text-[hsl(var(--tsg-blue))]">+{nextStreakXp}</p>
              <p className="text-sm text-muted-foreground mt-1">XP</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-8 glass">
          <CardContent className="p-6">
            <h3 className="font-display text-sm font-bold tracking-widest mb-4">HOW IT WORKS</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[hsl(var(--tsg-blue))/0.2] flex items-center justify-center text-[11px] font-bold text-[hsl(var(--tsg-blue))]">1</span>
                <span>Log in daily and click <strong>CLAIM TODAY</strong> to earn XP.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[hsl(var(--tsg-blue))/0.2] flex items-center justify-center text-[11px] font-bold text-[hsl(var(--tsg-blue))]">2</span>
                <span>Consecutive days increase your streak. Day 1 = {dailyLoginXp} XP, Day 2 = {dailyLoginXp + streakBonusXp} XP, etc.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[hsl(var(--tsg-blue))/0.2] flex items-center justify-center text-[11px] font-bold text-[hsl(var(--tsg-blue))]">3</span>
                <span>Streak caps at <strong>{maxStreakDays} days</strong> for bonus calculation. Missing a day resets to Day 1.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[hsl(var(--tsg-blue))/0.2] flex items-center justify-center text-[11px] font-bold text-[hsl(var(--tsg-blue))]">4</span>
                <span>Your <strong>longest streak</strong> is tracked separately and never resets.</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}