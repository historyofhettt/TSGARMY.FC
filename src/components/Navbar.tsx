import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router";
import { Menu, Search, Shield, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { hasAtLeastRole } from "@contracts/constants";
import { trpc } from "@/providers/trpc";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SearchDialog } from "@/components/SearchDialog";
import { NotificationBell } from "@/components/NotificationBell";

const NAV = [
   { to: "/", label: "HOME" },
   { to: "/teams", label: "TEAMS" },
   { to: "/players", label: "PLAYERS" },
   { to: "/schedule", label: "SCHEDULE" },
   { to: "/leaderboard", label: "LEADERBOARD" },
   { to: "/cards", label: "CARDS" },
   { to: "/rewards", label: "REWARDS" },
   { to: "/community", label: "COMMUNITY" },
   { to: "/media", label: "MEDIA" },
   { to: "/spotlight", label: "SPOTLIGHT" },
   { to: "/fan/quiz", label: "QUIZ" },
   { to: "/fan/tasks", label: "TASKS" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const { data: org } = trpc.public.org.useQuery();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const isAdmin = user?.role === "admin";
  const isStaff = hasAtLeastRole(user?.role, "moderator");
  const staffPath = isAdmin ? "/admin" : "/admin/comments";
  const staffLabel = isAdmin ? "ADMIN" : "MOD";

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-all duration-300",
          scrolled ? "glass-strong shadow-lg shadow-black/40" : "bg-transparent",
        )}
      >
        <nav className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 md:px-8" aria-label="Main">
          <Link to="/" className="flex-shrink-0 flex items-center gap-2.5" aria-label="TSG home">
            {org?.logoUrl ? (
              <img src={org.logoUrl} alt="TSG logo" className="h-9 w-9 shrink-0 rounded-md object-contain" />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[hsl(var(--tsg-blue))] to-[hsl(var(--tsg-red))] font-display text-sm font-black text-white">
                TSG
              </span>
            )}
            <span className="hidden font-display text-sm font-bold tracking-[0.2em] sm:block sm:shrink-0">
              {org?.shortName ?? "TSG"}
            </span>
          </Link>

          <div className="ml-auto hidden shrink-0 items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "relative shrink-0 min-w-fit px-3 py-2 text-[13px] font-semibold tracking-[0.14em] transition-colors",
                    isActive
                      ? "text-[hsl(var(--tsg-blue))]"
                      : "text-muted-foreground hover:text-foreground",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {item.label}
                    <span
                      className={cn(
                        "absolute inset-x-1 -bottom-0.5 h-0.5 origin-left rounded-full bg-[hsl(var(--tsg-blue))] transition-transform duration-300",
                        isActive ? "scale-x-100" : "scale-x-0",
                      )}
                    />
                  </>
                )}
              </NavLink>
            ))}
            {isStaff && (
              <NavLink
                to={staffPath}
                className="ml-1 shrink-0 min-w-fit flex items-center gap-1.5 rounded-md border border-[hsl(var(--tsg-red)/0.5)] bg-[hsl(var(--tsg-red)/0.12)] px-3 py-1.5 text-[13px] font-bold tracking-wider text-[hsl(var(--tsg-red))] transition hover:bg-[hsl(var(--tsg-red)/0.22)]"
              >
                <Shield className="h-3.5 w-3.5" /> {staffLabel}
              </NavLink>
            )}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-2">
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:border-[hsl(var(--tsg-blue)/0.6)] hover:text-foreground"
            >
              <Search className="h-4 w-4" />
            </button>
            <NotificationBell />
            {isAuthenticated ? (
              <Button
                variant="outline"
                size="sm"
                className="hidden gap-1.5 lg:flex"
                onClick={() => navigate("/profile")}
              >
                <User className="h-3.5 w-3.5" />
                {user?.name ?? "Profile"}
              </Button>
            ) : (
              <Button
                size="sm"
                className="hidden bg-[hsl(var(--tsg-blue))] font-semibold hover:bg-[hsl(var(--tsg-blue)/0.85)] lg:flex"
                onClick={() => navigate("/login")}
              >
                LOGIN
              </Button>
            )}

            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button aria-label="Open menu" className="flex h-9 w-9 items-center justify-center rounded-md border border-border lg:hidden">
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="glass-strong w-72 border-border p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <div className="flex h-full flex-col gap-1 p-6 pt-12">
                  {NAV.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === "/"}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          "rounded-md px-4 py-3 font-display text-sm font-semibold tracking-[0.15em] transition",
                          isActive
                            ? "bg-[hsl(var(--tsg-blue)/0.12)] text-[hsl(var(--tsg-blue))]"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground",
                        )
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                  <div className="my-3 h-px bg-border" />
                  {isAuthenticated && (
                    <NavLink
                      to="/notifications"
                      onClick={() => setMobileOpen(false)}
                      className="rounded-md px-4 py-3 font-display text-sm font-semibold tracking-[0.15em] transition text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      NOTIFICATIONS
                    </NavLink>
                  )}
                  {isStaff && (
                    <NavLink
                      to={staffPath}
                      onClick={() => setMobileOpen(false)}
                      className="rounded-md px-4 py-3 font-display text-sm font-semibold tracking-[0.15em] text-[hsl(var(--tsg-red))]"
                    >
                      {isAdmin ? "ADMIN PANEL" : "MODERATION"}
                    </NavLink>
                  )}
                  {isAuthenticated ? (
                    <>
                      <NavLink
                        to="/profile"
                        onClick={() => setMobileOpen(false)}
                        className="rounded-md px-4 py-3 text-sm font-semibold text-[hsl(var(--tsg-blue))]"
                      >
                        Profile
                      </NavLink>
                      <button
                        onClick={() => {
                          setMobileOpen(false);
                          logout();
                        }}
                        className="rounded-md px-4 py-3 text-left text-sm text-muted-foreground hover:text-foreground"
                      >
                        Log out ({user?.name})
                      </button>
                    </>
                  ) : (
                    <NavLink
                      to="/login"
                      onClick={() => setMobileOpen(false)}
                      className="rounded-md px-4 py-3 text-sm font-semibold text-[hsl(var(--tsg-blue))]"
                    >
                      Login
                    </NavLink>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
      </header>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
