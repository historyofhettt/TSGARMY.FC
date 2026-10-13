import { useState } from "react";
import { PageLayout } from "@/components/PageLayout";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, ExternalLink, Loader2, Trophy, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface XpTask {
  id: number;
  title: string;
  description: string | null;
  actionUrl: string | null;
  xpReward: number;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
}

export default function Tasks() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const utils = trpc.useUtils();

  const { data: tasks, isLoading, isError, error } = trpc.public.listXpTasks.useQuery();

  const completeMutation = trpc.user.completeXpTask.useMutation({
    onSuccess: (data) => {
      toast.success(`Task completed! +${data.xpAwarded} XP`);
      utils.public.listXpTasks.invalidate();
      utils.user.myXpHistory.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const [completedTasks, setCompletedTasks] = useState<Set<number>>(new Set());
  const [viewedTasks, setViewedTasks] = useState<Set<number>>(new Set());

  if (authLoading) {
    return (
      <PageLayout>
        <div className="mx-auto max-w-3xl py-16 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[hsl(var(--tsg-blue))]" />
          <p className="mt-4">Verifying access...</p>
        </div>
      </PageLayout>
    );
  }

  if (isLoading) {
    return (
      <PageLayout>
        <div className="mx-auto max-w-3xl py-16 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[hsl(var(--tsg-blue))]" />
          <p className="mt-4">Loading tasks...</p>
        </div>
      </PageLayout>
    );
  }

  if (isError || !tasks) {
    return (
      <PageLayout>
        <div className="mx-auto max-w-3xl py-16 text-center">
          <p className="text-[hsl(var(--tsg-red))]">
            Failed to load tasks: {error?.message ?? "Unknown error"}
          </p>
        </div>
      </PageLayout>
    );
  }

  const activeTasks = tasks.filter((t: XpTask) => t.isActive);

  return (
    <PageLayout>
      <div className="mx-auto max-w-3xl py-12 px-4">
        <div className="text-center mb-10">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--tsg-red)/0.15)]">
            <Trophy className="h-8 w-8 text-[hsl(var(--tsg-red))]" />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight">XP TASKS</h1>
          <p className="text-muted-foreground mt-2">
            Complete one-time tasks to earn bonus XP!
          </p>
          {!isAuthenticated && (
            <p className="text-[hsl(var(--tsg-blue))] text-sm mt-3">
              <a href="/login" className="underline hover:text-[hsl(var(--tsg-blue)/0.7)]">Sign in</a> to complete tasks and earn XP.
            </p>
          )}
        </div>

        {activeTasks.length === 0 ? (
          <Card className="glass text-center py-12">
            <CardContent>
              <Trophy className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-display text-lg font-bold mb-2">No Tasks Available</h3>
              <p className="text-muted-foreground">Check back later for new XP tasks!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {activeTasks.map((task: XpTask) => {
              const isCompleted = completedTasks.has(task.id);
              const isViewed = viewedTasks.has(task.id);
              const isProcessing = completeMutation.isPending && completeMutation.variables?.taskId === task.id;

              const handleViewTask = () => {
                if (task.actionUrl) {
                  window.open(task.actionUrl, "_blank", "noopener,noreferrer");
                  setViewedTasks((prev) => new Set(prev).add(task.id));
                }
              };

              const handleComplete = async () => {
                if (!isAuthenticated) {
                  toast.error("Please sign in to complete tasks.");
                  return;
                }
                await completeMutation.mutateAsync({ taskId: task.id });
                setCompletedTasks((prev) => new Set(prev).add(task.id));
              };

              return (
                <Card key={task.id} className={cn("glass overflow-hidden transition-all", isCompleted && "opacity-60")}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{task.title}</CardTitle>
                        {task.description && (
                          <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="gap-1.5 px-3 py-1 flex-shrink-0">
                        <Trophy className="h-3 w-3" />
                        +{task.xpReward} XP
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                   <div className="flex flex-wrap items-center gap-3">
                      {task.actionUrl && !isCompleted && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleViewTask}
                          className="h-9"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          VIEW TASK
                        </Button>
                      )}

                      {isCompleted ? (
                        <Button
                          variant="default"
                          disabled
                          className="h-9 bg-[hsl(var(--tsg-green))] hover:bg-[hsl(var(--tsg-green)/0.85)]"
                        >
                          <CheckCircle className="h-4 w-4" />
                          COMPLETED
                        </Button>
                      ) : !isAuthenticated ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                          className="h-9"
                        >
                          <AlertCircle className="h-3.5 w-3.5" />
                          SIGN IN TO COMPLETE
                        </Button>
                      ) : (
                        <Button
                          onClick={handleComplete}
                          disabled={!isViewed || isProcessing}
                          className="h-9 bg-[hsl(var(--tsg-red))] hover:bg-[hsl(var(--tsg-red)/0.85)]"
                        >
                          {isProcessing ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              COMPLETING...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4" />
                              COMPLETE TASK
                            </>
                          )}
                        </Button>
                      )}

                      {isCompleted && (
                        <Badge variant="default" className="bg-[hsl(var(--tsg-green))] text-[hsl(var(--tsg-green-foreground))]">
                          <CheckCircle className="h-3 w-3" />
                          Done
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PageLayout>
  );
}