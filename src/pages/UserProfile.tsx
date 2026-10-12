import { useParams, Link } from "react-router";
import { ArrowLeft, Trophy } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { SectionHeading } from "@/components/SectionHeading";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { initials } from "@/lib/format";

export default function UserProfile() {
  const { username } = useParams<{ username: string }>();
  const { data, isLoading, error } = trpc.user.getProfile.useQuery(
    { username: username ?? "" },
    { enabled: !!username },
  );

  if (isLoading) {
    return (
      <PageLayout>
        <div className="mx-auto max-w-3xl px-4 py-20 md:px-8">
          <p className="text-center text-muted-foreground">Loading profile...</p>
        </div>
      </PageLayout>
    );
  }

  if (error || !data?.user) {
    return (
      <PageLayout>
        <div className="mx-auto max-w-3xl px-4 py-20 md:px-8">
          <p className="text-center text-muted-foreground">User not found.</p>
          <div className="mt-4 text-center">
            <Button variant="outline" asChild>
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" /> Go Home
              </Link>
            </Button>
          </div>
        </div>
      </PageLayout>
    );
  }

  const user = data.user as typeof data.user & { xpVisible?: boolean };
  const displayName = user.name ?? user.username ?? "User";
  const avatarUrl = user.avatarUrl ?? null;

  return (
    <PageLayout>
      <div className="mx-auto max-w-3xl px-4 py-10 md:px-8">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Link>
        </Button>

        <div className="glass overflow-hidden rounded-2xl border border-border">
          <div className="relative h-32 bg-gradient-to-r from-[hsl(var(--tsg-blue)/0.25)] to-[hsl(var(--tsg-red)/0.25)]" />

          <div className="px-6 pb-8 md:px-10">
            <div className="relative -mt-16 mb-4 flex items-end gap-4">
              <Avatar className="h-28 w-28 border-4 border-background text-4xl">
                <AvatarImage src={avatarUrl ?? undefined} alt={displayName} />
                <AvatarFallback className="font-display font-bold text-[hsl(var(--tsg-blue))]">
                  {initials(displayName)}
                </AvatarFallback>
              </Avatar>

              <div className="mb-1 flex-1 min-w-0">
                <h1 className="truncate font-display text-2xl font-black tracking-wide">
                  {displayName}
                </h1>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  @{user.username}
                </p>
              </div>
            </div>

            <SectionHeading kicker="About" title="BIOGRAPHY" />
            {user.bio ? (
              <p className="max-w-2xl whitespace-pre-wrap leading-relaxed text-muted-foreground">
                {user.bio}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">This user hasn&apos;t written a bio yet.</p>
            )}

            {(user as { xpVisible?: boolean }).xpVisible && (
              <div className="pt-4">
                <SectionHeading kicker="Stats" title="EXPERIENCE" />
                <div className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3">
                  <Trophy className="h-5 w-5 text-[hsl(var(--tsg-blue))]" />
                  <span className="font-display text-xl font-black text-[hsl(var(--tsg-blue))]">
                    {(user.xp ?? 0).toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">XP</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
