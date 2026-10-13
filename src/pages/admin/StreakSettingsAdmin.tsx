import { useState } from "react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function StreakSettingsAdmin() {
  const utils = trpc.useUtils();
  const { data: settings, isLoading, isError, error } = trpc.admin.getStreakSettings.useQuery();
  const [form, setForm] = useState({
    dailyLoginXp: settings?.dailyLoginXp ?? 10,
    streakBonusXp: settings?.streakBonusXp ?? 5,
    maxStreakDays: settings?.maxStreakDays ?? 7,
    streakEnabled: settings?.streakEnabled ?? true,
  });

  const update = trpc.admin.updateStreakSettings.useMutation({
    onSuccess: () => {
      toast.success("Streak settings saved.");
      utils.admin.getStreakSettings.invalidate();
    },
    onError: (e) => toast.error(`Unable to save. ${e.message}`),
  });

  if (isLoading) {
    return (
      <AdminLayout title="Daily Streak Settings">
        <p className="text-muted-foreground">Loading settings...</p>
      </AdminLayout>
    );
  }

  if (isError || !settings) {
    return (
      <AdminLayout title="Daily Streak Settings">
        <p className="text-[hsl(var(--tsg-red))]">
          Failed to load streak settings: {error?.message ?? "Unknown error"}
        </p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Daily Streak Settings">
      <div className="max-w-2xl space-y-6">
        <section className="glass space-y-4 rounded-xl p-6">
          <h2 className="font-display text-sm font-bold tracking-widest">DAILY STREAK CONFIGURATION</h2>
          <p className="text-xs text-muted-foreground">
            These values control how much XP a user earns each consecutive day they sign in.
          </p>

          <div className="space-y-4">
            <div>
              <Label htmlFor="daily-login-xp">Daily Login XP</Label>
              <Input
                id="daily-login-xp"
                type="number"
                inputMode="numeric"
                min={0}
                max={1000}
                value={form.dailyLoginXp}
                onChange={(e) => setForm({ ...form, dailyLoginXp: Number(e.target.value) || 0 })}
              />
              <p className="mt-1 text-xs text-muted-foreground">XP awarded for signing in on a consecutive day.</p>
            </div>

            <div>
              <Label htmlFor="streak-bonus-xp">Streak Bonus XP</Label>
              <Input
                id="streak-bonus-xp"
                type="number"
                inputMode="numeric"
                min={0}
                max={1000}
                value={form.streakBonusXp}
                onChange={(e) => setForm({ ...form, streakBonusXp: Number(e.target.value) || 0 })}
              />
              <p className="mt-1 text-xs text-muted-foreground">Extra XP awarded on top of the daily login XP.</p>
            </div>

            <div>
              <Label htmlFor="max-streak-days">Max Streak Days</Label>
              <Input
                id="max-streak-days"
                type="number"
                inputMode="numeric"
                min={1}
                max={365}
                value={form.maxStreakDays}
                onChange={(e) => setForm({ ...form, maxStreakDays: Number(e.target.value) || 1 })}
              />
              <p className="mt-1 text-xs text-muted-foreground">Streaks cap at this many consecutive days before resetting.</p>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Switch checked={form.streakEnabled} onCheckedChange={(v) => setForm({ ...form, streakEnabled: v })} />
              <Label>Enable Daily Streak</Label>
            </div>
          </div>
        </section>

        <div className="sticky bottom-4">
          <Button
            onClick={() =>
              update.mutate({
                dailyLoginXp: form.dailyLoginXp,
                streakBonusXp: form.streakBonusXp,
                maxStreakDays: form.maxStreakDays,
                streakEnabled: form.streakEnabled,
              })
            }
            disabled={update.isPending}
            className="w-full bg-[hsl(var(--tsg-blue))] py-6 font-display text-sm font-bold tracking-[0.15em] hover:bg-[hsl(var(--tsg-blue)/0.85)]"
          >
            {update.isPending ? "Saving..." : "SAVE"}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}