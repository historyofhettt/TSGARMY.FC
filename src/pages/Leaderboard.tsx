import { Trophy, Crown } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { PageLayout } from "@/components/PageLayout";
import { Link } from "react-router";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/UserAvatar";
import { AdDisplay } from "@/components/AdDisplay";

const RANK_STYLES: Record<number, string> = {
  1: "border-[hsl(var(--tsg-red))] text-[hsl(var(--tsg-red))]",
  2: "border-[hsl(var(--tsg-blue))] text-[hsl(var(--tsg-blue))]",
  3: "border-emerald-400 text-emerald-400",
};

export default function Leaderboard() {
  const { data, isLoading } = trpc.public.leaderboard.useQuery();

  return (
    <PageLayout>
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background/40">
            <Crown className="h-5 w-5 text-[hsl(var(--tsg-blue))]" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-black tracking-wide">FAN LEADERBOARD</h1>
            <p className="text-xs text-muted-foreground">Top fans ranked by XP</p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-center text-muted-foreground">Loading leaderboard...</p>
        ) : !data || data.length === 0 ? (
          <p className="text-center text-muted-foreground">No fans on the leaderboard yet.</p>
        ) : (
          <div className="space-y-3">
            {data.map((u, idx) => {
              const rank = idx + 1;
              const isTop = rank <= 3;
              return (
                <div
                  key={u.id}
                  className={cn(
                    "glass flex items-center gap-4 rounded-xl border border-border p-4 transition-all duration-300 hover:border-[hsl(var(--tsg-blue)/0.5)]",
                    isTop && "border-[hsl(var(--tsg-blue)/0.35)] bg-[hsl(var(--tsg-blue)/0.06)]",
                  )}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                    {isTop ? (
                      <span className={cn("flex h-8 w-8 items-center justify-center rounded-full border text-sm font-black", RANK_STYLES[rank])}>
                        {rank}
                      </span>
                    ) : (
                      <span className="text-sm font-bold text-muted-foreground">#{rank}</span>
                    )}
                  </div>
                  <div className="flex flex-1 items-center gap-3 min-w-0">
                   <Link to={`/fans/${u.username}`} className="flex items-center gap-3 min-w-0 -ml-3">
                      <UserAvatar src={u.avatarUrl} name={u.name} username={u.username ?? undefined} className="h-10 w-10" />
                     <div className="min-w-0 flex-1">
                       <span className="font-display font-bold block hover:underline">
                         {u.name ?? u.username}
                       </span>
                       {u.username && u.name && u.name !== u.username && (
                         <p className="text-xs text-muted-foreground">@{u.username}</p>
                       )}
                     </div>
                     </Link>
                   </div>
                  <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background/40 px-3 py-1.5">
                    <Trophy className="h-4 w-4 text-[hsl(var(--tsg-blue))]" />
                    <span className="font-display text-lg font-black text-[hsl(var(--tsg-blue))]">{u.xp.toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground">XP</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="mt-8">
        <AdDisplay placement="sidebar" page="leaderboard" />
      </div>
    </PageLayout>
  );
}
