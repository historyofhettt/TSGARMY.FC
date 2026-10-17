import { PageLayout } from "@/components/PageLayout";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/UserAvatar";
import { Crown, Trophy, Calendar, Loader2, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface WeeklyTopFanHistoryRecord {
  id: number;
  weekStart: Date;
  weekEnd: Date;
  userId: number;
  userName: string | null;
  userUsername: string | null;
  userAvatar: string | null;
  userXp: number;
  userAvatarUrl: string | null;
  createdAt: Date;
}

export default function WeeklyTopFan() {
  const { data: currentTopFan, isLoading: currentLoading, isError: currentError } = trpc.public.weeklyTopFan.useQuery();
  const { data: history, isLoading: historyLoading, isError: historyError } = trpc.public.weeklyTopFanHistory.useQuery();

  if (currentLoading || historyLoading) {
    return (
      <PageLayout>
        <div className="mx-auto max-w-3xl py-16 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[hsl(var(--tsg-blue))]" />
          <p className="mt-4">Loading weekly top fan data...</p>
        </div>
      </PageLayout>
    );
  }

  if (currentError || historyError) {
    return (
      <PageLayout>
        <div className="mx-auto max-w-3xl py-16 text-center">
          <p className="text-[hsl(var(--tsg-red))]">
            Failed to load data
          </p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="mx-auto max-w-3xl py-12 px-4">
        <div className="text-center mb-10">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[hsl(var(--tsg-blue))/0.2] to-[hsl(var(--tsg-red))/0.2]">
            <Crown className="h-8 w-8 text-[hsl(var(--tsg-blue))]" />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight">WEEKLY TOP FAN</h1>
          <p className="text-muted-foreground mt-2">
            The fan with the most XP earned this week
          </p>
        </div>

        {/* Current Top Fan */}
        <Card className="mb-8 glass border-[hsl(var(--tsg-blue)/0.3)] bg-gradient-to-r from-[hsl(var(--tsg-blue)/0.1)] to-[hsl(var(--tsg-red)/0.05)]">
          <CardHeader className="pb-2 border-b border-[hsl(var(--tsg-blue)/0.2)]">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-[hsl(var(--tsg-blue))]" />
                THIS WEEK'S TOP FAN
              </CardTitle>
              {currentTopFan && (
                <Badge variant="default" className="bg-[hsl(var(--tsg-blue))]">
                  <TrendingUp className="h-3 w-3" />
                  #{currentTopFan.userXp} XP
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {currentTopFan && currentTopFan.user ? (
              <div className="flex flex-col md:flex-row items-center gap-6">
                  <UserAvatar src={currentTopFan.user.avatarUrl} name={currentTopFan.user.name} size="xl" className="flex-shrink-0" />
                <div className="flex-1 text-center md:text-left">
                  <h2 className="font-display text-2xl font-bold">{currentTopFan.user.name ?? "Unknown"}</h2>
                  {currentTopFan.user.username && (
                    <p className="text-muted-foreground">@{currentTopFan.user.username}</p>
                  )}
                  <div className="mt-4 flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm">
                    <Badge variant="outline" className="gap-1.5 px-3 py-1.5">
                      <Trophy className="h-3 w-3" />
                      <span className="font-bold text-[hsl(var(--tsg-blue))]">{currentTopFan.userXp}</span> XP this week
                    </Badge>
                    <Badge variant="outline" className="gap-1.5 px-3 py-1.5">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(currentTopFan.weekStart), "MMM d")} - {format(new Date(currentTopFan.weekEnd), "MMM d, yyyy")}
                    </Badge>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Crown className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-display text-lg font-bold mb-2">No Top Fan Yet</h3>
                <p className="text-muted-foreground">Be the first to earn XP this week!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Historical Winners */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold tracking-widest">HALL OF FAME</h2>
            <Badge variant="outline" className="gap-1.5 px-3 py-1">
              <Calendar className="h-3 w-3" />
              {history?.length ?? 0} weeks
            </Badge>
          </div>

          {history && history.length > 0 ? (
            <div className="space-y-3">
              {history.map((record: WeeklyTopFanHistoryRecord, index: number) => (
                <Card key={record.id} className="glass hover:border-[hsl(var(--tsg-blue)/0.3)] transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0 w-10 text-center">
                        <span className={cn(
                          "font-display font-bold",
                          index === 0 ? "text-2xl text-amber-400" :
                          index === 1 ? "text-xl text-gray-400" :
                          index === 2 ? "text-lg text-amber-700" :
                          "text-muted-foreground"
                        )}>
                          #{index + 1}
                        </span>
                      </div>
                      <div className="relative">
                        <UserAvatar src={record.userAvatarUrl} name={record.userName} className="h-10 w-10 flex-shrink-0" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{record.userName ?? "Unknown"}</p>
                        {record.userUsername && (
                          <p className="text-[11px] text-muted-foreground truncate">@{record.userUsername}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-right flex-shrink-0">
                        <Badge variant="outline" className="gap-1.5 px-2.5 py-1">
                          <Trophy className="h-3 w-3" />
                          <span className="font-bold">{record.userXp}</span> XP
                        </Badge>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(record.weekStart), "MMM d, yyyy")}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="glass text-center py-8">
              <CardContent>
                <Trophy className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-display text-lg font-bold mb-2">No History Yet</h3>
                <p className="text-muted-foreground">Weekly winners will appear here.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageLayout>
  );
}