import { useState } from "react";
import { Link } from "react-router";
import { Radio, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { LiveBadge } from "@/components/LiveBadge";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Quick control room for tournaments that are live right now. */
export default function LiveAdmin() {
  const utils = trpc.useUtils();
  const { data: list, isLoading } = trpc.admin.listTournaments.useQuery(undefined, {
    refetchInterval: 20000,
  });
  const ongoing = (list ?? []).filter((t) => t.status === "ongoing");
  const upcoming = (list ?? []).filter((t) => t.status === "upcoming");

  const update = trpc.admin.upsertTournament.useMutation({
    onSuccess: () => {
      toast.success("Live settings saved.");
      utils.admin.listTournaments.invalidate();
      utils.public.live.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <AdminLayout title="Live Matches">
      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-bold tracking-widest">
              <LiveBadge /> LIVE NOW ({ongoing.length})
            </h2>
            {ongoing.length === 0 ? (
              <p className="glass rounded-xl p-6 text-center text-sm text-muted-foreground">
                No tournament is live. Set a tournament's status to “Ongoing” to make it appear here.
              </p>
            ) : (
              <div className="space-y-4">
                {ongoing.map((t) => (
                  <LiveCard
                    key={t.id}
                    tournament={t}
                    onSave={(yt, ig) =>
                      update.mutate({
                        id: t.id,
                        teamId: t.teamId ?? 0,
                        name: t.name,
                        status: "ongoing",
                        numberOfMatches: t.numberOfMatches,
                        youtubeLiveUrl: yt || null,
                        instagramLiveUrl: ig || null,
                      })
                    }
                    onEnd={() =>
                      update.mutate({
                        id: t.id,
                        teamId: t.teamId ?? 0,
                        name: t.name,
                        status: "completed",
                        numberOfMatches: t.numberOfMatches,
                      })
                    }
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 font-display text-sm font-bold tracking-widest text-muted-foreground">
              READY TO GO LIVE
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming tournaments.</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map((t) => (
                  <div key={t.id} className="glass flex flex-wrap items-center gap-3 rounded-xl p-4">
                    <p className="min-w-0 flex-1 truncate font-semibold">{t.name}</p>
                    <Button
                      size="sm"
                      className="gap-1.5 bg-[hsl(var(--tsg-red))] hover:bg-[hsl(var(--tsg-red)/0.85)]"
                      onClick={() =>
                        update.mutate({
                          id: t.id,
                          teamId: t.teamId ?? 0,
                          name: t.name,
                          status: "ongoing",
                          numberOfMatches: t.numberOfMatches,
                        })
                      }
                    >
                      <Radio className="h-4 w-4" /> Go Live
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </AdminLayout>
  );
}

function LiveCard({
  tournament: t,
  onSave,
  onEnd,
}: {
  tournament: {
    id: number;
    name: string;
    youtubeLiveUrl: string | null;
    instagramLiveUrl: string | null;
  };
  onSave: (yt: string, ig: string) => void;
  onEnd: () => void;
}) {
  const [yt, setYt] = useState(t.youtubeLiveUrl ?? "");
  const [ig, setIg] = useState(t.instagramLiveUrl ?? "");
  return (
    <div className="glass rounded-xl border-[hsl(var(--tsg-red)/0.35)] p-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 truncate font-display font-bold">{t.name}</p>
        <Link to={`/admin/tournaments/${t.id}`}>
          <Button size="sm" variant="outline" className="gap-1.5">
            <Settings2 className="h-4 w-4" /> Matches
          </Button>
        </Link>
        <Button
          size="sm"
          variant="outline"
          className="text-[hsl(var(--tsg-red))]"
          onClick={onEnd}
        >
          End Tournament
        </Button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">YouTube Live URL</Label>
          <Input className="mt-1 h-11" value={yt} onChange={(e) => setYt(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
        </div>
        <div>
          <Label className="text-xs">Instagram Live URL</Label>
          <Input className="mt-1 h-11" value={ig} onChange={(e) => setIg(e.target.value)} placeholder="https://instagram.com/..." />
        </div>
      </div>
      <Button
        size="sm"
        className="mt-3 bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]"
        onClick={() => onSave(yt, ig)}
      >
        Save Live Links
      </Button>
    </div>
  );
}
