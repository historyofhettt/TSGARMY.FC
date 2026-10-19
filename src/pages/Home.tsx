import { lazy, Suspense } from "react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import { ArrowRight, Instagram, Youtube, MessageCircle, Globe } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { PageLayout } from "@/components/PageLayout";
import { SectionHeading } from "@/components/SectionHeading";
import { TeamCard } from "@/components/cards/TeamCard";
import { PlayerCard } from "@/components/cards/PlayerCard";
import { OwnerCard, LegendCard } from "@/components/cards/OwnerCard";
import { TournamentCard } from "@/components/cards/TournamentCard";
import { LiveBadge } from "@/components/LiveBadge";
import { AdDisplay } from "@/components/AdDisplay";

const HeroScene = lazy(() => import("@/components/3d/HeroScene"));

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease: "easeOut" as const },
};

export default function Home() {
  const { data: org } = trpc.public.org.useQuery();
  const { data: teamList } = trpc.public.teams.useQuery();
  const { data: people } = trpc.public.people.useQuery();
  const { data: live } = trpc.public.live.useQuery(undefined, { refetchInterval: 30000 });
  const { data: playersList } = trpc.public.players.useQuery();
  const { data: tournaments } = trpc.public.tournaments.useQuery();

  const owners = (people ?? []).filter((p) => p.kind === "owner");
  const legend = (people ?? []).find((p) => p.kind === "legend");
  const featured = (playersList ?? []).filter((p) => p.status === "active").slice(0, 5);
  const upcoming = (tournaments ?? []).filter((t) => t.status === "upcoming").slice(0, 3);

  return (
    <PageLayout>
      {/* ------------------------------------------------------------ HERO */}
      <section className="relative flex min-h-[92vh] items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-grid" />
        <div className="absolute inset-0 bg-radial-fade" />
        <Suspense fallback={null}>
          <HeroScene />
        </Suspense>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />

        <div className="relative z-10 px-4 text-center">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-4 text-xs font-bold tracking-[0.5em] text-[hsl(var(--tsg-blue))] text-glow-blue"
          >
            {org?.orgName?.toUpperCase() ?? "TWO SIDE GAMERS"}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.25, duration: 0.7 }}
            className="font-display text-6xl font-black tracking-[0.08em] md:text-8xl lg:text-9xl"
          >
            <span className="bg-gradient-to-r from-[hsl(var(--tsg-blue))] via-foreground to-[hsl(var(--tsg-red))] bg-clip-text text-transparent">
              {org?.shortName ?? "TSG"}
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-3 font-display text-sm font-semibold tracking-[0.4em] text-muted-foreground md:text-base"
          >
            ESPORTS
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
            className="mx-auto mt-5 max-w-xl text-base text-muted-foreground md:text-lg"
          >
            {org?.tagline ?? "Built for Competition. Driven by Legacy."}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Link
              to="/teams/tsg-army"
              className="w-full rounded-lg border border-[hsl(var(--tsg-blue)/0.6)] bg-[hsl(var(--tsg-blue)/0.12)] px-7 py-3 font-display text-sm font-bold tracking-[0.15em] text-[hsl(var(--tsg-blue))] transition hover:bg-[hsl(var(--tsg-blue)/0.25)] hover:glow-blue sm:w-auto"
            >
              EXPLORE TSG PROS
            </Link>
            <Link
              to="/teams/tsg-artemis"
              className="w-full rounded-lg border border-[hsl(var(--tsg-red)/0.6)] bg-[hsl(var(--tsg-red)/0.12)] px-7 py-3 font-display text-sm font-bold tracking-[0.15em] text-[hsl(var(--tsg-red))] transition hover:bg-[hsl(var(--tsg-red)/0.25)] hover:glow-red sm:w-auto"
            >
              EXPLORE TSG ARTEMIS
            </Link>
          </motion.div>
        </div>
      </section>

      {/* -------------------------------------------------------- LIVE NOW */}
      <section className="mx-auto max-w-7xl px-4 md:px-8" aria-label="Live tournaments">
        {live && live.length > 0 ? (
          <motion.div {...fadeUp} className="glass relative -mt-10 overflow-hidden rounded-2xl p-4 xs:p-6 md:p-8">
            <div className="absolute -left-10 top-0 h-full w-40 bg-[hsl(var(--tsg-red)/0.08)] blur-2xl" />
            <div className="relative flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <LiveBadge label="LIVE NOW" className="text-xs xs:text-sm" />
              </div>
              {live.map((t) => (
                <div key={t.id} className="flex flex-col gap-3 xs:flex-row xs:items-center xs:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-lg font-bold">{t.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {t.team?.name} ·{" "}
                      {t.currentMatch
                        ? `Match ${t.currentMatch.matchNumber} / ${t.numberOfMatches}${t.currentMatch.mapName ? ` · ${t.currentMatch.mapName}` : ""}`
                        : `${t.numberOfMatches} matches`}
                    </p>
                  </div>
                  <Link
                    to={`/tournaments/${t.slug}`}
                    className="w-full shrink-0 xs:w-auto"
                  >
                    <span className="inline-flex items-center justify-center gap-2 rounded-lg bg-[hsl(var(--tsg-red))] px-4 py-2 font-display text-sm font-bold tracking-wider text-white transition hover:bg-[hsl(var(--tsg-red)/0.85)]">
                      WATCH LIVE <ArrowRight className="h-4 w-4" />
                    </span>
                  </Link>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div {...fadeUp} className="glass relative -mt-10 rounded-2xl p-6 text-center">
            <p className="font-display text-sm font-bold tracking-[0.2em] text-muted-foreground">
              NO LIVE MATCH
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              There is currently no tournament in progress.
            </p>
          </motion.div>
        )}
       </section>

      {/* ------------------------------------------------------- HEADER AD */}
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <AdDisplay placement="header" page="home" />
      </div>

       {/* ----------------------------------------------------------- TEAMS */}
      <section className="mx-auto max-w-7xl px-4 py-20 md:px-8" aria-label="Teams">
        <SectionHeading
          kicker="The Organization"
          title="TWO SIDES. ONE LEGACY."
          description="Two independent competitive rosters under one banner."
        />
        <div className="grid gap-6 md:grid-cols-2">
          {(teamList ?? []).map((t) => (
            <motion.div key={t.id} {...fadeUp}>
              <TeamCard team={t} />
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- OWNERS */}
      {owners.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-10 md:px-8" aria-label="Leadership">
          <SectionHeading
            kicker="Leadership"
            title="THE OWNERS"
            description="The visionaries driving Two Side Gamers forward."
          />
          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
            {owners.map((o) => (
              <motion.div key={o.id} {...fadeUp}>
                <OwnerCard person={o} />
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------- LEGEND */}
      {legend && (
        <section className="mx-auto max-w-4xl px-4 py-20 md:px-8" aria-label="TSG Legend">
          <motion.div {...fadeUp}>
            <LegendCard person={legend} />
          </motion.div>
        </section>
      )}

      {/* --------------------------------------------------------- PLAYERS */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-10 md:px-8" aria-label="Featured players">
          <SectionHeading
            kicker="Rosters"
            title="THE PLAYERS"
            description="Meet the competitors carrying the TSG banner."
          />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {featured.map((p) => (
              <motion.div key={p.id} {...fadeUp}>
                <PlayerCard player={p} />
              </motion.div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              to="/players"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[hsl(var(--tsg-blue))] hover:underline"
            >
              View all players <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      )}

      {/* -------------------------------------------------------- UPCOMING */}
      {upcoming.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-20 md:px-8" aria-label="Upcoming tournaments">
          <SectionHeading
            kicker="What's Next"
            title="UPCOMING TOURNAMENTS"
          />
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((t) => (
              <motion.div key={t.id} {...fadeUp}>
                <TournamentCard tournament={t} />
              </motion.div>
            ))}
          </div>
        </section>
       )}

      {/* --------------------------------------------------- DEVELOPER CREDITS */}
      <DeveloperCredits />

      {/* ------------------------------------------------------- FOOTER AD */}
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <AdDisplay placement="feed_bottom" page="home" />
      </div>
     </PageLayout>
   );
 }

 function DeveloperCredits() {
   const { data: devInfo, isLoading } = trpc.public.developerInfo.useQuery();

   if (isLoading || !devInfo) return null;

   const IconComponent = {
     instagram: Instagram,
     youtube: Youtube,
     discord: MessageCircle,
     portfolio: Globe,
   } as const;

   const socialLinks = [
     { key: "instagramUrl", icon: "instagram", label: "Instagram" },
     { key: "youtubeUrl", icon: "youtube", label: "YouTube" },
     { key: "discordUrl", icon: "discord", label: "Discord" },
     { key: "portfolioUrl", icon: "portfolio", label: "Portfolio" },
   ] as const;

   const configuredLinks = socialLinks.filter(
     (link) => devInfo[link.key] && devInfo[link.key] !== "",
   );

   return (
     <section className="border-t border-tsg-navy-light bg-tsg-navy py-12 mt-auto">
       <div className="mx-auto max-w-7xl px-4 md:px-8">
         <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
           {devInfo.developerPhotoKey && devInfo.photoUrl && (
             <div className="flex-shrink-0">
               <div className="h-28 w-28 rounded-full border-4 border-tsg-blue overflow-hidden bg-tsg-blue/20">
                 <img
                   src={devInfo.photoUrl}
                   alt={devInfo.developerName}
                   className="h-full w-full object-cover"
                 />
               </div>
             </div>
           )}
           <div className="text-center md:text-left">
             <h2 className="font-display text-2xl font-bold text-white">
               {devInfo.developerName}
             </h2>
             {devInfo.bio && (
               <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                 {devInfo.bio}
               </p>
             )}
             {configuredLinks.length > 0 && (
               <div className="mt-3 flex justify-center md:justify-start gap-4">
                 {configuredLinks.map((link) => {
                   const Icon = IconComponent[link.icon];
                   return (
                     <a
                       key={link.key}
                       href={devInfo[link.key] as string}
                       target="_blank"
                       rel="noopener noreferrer"
                       className="flex h-9 w-9 items-center justify-center rounded-full bg-tsg-blue/10 text-tsg-red hover:bg-tsg-blue/20 transition-colors"
                       aria-label={link.label}
                       title={link.label}
                     >
                       <Icon className="h-5 w-5" />
                     </a>
                   );
                 })}
               </div>
             )}
           </div>
         </div>
       </div>
     </section>
   );
 }
