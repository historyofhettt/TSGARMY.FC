import { useState, useEffect } from "react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { allRoles } from "@contracts/constants";

const ROLE_LABELS: Record<string, string> = {
  fan: "Fan",
  player: "Player",
  moderator: "Moderator",
  admin: "Admin",
};

export default function XpSettings() {
  const utils = trpc.useUtils();
  const { data: settings, isLoading, isError, error } = trpc.admin.getXpSettings.useQuery();
  const updateMutation = trpc.admin.updateXpEnabledRoles.useMutation({
    onSuccess: () => {
      toast.success("XP eligibility settings saved.");
      utils.admin.getXpSettings.invalidate();
    },
    onError: (e) => toast.error(`Failed to save. ${e.message}`),
  });

  const [enabledRoles, setEnabledRoles] = useState<string[]>([...allRoles]);

  useEffect(() => {
    if (settings?.enabledRoles) {
      setEnabledRoles(settings.enabledRoles);
    }
  }, [settings?.enabledRoles]);

  const toggleRole = (role: string) => {
    setEnabledRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  const handleSave = () => {
    updateMutation.mutate({ enabledRoles });
  };

  if (isLoading) {
    return (
      <AdminLayout title="XP Role Settings">
        <p className="text-muted-foreground">Loading...</p>
      </AdminLayout>
    );
  }

  if (isError || !settings) {
    return (
      <AdminLayout title="XP Role Settings">
        <p className="text-[hsl(var(--tsg-red))]">
          Failed to load XP settings: {error?.message ?? "Unknown error"}
        </p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="XP Role Settings">
      <div className="max-w-2xl space-y-6">
        <section className="glass space-y-4 rounded-xl p-6">
          <h2 className="font-display text-sm font-bold tracking-widest">XP ELIGIBLE ROLES</h2>
          <p className="text-xs text-muted-foreground">
            Only the selected roles can earn XP, appear on the leaderboard, and have their XP visible on profiles.
            Existing XP data is preserved when roles are disabled.
          </p>
          <div className="space-y-3">
            {allRoles.map((role) => (
              <div key={role} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-semibold">{ROLE_LABELS[role] ?? role}</p>
                  <p className="text-[11px] text-muted-foreground capitalize">{role}</p>
                </div>
                <Switch
                  checked={enabledRoles.includes(role)}
                  onCheckedChange={() => toggleRole(role)}
                />
              </div>
            ))}
          </div>
        </section>

        <div className="sticky bottom-4">
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="w-full bg-[hsl(var(--tsg-blue))] py-6 font-display text-sm font-bold tracking-[0.15em] hover:bg-[hsl(var(--tsg-blue)/0.85)]"
          >
            {updateMutation.isPending ? "Saving..." : "SAVE SETTINGS"}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
