import { useState } from "react";
import { PageLayout } from "@/components/PageLayout";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2, Trophy, Brain } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface QuizQuestion {
  id: number;
  question: string;
  xpReward: number;
  cardRewardId?: number | null;
  cardRewardName?: string | null;
  cardRewardImageUrl?: string | null;
  options: Array<{
    id: number;
    text: string;
    isCorrect: boolean;
    displayOrder: number;
  }>;
}

export default function Quiz() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const utils = trpc.useUtils();

  const { data: questions, isLoading, isError, error } = trpc.public.listQuizQuestions.useQuery();

  const submitMutation = trpc.user.submitQuizAttempt.useMutation({
    onSuccess: (data) => {
      if (data.isCorrect) {
        const msgs = [];
        if (data.xpAwarded > 0) msgs.push(`+${data.xpAwarded} XP`);
        if (data.cardGranted) msgs.push("Card reward earned!");
        toast.success(`Correct! ${msgs.join(" · ")}`);
      } else {
        toast.error("Incorrect answer. No XP awarded.");
      }
      utils.user.myXpHistory.invalidate();
      utils.user.myAchievements.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const [answeredQuestions, setAnsweredQuestions] = useState<Record<number, { optionId: number; isCorrect: boolean; xpAwarded: number; cardGranted?: boolean }>>({});

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
          <p className="mt-4">Loading quiz questions...</p>
        </div>
      </PageLayout>
    );
  }

  if (isError || !questions) {
    return (
      <PageLayout>
        <div className="mx-auto max-w-3xl py-16 text-center">
          <p className="text-[hsl(var(--tsg-red))]">
            Failed to load quiz: {error?.message ?? "Unknown error"}
          </p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="mx-auto max-w-3xl py-12 px-4">
        <div className="text-center mb-10">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--tsg-blue)/0.15)]">
            <Brain className="h-8 w-8 text-[hsl(var(--tsg-blue))]" />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight">TSG QUIZ</h1>
          <p className="text-muted-foreground mt-2">
            Test your TSG knowledge and earn XP for correct answers!
          </p>
          {!isAuthenticated && (
            <p className="text-[hsl(var(--tsg-blue))] text-sm mt-3">
              <a href="/login" className="underline hover:text-[hsl(var(--tsg-blue)/0.7)]">Sign in</a> to submit answers and earn XP.
            </p>
          )}
        </div>

        {questions.length === 0 ? (
          <Card className="glass text-center py-12">
            <CardContent>
              <Trophy className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-display text-lg font-bold mb-2">No Questions Available</h3>
              <p className="text-muted-foreground">Check back later for new quiz questions!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {questions.map((question: QuizQuestion) => {
              const answered = answeredQuestions[question.id];
              const correctOption = question.options.find((o) => o.isCorrect);

              return (
                <Card key={question.id} className="glass overflow-hidden">
                  <CardHeader className="pb-2">
                       <div className="flex items-center justify-between gap-4">
                       <CardTitle className="text-lg">{question.question}</CardTitle>
                       <div className="flex gap-1.5">
                         {question.xpReward > 0 && (
                           <Badge variant="outline" className="gap-1.5 px-3 py-1">
                             <Trophy className="h-3 w-3" />
                             +{question.xpReward} XP
                           </Badge>
                         )}
                         {question.cardRewardId && (
                           <Badge variant="outline" className="gap-1.5 px-3 py-1 border-purple-500/50 text-purple-400">
                             <Trophy className="h-3 w-3" />
                             Card: {question.cardRewardName}
                           </Badge>
                         )}
                       </div>
                     </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {question.options.map((option) => {
                        const isSelected = answered?.optionId === option.id;
                        const showResult = !!answered;
                        const isCorrectOption = option.isCorrect;
                        const isWrongSelection = isSelected && !isCorrectOption;

                        return (
                          <Button
                            key={option.id}
                            variant={showResult
                              ? isCorrectOption
                                ? "default"
                                : isWrongSelection
                                ? "destructive"
                                : "outline"
                              : "outline"}
                            disabled={showResult || submitMutation.isPending}
                            className={cn(
                              "h-auto p-4 text-left justify-start gap-3",
                              "border-2 transition-all",
                              showResult && isCorrectOption
                                ? "bg-[hsl(var(--tsg-green)/0.15)] border-[hsl(var(--tsg-green)/0.4)] text-[hsl(var(--tsg-green))]"
                                : showResult && isWrongSelection
                                ? "bg-[hsl(var(--tsg-red)/0.15)] border-[hsl(var(--tsg-red)/0.4)] text-[hsl(var(--tsg-red))]"
                                : "hover:border-[hsl(var(--tsg-blue)/0.6)] hover:bg-[hsl(var(--tsg-blue)/0.05)]"
                            )}
                            onClick={() => {
                              if (!isAuthenticated) {
                                toast.error("Please sign in to submit answers.");
                                return;
                              }
                              if (answered) return;
                              submitMutation.mutate(
                                { questionId: question.id, optionId: option.id },
                                {
                           onSuccess: (data) => {
                             setAnsweredQuestions((prev) => ({
                               ...prev,
                               [question.id]: {
                                 optionId: option.id,
                                 isCorrect: data.isCorrect,
                                 xpAwarded: data.xpAwarded,
                                 cardGranted: data.cardGranted,
                               },
                             }));
                           },
                                }
                              );
                            }}
                          >
                            <span className="flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-sm">
                              {showResult && isCorrectOption ? (
                                <CheckCircle className="h-4 w-4 text-[hsl(var(--tsg-green))]" />
                              ) : showResult && isWrongSelection ? (
                                <XCircle className="h-4 w-4 text-[hsl(var(--tsg-red))]" />
                              ) : (
                                String.fromCharCode(65 + option.displayOrder)
                              )}
                            </span>
                            <span className="flex-1">{option.text}</span>
                            {showResult && isCorrectOption && (
                              <span className="text-xs font-bold text-[hsl(var(--tsg-green))]">CORRECT</span>
                            )}
                            {showResult && isWrongSelection && (
                              <span className="text-xs font-bold text-[hsl(var(--tsg-red))]">WRONG</span>
                            )}
                          </Button>
                        );
                      })}
                    </div>

                    {answered && (
                      <div className="mt-4 p-3 rounded-lg bg-[hsl(var(--tsg-blue)/0.05)] border border-[hsl(var(--tsg-blue)/0.2)]">
                        <p className="text-sm">
                          <strong>Correct answer:</strong>{" "}
                          {correctOption ? correctOption.text : "N/A"}
                        </p>
                        {answered.isCorrect && answered.xpAwarded > 0 && (
                           <p className="text-sm font-semibold text-[hsl(var(--tsg-green))] mt-1">
                             +{answered.xpAwarded} XP earned!
                           </p>
                         )}
                         {answered.isCorrect && answered.cardGranted && (
                           <p className="text-sm font-semibold text-purple-400 mt-1">
                             Card reward earned!
                           </p>
                         )}
                         {!answered.isCorrect && (
                           <p className="text-sm text-[hsl(var(--tsg-red))] mt-1">No XP awarded.</p>
                         )}
                      </div>
                    )}

                    {!answered && !isAuthenticated && (
                      <p className="mt-3 text-center text-xs text-muted-foreground">
                        Sign in to submit your answer
                      </p>
                    )}
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