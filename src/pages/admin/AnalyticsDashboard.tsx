import { useState } from "react";
import {
  Users, UserCheck, Trophy, Flame, Gem,
  Brain, Target, CalendarDays, BarChart3,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { trpc } from "@/providers/trpc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
  PieChart, Pie, Cell,
} from "recharts";

const DATE_RANGES = [
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
  { value: 365, label: "Last year" },
] as const;

const PIE_COLORS = [
  "#3b82f6", "#ef4444", "#1e293b", "#22c55e", "#f59e0b", "#eab308",
  "#8b5cf6", "#ec4899", "#14b8a3", "#f97316",
];

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
  red,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  red?: boolean;
}) {
  return (
    <Card className="glass border-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg",
            red ? "bg-[hsl(var(--tsg-red)/0.15)]" : "bg-[hsl(var(--tsg-blue)/0.15)]",
          )}>
            <Icon className={`h-4 w-4 ${red ? "text-[hsl(var(--tsg-red))]" : "text-[hsl(var(--tsg-blue))]"}`} />
          </div>
          <div>
            <p className="text-2xl font-black">{value}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
            {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LineChartCard({
  title,
  data,
  dataKey,
  color = "hsl(var(--tsg-blue))",
}: {
  title: string;
  data: { date: string; [key: string]: any }[];
  dataKey: string;
  color?: string;
}) {
  const chartConfig = { [dataKey]: { label: title, color } };
  return (
    <Card className="glass border-border">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-sm font-bold uppercase tracking-widest">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <LineChart data={data} margin={{ top: 5, right: 12, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <ChartTooltip content={<ChartTooltipContent className="border-border" />} />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function BarChartCard({
  title,
  data,
  dataKey,
  color = "hsl(var(--tsg-blue))",
}: {
  title: string;
  data: { name: string; [key: string]: any }[];
  dataKey: string;
  color?: string;
}) {
  const chartConfig = { [dataKey]: { label: title, color } };
  return (
    <Card className="glass border-border">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-sm font-bold uppercase tracking-wider">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <BarChart data={data} margin={{ top: 5, right: 12, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <ChartTooltip content={<ChartTooltipContent className="border-border" />} />
            <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function PieChartCard({
  title,
  data,
}: {
  title: string;
  data: { name: string; value: number }[];
}) {
  const chartConfig = data.reduce((acc, d, i) => {
    acc[d.name] = { label: d.name, color: PIE_COLORS[i % PIE_COLORS.length] };
    return acc;
  }, {} as Record<string, { label: string; color: string }>);

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card className="glass border-border">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-sm font-bold uppercase tracking-wider">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent />} />
            <Pie
              data={data}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={70}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="mt-2 flex justify-center gap-4 flex-wrap">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center gap-1.5 text-xs">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
              <span className="text-muted-foreground">{d.name}</span>
              <span className="font-bold">{d.value} ({total ? Math.round((d.value / total) * 100) : 0}%)</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function formatDateKey(d: string): string {
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[1]}/${parts[2]}`;
  return d;
}

function fillDateRange(
  data: { date: string; [key: string]: any }[],
  days: number,
): { date: string; [key: string]: any }[] {
  if (!data || data.length === 0) return [];
  const map = new Map(data.map((d) => [d.date, d]));
  const result: { date: string; [key: string]: any }[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    result.push(map.get(key) ?? { date: key });
  }
  return result;
}

export default function AnalyticsDashboard() {
  const [days, setDays] = useState(30);
  const { data: analytics, isLoading, isError, error } = trpc.admin.analytics.useQuery({ days });

  const t = (analytics?.totals ?? {}) as Record<string, number>;

  const newUsersSeries = fillDateRange(analytics?.series.newUsersByDay ?? [], days);
  const activeUsersSeries = fillDateRange(analytics?.series.activeUsersByDay ?? [], days);
  const xpSeries = fillDateRange(analytics?.series.xpByDay ?? [], days);
  const commentsSeries = fillDateRange(analytics?.series.commentsByDay ?? [], days);
  const grantsSeries = fillDateRange(analytics?.series.cardGrantsByDay ?? [], days);

  const roleDistData = (analytics?.roleDistribution ?? []).map((r: { role: string; count: number }) => ({
    name: r.role,
    value: r.count,
  }));

  const tournamentStatusData = (analytics?.tournamentsByStatus ?? []).map((t: { status: string; count: number }) => ({
    name: t.status,
    value: t.count,
  }));

  const popularCardsBar = (analytics?.popularCards ?? []).slice(0, 10).map((c) => ({
    name: c.cardName.length > 15 ? c.cardName.slice(0, 15) + "…" : c.cardName,
    holders: c.holders,
  }));

  return (
    <AdminLayout title="Analytics">
      {isLoading ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="h-8 w-48 animate-pulse rounded bg-muted" />
            <div className="h-10 w-32 animate-pulse rounded" />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="glass border-border">
                <CardContent className="p-4">
                  <div className="h-16 animate-pulse rounded bg-muted" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <p className="text-destructive">Failed to load analytics data.</p>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "An unexpected error occurred."}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="font-display text-2xl font-black tracking-wide">Analytics Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Showing data for the last <strong>{days}</strong> days
              </p>
            </div>
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGES.map((r) => (
                  <SelectItem key={r.value} value={String(r.value)}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <section>
            <h2 className="mb-3 font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Overview
            </h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
              <SummaryCard icon={Users} label="Total Users" value={t.users ?? 0} />
              <SummaryCard icon={UserCheck} label="Active Users" value={t.activeUsers ?? 0} sub={`past ${days}d`} />
              <SummaryCard icon={Trophy} label="Total XP" value={(t.totalXp ?? 0).toLocaleString()} />
              <SummaryCard icon={UserCheck} label="Banned" value={t.bannedUsers ?? 0} red />
              <SummaryCard icon={Gem} label="Active Cards" value={t.activeCards ?? 0} />
              <SummaryCard icon={BarChart3} label="Card Grants" value={t.totalCardGrants ?? 0} />
              <SummaryCard icon={Trophy} label="Achievements" value={t.achievementCount ?? 0} />
              <SummaryCard icon={Brain} label="Quiz Qs" value={t.quizQuestions ?? 0} />
              <SummaryCard icon={Target} label="Predictions" value={t.predictions ?? 0} />
              <SummaryCard icon={CalendarDays} label="Tournaments" value={t.tournaments ?? 0} />
              <SummaryCard icon={Flame} label="Matches" value={t.matches ?? 0} />
              <SummaryCard icon={CalendarDays} label="Weekly Top Fans" value={t.weeklyTopFans ?? 0} />
            </div>
          </section>

          <section>
            <h2 className="mb-3 font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Activity Trends
            </h2>
            <div className="grid gap-6 lg:grid-cols-2">
              <LineChartCard
                title="New Users"
                data={newUsersSeries.map((d) => ({ date: formatDateKey(d.date), count: d.count ?? 0 }))}
                dataKey="count"
                color="hsl(var(--tsg-blue))"
              />
              <LineChartCard
                title="Active Users"
                data={activeUsersSeries.map((d) => ({ date: formatDateKey(d.date), count: d.count ?? 0 }))}
                dataKey="count"
                color="hsl(var(--tsg-red))"
              />
              <LineChartCard
                title="XP Earned"
                data={xpSeries.map((d) => ({ date: formatDateKey(d.date), xp: d.xp ?? 0 }))}
                dataKey="xp"
                color="hsl(var(--tsg-green))"
              />
              <LineChartCard
                title="New Comments"
                data={commentsSeries.map((d) => ({ date: formatDateKey(d.date), count: d.count ?? 0 }))}
                dataKey="count"
                color="hsl(var(--tsg-navy))"
              />
            </div>
          </section>

          <section>
            <h2 className="mb-3 font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Distribution
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <PieChartCard title="Roles" data={roleDistData} />
              <PieChartCard title="Tournament Status" data={tournamentStatusData} />
              <BarChartCard
                title="Popular Cards (Holders)"
                data={popularCardsBar}
                dataKey="holders"
                color="hsl(var(--tsg-blue))"
              />
            </div>
          </section>

          <section>
            <h2 className="mb-3 font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Top XP Earners
            </h2>
            <Card className="glass border-border">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/30 text-left">
                        <th className="p-3 text-xs uppercase tracking-wider text-muted-foreground">Rank</th>
                        <th className="p-3 text-xs uppercase tracking-wider text-muted-foreground">User</th>
                        <th className="p-3 text-xs uppercase tracking-wider text-muted-foreground">XP Events</th>
                        <th className="p-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Total XP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(analytics?.topXpEarners ?? []).slice(0, 15).map((u, i) => (
                        <tr key={u.userId} className="border-b border-border/30 last:border-0">
                          <td className="p-3">
                            <Badge variant="outline" className="text-xs">{i + 1}</Badge>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2.5">
                              <Avatar className="h-7 w-7">
                                <AvatarImage src={u.userAvatarUrl ?? undefined} alt={u.userName ?? "User"} />
                                <AvatarFallback className="text-xs">
                                  {(u.userName ?? u.userUsername ?? "U").slice(0, 1).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span>{u.userName ?? u.userUsername ?? `#${u.userId}`}</span>
                            </div>
                          </td>
                          <td className="p-3">{u.xpEvents}</td>
                          <td className="p-3 text-right font-bold">{(u.xp ?? 0).toLocaleString()}</td>
                        </tr>
                      ))}
                      {(!analytics?.topXpEarners || analytics.topXpEarners.length === 0) && (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-muted-foreground">
                            No user data available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </section>

          <section>
            <h2 className="mb-3 font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Card Collection Activity
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              <LineChartCard
                title="Cards Granted Per Day"
                data={grantsSeries.map((d) => ({ date: formatDateKey(d.date), cards: d.cards ?? 0 }))}
                dataKey="cards"
                color="hsl(var(--tsg-orange))"
              />
              <BarChartCard
                title="Top Cards by Holders"
                data={popularCardsBar}
                dataKey="holders"
                color="hsl(var(--tsg-blue))"
              />
            </div>
          </section>
        </div>
      )}
    </AdminLayout>
  );
}
