import { Link } from "react-router";
import { MessageSquare, ArrowRight } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { PageLayout } from "@/components/PageLayout";
import { SectionHeading } from "@/components/SectionHeading";
import { timeAgo } from "@/lib/format";
import { UserAvatar } from "@/components/UserAvatar";
import { useNavigate } from "react-router";
import { AdDisplay } from "@/components/AdDisplay";

export default function Community() {
  const { data: latest, isLoading } = trpc.public.latestComments.useQuery();
  const { data: tournaments } = trpc.public.tournaments.useQuery({ status: "ongoing" });
  const navigate = useNavigate();

  return (
    <PageLayout>
      <div className="mx-auto max-w-4xl px-4 py-14 md:px-8">
        <SectionHeading
          kicker="Fans"
          title="TSG COMMUNITY"
          description="The conversation happens on each tournament page. Sign in to comment, reply, and react."
        />

        {(tournaments ?? []).length > 0 && (
          <div className="glass mb-10 rounded-xl p-5">
            <p className="text-sm font-semibold">Live discussion right now:</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(tournaments ?? []).map((t) => (
                <Link
                  key={t.id}
                  to={`/tournaments/${t.slug}`}
                  className="flex items-center gap-2 rounded-lg border border-[hsl(var(--tsg-red)/0.5)] bg-[hsl(var(--tsg-red)/0.1)] px-4 py-2 text-sm font-semibold text-[hsl(var(--tsg-red))] transition hover:bg-[hsl(var(--tsg-red)/0.2)]"
                >
                  <MessageSquare className="h-4 w-4" /> {t.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        <h2 className="mb-5 font-display text-lg font-bold tracking-widest">LATEST COMMENTS</h2>
        {isLoading && <p className="py-8 text-center text-muted-foreground">Loading...</p>}
        {!isLoading && (latest ?? []).length === 0 && (
          <p className="glass rounded-xl p-8 text-center text-sm text-muted-foreground">
            No comments yet. Be the first to share your thoughts on a tournament page.
          </p>
        )}
        <div className="space-y-3">
            {(latest ?? []).map((c) => (
              <article
                key={c.id}
                className="glass rounded-xl p-3 xs:p-4 cursor-pointer transition hover:border-[hsl(var(--tsg-blue)/0.5)]"
                onClick={() => navigate(`/tournaments/${c.tournamentSlug}`)}
              >
                <div className="flex items-center gap-2 text-sm xs:gap-2.5">
                  <UserAvatar src={c.userAvatar} name={c.userName} className="h-7 w-7 shrink-0" />
                  <span className="font-semibold truncate">
                    {c.userUsername ? (
                      <Link
                        to={`/fans/${c.userUsername}`}
                        className="hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c.userName ?? "TSG Fan"}
                      </Link>
                    ) : (
                      c.userName ?? "TSG Fan"
                    )}
                  </span>
                  <span className="hidden truncate text-xs text-muted-foreground xs:inline">on {c.tournamentName}</span>
                  <span className="ml-auto truncate text-xs text-muted-foreground">{timeAgo(c.createdAt)}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{c.content}</p>
                <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-[hsl(var(--tsg-blue))]">
                  Join the discussion <ArrowRight className="h-3 w-3" />
                </p>
              </article>
            ))}
        </div>
        <div className="mt-8">
          <AdDisplay placement="feed_bottom" page="community" />
        </div>
      </div>
    </PageLayout>
  );
}
