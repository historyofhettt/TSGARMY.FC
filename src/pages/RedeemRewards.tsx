import { useState } from "react";
import { Gift } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { PageLayout } from "@/components/PageLayout";
import type { RouterOutputs } from "@contracts/types";

type Reward = RouterOutputs["public"]["activeRewards"][number];
type Redemption = RouterOutputs["user"]["myRedemptions"][number];

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  processing: "Processing",
  completed: "Completed",
  rejected: "Rejected",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400",
  approved: "bg-blue-500/20 text-blue-400",
  processing: "bg-purple-500/20 text-purple-400",
  completed: "bg-green-500/20 text-green-400",
  rejected: "bg-red-500/20 text-red-400",
};

export default function RedeemRewards() {
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  const { data: rewards, isLoading, error } = trpc.public.activeRewards.useQuery({});

  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [instagramUsername, setInstagramUsername] = useState("");
  const [discordUsername, setDiscordUsername] = useState("");

  const redeemMutation = trpc.public.redeemReward.useMutation({
    onSuccess: (data) => {
      toast.success(`Redemption submitted! Your remaining XP: ${data.remainingXp}`, {
        duration: 5000,
      });
      setSelectedReward(null);
      setContactOpen(false);
      setInstagramUsername("");
      setDiscordUsername("");
      utils.public.activeRewards.invalidate();
      void utils.auth.me.invalidate();
    },
    onError: (e: { message?: string }) => {
      console.error("Redeem error:", e);
      toast.error(e.message ?? "Failed to redeem.", { duration: 5000 });
    },
  });

  const handleRedeemClick = (reward: Reward) => {
    if (!isAuthenticated || !user) {
      toast("Login required", { description: "Please log in to redeem rewards." });
      return;
    }
    setSelectedReward(reward);
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    setConfirmOpen(false);
    setContactOpen(true);
  };

  const handleSubmit = () => {
    const ig = instagramUsername.trim().replace(/^@/, "");
    const dc = discordUsername.trim().replace(/^@/, "");
    if (!ig && !dc) {
      toast.error("Please provide at least an Instagram or Discord username.");
      return;
    }
    if (!selectedReward) return;
    redeemMutation.mutate({
      rewardId: selectedReward.id,
      instagramUsername: ig || undefined,
      discordUsername: dc || undefined,
    });
  };

  if (isLoading) {
    return (
      <PageLayout>
        <div className="max-w-4xl mx-auto py-12 text-center text-muted-foreground">
          Loading rewards...
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout>
        <div className="max-w-4xl mx-auto py-12">
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
            <p className="font-medium">Failed to load rewards</p>
            <p className="text-sm">{error.message}</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="max-w-6xl mx-auto py-12">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-bold text-foreground">Redeem Rewards</h1>
          <p className="mt-2 text-muted-foreground">
            Use your XP to claim exclusive rewards from the TSG community.
          </p>
          {isAuthenticated && user && (
            <p className="mt-2 text-sm text-[hsl(var(--tsg-blue))]">
              Your XP: <strong>{user.xp ?? 0}</strong>
            </p>
          )}
        </div>

        {!rewards || rewards.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Gift className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p>No rewards are currently available. Check back later!</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rewards.map((reward) => (
              <Card key={reward.id} className="flex flex-col">
                {reward.photoUrl ? (
                  <div className="aspect-video w-full overflow-hidden rounded-t-lg">
                    <img src={reward.photoUrl} alt={reward.name} className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="aspect-video w-full bg-muted flex items-center justify-center rounded-t-lg">
                    <Gift className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{reward.name}</CardTitle>
                    <Badge variant="outline">{reward.category}</Badge>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {reward.description ?? "No description available."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-2xl font-bold text-[hsl(var(--tsg-blue))]">{reward.xpCost} XP</span>
                    <span className={`text-xs ${reward.availableStock > 0 ? "text-green-400" : "text-red-400"}`}>
                      {reward.availableStock > 0 ? `${reward.availableStock} left` : "Out of stock"}
                    </span>
                  </div>
                  <Button
                    className="w-full"
                    disabled={
                      !isAuthenticated ||
                      (user?.xp ?? 0) < reward.xpCost ||
                      reward.availableStock <= 0
                    }
                    onClick={() => handleRedeemClick(reward)}
                  >
                    Redeem
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {user && <RecentRedemptions userId={user.id} />}

        {/* Confirmation Dialog */}
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="glass-strong border-border">
            <DialogHeader>
              <DialogTitle>Confirm Redemption</DialogTitle>
              <DialogDescription>
                {selectedReward && (
                  <>
                    You are about to redeem <strong>{selectedReward.name}</strong> for{" "}
                    <strong>{selectedReward.xpCost} XP</strong>.
                    <br />
                    <br />
                    Your current XP: <strong>{user?.xp ?? 0}</strong>
                    <br />
                    Remaining after redemption: <strong>{(user?.xp ?? 0) - (selectedReward?.xpCost ?? 0)}</strong>
                    <br />
                    <br />
                    After confirming, you will need to provide your Instagram and/or Discord username for delivery.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                No, Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                className="bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]"
              >
                Yes, Continue
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Contact Form Dialog */}
        <Dialog open={contactOpen} onOpenChange={setContactOpen}>
          <DialogContent className="glass-strong border-border max-w-md">
            <DialogHeader>
              <DialogTitle>Contact Info</DialogTitle>
              <DialogDescription>
                Please provide your Instagram and/or Discord username so we can deliver your reward.
                At least one is required.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="instagram">Instagram Username</Label>
                <Input
                  id="instagram"
                  placeholder="e.g. myusername"
                  value={instagramUsername}
                  onChange={(e) => setInstagramUsername(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="discord">Discord Username</Label>
                <Input
                  id="discord"
                  placeholder="e.g. myusername#1234"
                  value={discordUsername}
                  onChange={(e) => setDiscordUsername(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setContactOpen(false)} disabled={redeemMutation.isPending}>
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={redeemMutation.isPending}
                className="bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]"
              >
                {redeemMutation.isPending ? "Processing..." : "Submit Redemption"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageLayout>
  );
}

function RecentRedemptions({ userId }: { userId: number }) {
  const { data: redemptions } = trpc.user.myRedemptions.useQuery(undefined, { enabled: !!userId });

  if (!redemptions || redemptions.length === 0) {
    return null;
  }

  return (
    <div className="mt-12">
      <h2 className="text-lg font-bold mb-4">Your Redemptions</h2>
      <div className="space-y-2">
        {redemptions.map((r: Redemption) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <span className="font-medium">{r.rewardName}</span>
              <span className="text-xs text-muted-foreground"> — {r.xpSpent} XP</span>
            </div>
            <Badge className={STATUS_COLORS[r.status] ?? "bg-muted"}>
              {STATUS_LABELS[r.status] ?? r.status}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
