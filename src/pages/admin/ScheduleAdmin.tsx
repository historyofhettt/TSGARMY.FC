import { Link } from "react-router";
import { Settings2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { StatusBadge } from "@/components/LiveBadge";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

/** Schedule management — a focused view of upcoming & completed events. */
export default function ScheduleAdmin() {
  const { data: list, isLoading } = trpc.admin.listTournaments.useQuery();

  const upcoming = (list ?? []).filter((t) => t.status === "upcoming");
  const rest = (list ?? []).filter((t) => t.status !== "upcoming");

  return (
    <AdminLayout title="Schedule">
      <p className="mb-5 text-sm text-muted-foreground">
        Schedule entries are tournaments — set their date, time and status here or in Tournaments.
      </p>
      {isLoading ? (
        <p className="text-muted-foreground">Loading schedule...</p>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 font-display text-sm font-bold tracking-widest text-[hsl(var(--tsg-blue))]">
              UPCOMING ({upcoming.length})
            </h2>
            <div className="space-y-2">
              {upcoming.length === 0 && (
                <p className="glass rounded-xl p-6 text-center text-sm text-muted-foreground">No upcoming tournaments.</p>
              )}
              {upcoming.map((t) => (
                <div key={t.id} className="glass flex flex-wrap items-center gap-3 rounded-xl p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.team?.name} · {formatDate(t.startDate)} {t.startTime ? `· ${t.startTime}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={t.status} />
                  <Link to={`/admin/tournaments/${t.id}`}>
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <Settings2 className="h-4 w-4" /> Manage
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h2 className="mb-3 font-display text-sm font-bold tracking-widest text-muted-foreground">
              LIVE & COMPLETED ({rest.length})
            </h2>
            <div className="space-y-2">
              {rest.map((t) => (
                <div key={t.id} className="glass flex flex-wrap items-center gap-3 rounded-xl p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.team?.name} · {formatDate(t.startDate)}
                    </p>
                  </div>
                  <StatusBadge status={t.status} />
                  <Link to={`/admin/tournaments/${t.id}`}>
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <Settings2 className="h-4 w-4" /> Manage
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </AdminLayout>
  );
}
