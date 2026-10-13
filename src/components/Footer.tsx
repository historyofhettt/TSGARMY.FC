import { Link } from "react-router";
import { Youtube, Instagram, Twitter, MessagesSquare } from "lucide-react";
import { trpc } from "@/providers/trpc";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/teams", label: "Teams" },
  { to: "/players", label: "Players" },
  { to: "/tournaments", label: "Tournaments" },
  { to: "/schedule", label: "Schedule" },
  { to: "/live", label: "Live" },
  { to: "/community", label: "Community" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

const LEGAL = [
  { to: "/privacy", label: "Privacy Policy" },
  { to: "/terms", label: "Terms of Service" },
  { to: "/terms#guidelines", label: "Community Guidelines" },
];

export function Footer() {
  const { data: org } = trpc.public.org.useQuery();

  const socials = [
    { href: org?.youtube, icon: Youtube, label: "YouTube" },
    { href: org?.instagram, icon: Instagram, label: "Instagram" },
    { href: org?.x, icon: Twitter, label: "X" },
    { href: org?.discord, icon: MessagesSquare, label: "Discord" },
  ].filter((s) => s.href);

  return (
    <footer className="relative mt-24 border-t border-border bg-[hsl(var(--tsg-navy))]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--tsg-blue)/0.6)] to-transparent" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-4 md:px-8">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-gradient-to-br from-[hsl(var(--tsg-blue))] to-[hsl(var(--tsg-red))] font-display text-sm font-black text-white">
              TSG
            </span>
            <div>
              <p className="font-display text-sm font-bold tracking-widest">{org?.shortName ?? "TSG"}</p>
              <p className="text-xs text-muted-foreground">{org?.orgName ?? "Two Side Gamers"}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {org?.tagline ?? "Built for Competition. Driven by Legacy."}
          </p>
        </div>

        <nav aria-label="Footer">
          <p className="mb-3 font-display text-xs font-bold tracking-[0.25em] text-muted-foreground">NAVIGATE</p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
            {NAV.map((i) => (
              <li key={i.to}>
                <Link to={i.to} className="text-sm text-muted-foreground transition hover:text-[hsl(var(--tsg-blue))]">
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="mb-3 font-display text-xs font-bold tracking-[0.25em] text-muted-foreground">LEGAL</p>
          <ul className="space-y-2">
            {LEGAL.map((i) => (
              <li key={i.label}>
                <Link to={i.to} className="text-sm text-muted-foreground transition hover:text-[hsl(var(--tsg-blue))]">
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-3 font-display text-xs font-bold tracking-[0.25em] text-muted-foreground">FOLLOW TSG</p>
          {socials.length > 0 ? (
            <div className="flex gap-2">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href!}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={s.label}
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:border-[hsl(var(--tsg-blue)/0.6)] hover:text-[hsl(var(--tsg-blue))]"
                >
                  <s.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Social links coming soon.</p>
          )}
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {org?.orgName ?? "Two Side Gamers"}. All rights reserved.
      </div>
    </footer>
  );
}
