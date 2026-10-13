import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Trophy, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/format";

export default function WeeklyTopFanAdmin() {
  const utils = trpc.useUtils();
  const { data: list, isLoading } = trpc.admin.listWeeklyTopFans.useQuery();
  const calcMutation = trpc.admin.calculateWeeklyTopFan.useMutation({
    onSuccess: (data) => {
      toast.success(data.message || "Weekly top fan calculated.");
      utils.admin.listWeeklyTopFans.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <AdminLayout title="Weekly Top Fan">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted-foreground">Historical weekly top fan records.</p>
        <Button onClick={() => calcMutation.mutate()} disabled={calcMutation.isPending} className="bg-[hsl(var(--tsg-blue))]">
          {calcMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> CALCULATING...</> : <><Trophy className="h-4 w-4 mr-1" /> CALCULATE THIS WEEK</>}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (list ?? []).length === 0 ? (
        <p className="glass rounded-xl p-10 text-center text-sm text-muted-foreground">No weekly top fan records yet.</p>
      ) : (
        <div className="space-y-3">
          {(list as any[]).map((w) => (
            <div key={w.id} className="glass rounded-xl p-4 flex flex-wrap items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--tsg-red)/0.15)]">
                <Trophy className="h-6 w-6 text-[hsl(var(--tsg-red))]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold">{w.userName ?? w.userUsername ?? "Unknown User"}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(w.weekStart)} - {formatDate(w.weekEnd)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-lg font-black text-[hsl(var(--tsg-blue))]">{w.userXp?.toLocaleString() ?? 0} XP</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
