import { Link } from "react-router";
import { Users, UserRound, Trophy, Radio, CheckCircle2, Swords, MessageSquare, ArrowRight } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { trpc } from "@/providers/trpc";
import { timeAgo } from "@/lib/format";

export default function AdminDashboard() {
  const { data, isLoading } = trpc.admin.dashboard.useQuery();

  const cards = [
    { icon: Users, label: "Total Teams", value: data?.teams, href: "/admin/teams" },
    { icon: UserRound, label: "Total Players", value: data?.players, href: "/admin/players" },
    { icon: Trophy, label: "Upcoming", value: data?.upcoming, href: "/admin/tournaments" },
    { icon: Radio, label: "Live Now", value: data?.live, href: "/admin/live", red: true },
    { icon: CheckCircle2, label: "Completed", value: data?.completed, href: "/admin/tournaments" },
    { icon: Swords, label: "Total Matches", value: data?.matches },
    { icon: MessageSquare, label: "Comments", value: data?.comments, href: "/admin/comments" },
  ];

  return (
    <AdminLayout title="Dashboard">
      {isLoading ? (
        <p className="text-muted-foreground">Loading dashboard...</p>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
            {cards.map((c) => {
              const inner = (
                <div
                  className="glass h-full rounded-xl p-4 transition hover:border-[hsl(var(--tsg-blue)/0.5)]"
                >
                  <c.icon className={`mb-2 h-5 w-5 ${c.red ? "text-[hsl(var(--tsg-red))]" : "text-[hsl(var(--tsg-blue))]"}`} />
                  <p className="font-display text-2xl font-black">{c.value ?? 0}</p>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{c.label}</p>
                </div>
              );
              return c.href ? (
                <Link key={c.label} to={c.href}>{inner}</Link>
              ) : (
                <div key={c.label}>{inner}</div>
              );
            })}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="glass rounded-xl p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-sm font-bold tracking-widest">RECENT TOURNAMENTS</h2>
                <Link to="/admin/tournaments" className="flex items-center gap-1 text-xs text-[hsl(var(--tsg-blue))]">
                  Manage <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              {(data?.recentTournaments ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No tournaments yet.</p>
              ) : (
                <ul className="space-y-2.5">
                  {data!.recentTournaments.map((t) => (
                    <li key={t.id}>
                      <Link
                        to={`/admin/tournaments/${t.id}`}
                        className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3.5 py-2.5 text-sm transition hover:border-[hsl(var(--tsg-blue)/0.5)]"
                      >
                        <span className="truncate font-medium">{t.name}</span>
                        <span className="ml-3 shrink-0 text-xs uppercase tracking-wider text-muted-foreground">
                          {t.status}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="glass rounded-xl p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-sm font-bold tracking-widest">RECENT COMMENTS</h2>
                <Link to="/admin/comments" className="flex items-center gap-1 text-xs text-[hsl(var(--tsg-blue))]">
                  Moderate <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              {(data?.recentComments ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              ) : (
                <ul className="space-y-2.5">
                  {data!.recentComments.map((c) => (
                    <li key={c.id} className="rounded-lg border border-border bg-background/40 px-3.5 py-2.5 text-sm">
                      <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{c.userName ?? "User"}</span>
                        <span>{timeAgo(c.createdAt)}</span>
                      </div>
                      <p className="mt-1 line-clamp-2">{c.content}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">on {c.tournamentName}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
