import { useState, useEffect, type ReactNode } from "react";
import { NavLink, Link, useNavigate } from "react-router";
import {
  LayoutDashboard, Building2, Users, UserRound, Trophy, CalendarDays,
  Radio, MessageSquare, UserCog, Image, Settings, Menu, ExternalLink, LogOut, Crown,
  Map, UserCheck, Gauge, Flame, Brain, Target, Gem, Shield, BarChart3,
  Megaphone, Bell, Play, FolderOpen, Award, TrendingUp, Gift,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { hasAtLeastRole } from "@contracts/constants";
import type { Role } from "@contracts/constants";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

type NavItem = {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  end?: boolean;
  /** Lowest role allowed to see this item. Defaults to admin. */
  minRole?: Role;
};

const SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [{ to: "/admin", icon: LayoutDashboard, label: "Dashboard", end: true }],
  },
  {
    label: "Organization",
    items: [
      { to: "/admin/settings", icon: Building2, label: "Organization" },
      { to: "/admin/people", icon: Crown, label: "Owners & Legend" },
      { to: "/admin/xp-settings", icon: Gauge, label: "XP Role Settings" },
    ],
  },
  {
    label: "Competitive",
    items: [
      { to: "/admin/teams", icon: Users, label: "Teams" },
      { to: "/admin/players", icon: UserRound, label: "Players" },
      { to: "/admin/highlights", icon: Play, label: "Highlights" },
      { to: "/admin/staff", icon: UserCheck, label: "Staff" },
      { to: "/admin/team-media", icon: Image, label: "Team Media" },
      { to: "/admin/media-page", icon: FolderOpen, label: "Media Page" },
      { to: "/admin/tournaments", icon: Trophy, label: "Tournaments" },
      { to: "/admin/maps", icon: Map, label: "Map Library" },
      { to: "/admin/schedule", icon: CalendarDays, label: "Schedule" },
      { to: "/admin/live", icon: Radio, label: "Live Matches" },
      { to: "/admin/achievements", icon: Trophy, label: "Achievements" },
    ],
  },
    {
      label: "Community",
      items: [
        { to: "/admin/comments", icon: MessageSquare, label: "Comments", minRole: "moderator" },
        { to: "/admin/community", icon: Shield, label: "Community", minRole: "moderator" },
        { to: "/admin/live-channels", icon: Radio, label: "Live Channels" },
        { to: "/admin/users", icon: UserCog, label: "Users" },
        { to: "/admin/roles", icon: Shield, label: "Roles" },
        { to: "/admin/fan-spotlight", icon: Award, label: "Fan Spotlight" },
      ],
    },
  {
    label: "XP Rewards",
    items: [
      { to: "/admin/streak-settings", icon: Flame, label: "Daily Streak" },
      { to: "/admin/predictions", icon: Trophy, label: "Predictions" },
      { to: "/admin/quiz", icon: Brain, label: "TSG Quiz" },
      { to: "/admin/xp-tasks", icon: Target, label: "XP Tasks" },
      { to: "/admin/weekly-top-fan", icon: Crown, label: "Weekly Top Fan" },
      { to: "/admin/cards", icon: Gem, label: "Card Collection" },
      { to: "/admin/fan-rewards", icon: Gift, label: "Fan Rewards", minRole: "moderator" },
      { to: "/admin/redemptions", icon: Award, label: "Redemptions", minRole: "moderator" },
    ],
  },
  {
    label: "Analytics",
    items: [
      { to: "/admin/analytics", icon: BarChart3, label: "Analytics Dashboard" },
    ],
  },
  {
    label: "Monetization",
    items: [
      { to: "/admin/sponsored-ads", icon: TrendingUp, label: "Sponsored Ads", minRole: "moderator" },
      { to: "/admin/developer-info", icon: UserCog, label: "Developer Info", minRole: "admin" },
    ],
  },
  {
    label: "Notifications",
    items: [
      { to: "/admin/notification-types", icon: Bell, label: "Notification Types" },
      { to: "/admin/announcements", icon: Megaphone, label: "Announcements" },
    ],
  },
  {
    label: "Assets",
    items: [
      { to: "/admin/media", icon: Image, label: "Media Library" },
      { to: "/admin/settings", icon: Settings, label: "Settings" },
    ],
  },
];

/** Sections/items filtered to what `role` is allowed to see. */
function sectionsForRole(role: Role) {
  return SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) => !item.minRole || hasAtLeastRole(role, item.minRole),
    ),
  })).filter((section) => section.items.length > 0);
}

function SidebarNav({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 overflow-y-auto p-4" aria-label="Admin">
      {sectionsForRole(role).map((section) => (
        <div key={section.label}>
          <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {section.label}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <li key={item.to + item.label}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition",
                      isActive
                        ? "bg-[hsl(var(--tsg-blue)/0.14)] text-[hsl(var(--tsg-blue))]"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )
                  }
                >
                  <item.icon className="h-4 w-4" /> {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AdminLayout({
  children,
  title,
  minRole = "admin",
}: {
  children: ReactNode;
  title: string;
  /** Lowest role allowed to view this page. Defaults to admin. */
  minRole?: Role;
}) {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Verifying access...</p>
      </div>
    );
  }
  if (!isAuthenticated) {
    // Navigate happens in the useEffect above; return null here to avoid
    // rendering any layout content while redirecting.
    return null;
  }
  // Client-side mirror of the server-side role guard. The real enforcement
  // happens in tRPC middleware; this only controls what the UI renders.
  if (!user || !hasAtLeastRole(user.role as Role, minRole)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <h1 className="font-display text-2xl font-bold">Access denied</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          This area requires an administrator account. If you are the site owner, sign in with the
          account that created this app.
        </p>
        {hasAtLeastRole(user?.role, "moderator") && (
          <Link to="/admin/comments" className="text-sm text-[hsl(var(--tsg-blue))] hover:underline">
            Go to comment moderation
          </Link>
        )}
        <Link to="/" className="text-sm text-[hsl(var(--tsg-blue))] hover:underline">
          Back to website
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-[hsl(var(--tsg-navy))] lg:flex">
         <Link to="/admin" className="flex h-16 items-center gap-2.5 border-b border-border px-5">
           <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-[hsl(var(--tsg-blue))] to-[hsl(var(--tsg-red))] font-display text-xs font-black text-white">
             TSG
           </span>
           <span className="font-display text-sm font-bold tracking-[0.15em]">ADMIN</span>
         </Link>
          <SidebarNav role={user.role as Role} />
       </aside>

       {/* Top bar */}
      <div className="flex min-h-screen flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur md:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button aria-label="Open admin menu" className="flex h-9 w-9 items-center justify-center rounded-md border border-border lg:hidden">
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 border-border bg-[hsl(var(--tsg-navy))] p-0">
              <SheetTitle className="sr-only">Admin navigation</SheetTitle>
              <div className="flex h-16 items-center border-b border-border px-5 font-display text-sm font-bold tracking-[0.15em]">
                TSG ADMIN
              </div>
              <SidebarNav role={user.role as Role} onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <h1 className="font-display text-base font-bold tracking-wide md:text-lg">{title}</h1>
          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/"
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" /> View site
            </Link>
            <button
              onClick={() => logout()}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" /> {user?.name}
            </button>
            <span className="hidden rounded-full border border-[hsl(var(--tsg-blue)/0.5)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--tsg-blue))] sm:inline-block">
              {user?.role}
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
