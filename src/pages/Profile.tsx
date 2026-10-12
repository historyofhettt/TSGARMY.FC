import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Save, ArrowLeft, User, LogOut, Trophy, Gem, Instagram } from "lucide-react";
import AchievementShowcase from "@/components/AchievementShowcase";
import { PageLayout } from "@/components/PageLayout";
import { SectionHeading } from "@/components/SectionHeading";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const USERNAME_MIN = 3;
const USERNAME_MAX = 30;
const BIO_MAX = 500;

export default function Profile() {
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const { data: profile, isLoading: profileLoading } = trpc.user.getProfile.useQuery(
    { username: user?.username ?? "" },
    { enabled: !!user?.username },
  );

  const profileUser = profile?.user;
  const displayUser = profileUser ?? user;

  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [instagram, setInstagram] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: xpHistoryData } = trpc.user.myXpHistory.useQuery(
    { limit: 20 },
    { enabled: !!profileUser?.xpVisible && isAuthenticated },
  );

  const startEditing = () => {
    setUsername(displayUser?.username ?? user?.username ?? "");
    setBio(profileUser?.bio ?? user?.bio ?? "");
    setInstagram(profileUser?.instagram ?? user?.instagram ?? "");
    setEditing(true);
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, authLoading, navigate]);

  const updateMutation = trpc.user.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Profile updated.");
      setEditing(false);
      setSaving(false);
      utils.auth.me.invalidate();
      utils.user.getProfile.invalidate();
    },
    onError: (e) => {
      toast.error(e.message ?? "Failed to update profile");
      setSaving(false);
    },
  });

  const uploadMutation = trpc.user.uploadAvatar.useMutation({
    onSuccess: () => {
      toast.success("Avatar updated.");
      utils.auth.me.invalidate();
      utils.user.getProfile.invalidate();
    },
    onError: (e) => toast.error(e.message ?? "Failed to upload avatar"),
  });

  const removeMutation = trpc.user.removeAvatar.useMutation({
    onSuccess: () => {
      toast.success("Avatar removed.");
      utils.auth.me.invalidate();
      utils.user.getProfile.invalidate();
    },
    onError: (e) => toast.error(e.message ?? "Failed to remove avatar"),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadMutation.mutate({
        name: file.name,
        contentBase64: base64,
        contentType: file.type || undefined,
      });
    };
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSave = () => {
    if (!username.trim() || username.trim().length < USERNAME_MIN) {
      toast.error(`Username must be at least ${USERNAME_MIN} characters.`);
      return;
    }
    setSaving(true);
    updateMutation.mutate({
      username: username.trim(),
      bio: bio.trim() || undefined,
      instagram: instagram.trim() || undefined,
    });
  };

  const handleRemoveAvatar = () => {
    removeMutation.mutate();
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  if (authLoading || profileLoading) {
    return (
      <PageLayout>
        <div className="mx-auto max-w-3xl px-4 py-20 md:px-8">
          <p className="text-center text-muted-foreground">Loading profile...</p>
        </div>
      </PageLayout>
    );
  }

  if (!user || !displayUser) {
    return (
      <PageLayout>
        <div className="mx-auto max-w-3xl px-4 py-20 md:px-8">
          <p className="text-center text-muted-foreground">Profile not found.</p>
          <div className="mt-4 text-center">
            <Button variant="outline" onClick={() => navigate("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Go Home
            </Button>
          </div>
        </div>
      </PageLayout>
    );
  }

  const displayName = displayUser.name ?? displayUser.username ?? "User";
  const needsUsername = !user.username;

  const avatarUrl = profileUser?.avatarUrl ?? null;

  return (
    <PageLayout>
      <div className="mx-auto max-w-3xl px-4 py-10 md:px-8">
        <div className="mb-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-[hsl(var(--tsg-red))]">
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </Button>
        </div>

        <div className="glass overflow-hidden rounded-2xl border border-border">
          <div className="relative h-32 bg-gradient-to-r from-[hsl(var(--tsg-blue)/0.25)] to-[hsl(var(--tsg-red)/0.25)]" />

          <div className="px-6 pb-8 md:px-10">
            <div className="relative -mt-16 mb-4 flex items-end gap-4">
              <div className="relative">
                <Avatar className="h-28 w-28 border-4 border-background text-4xl">
                  <AvatarImage src={avatarUrl ?? undefined} alt={displayName} />
                  <AvatarFallback className="font-display font-bold text-[hsl(var(--tsg-blue))]">
                    {initials(displayName)}
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="absolute -right-1 -bottom-1 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:text-[hsl(var(--tsg-blue))]"
                  aria-label="Change avatar"
                >
                  <User className="h-3.5 w-3.5" />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              <div className="mb-1 flex-1 min-w-0">
                <h1 className="truncate font-display text-2xl font-black tracking-wide">
                  {displayName}
                </h1>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {profileUser?.username ? `@${profileUser.username}` : needsUsername ? "No username set" : ""}
                </p>
              </div>

              {avatarUrl && !editing && !needsUsername && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveAvatar}
                  disabled={removeMutation.isPending}
                  className="mb-1 text-muted-foreground hover:text-[hsl(var(--tsg-red))]"
                >
                  <User className="h-4 w-4 rotate-45" />
                </Button>
              )}
            </div>

            {editing ? (
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Username
                  </label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    maxLength={USERNAME_MAX}
                    minLength={USERNAME_MIN}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {USERNAME_MIN}-{USERNAME_MAX} characters
                  </p>
                  {needsUsername && (
                    <p className="text-[11px] text-[hsl(var(--tsg-red))]">
                      A username is required to have a public profile.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Bio
                  </label>
                  <Textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
                    rows={4}
                    maxLength={BIO_MAX}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {bio.length}/{BIO_MAX}
                  </p>
                 </div>

                 <div className="space-y-2">
                   <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                     Instagram Link
                   </label>
                   <Input
                     type="url"
                     value={instagram}
                     onChange={(e) => setInstagram(e.target.value.slice(0, 512))}
                     maxLength={512}
                     placeholder="https://instagram.com/yourusername"
                   />
                   <p className="text-[11px] text-muted-foreground">
                     Enter your full Instagram profile URL. Leave blank to remove.
                   </p>
                 </div>

                 <div className="flex items-center gap-3">
                   <Button onClick={handleSave} disabled={saving || updateMutation.isPending}>
                     {saving && <User className="mr-2 h-4 w-4 animate-pulse" />}
                     <Save className="mr-2 h-4 w-4" />
                     {saving ? "Saving..." : "Save Changes"}
                   </Button>
                   <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>
                     Cancel
                   </Button>
                 </div>
              </div>
            ) : (
              <div className="space-y-4">
                <SectionHeading kicker="About" title="BIOGRAPHY" />
                {profileUser?.bio || user?.bio ? (
                  <p className="max-w-2xl whitespace-pre-wrap leading-relaxed text-muted-foreground">
                    {(profileUser?.bio ?? user?.bio) ?? ""}
                  </p>
                 ) : (
                   <p className="text-sm text-muted-foreground">No bio yet. Click edit to add one.</p>
                 )}

                 {profileUser?.instagram ? (
                   <div className="mt-4 flex items-center gap-2.5">
                     <Instagram className="h-4 w-4 text-pink-500" />
                     <a
                       href={profileUser.instagram}
                       target="_blank"
                       rel="noopener noreferrer"
                       className="text-sm text-pink-500 hover:underline"
                     >
                       {profileUser.instagram}
                     </a>
                   </div>
                 ) : (
                   <p className="mt-4 text-sm text-muted-foreground">
                     No Instagram link yet. Click edit to add one.
                   </p>
                 )}


                  {profileUser?.xpVisible && (
                    <section className="space-y-3 pt-4">
                      <SectionHeading kicker="Stats" title="EXPERIENCE" />
                      <div className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3">
                        <Trophy className="h-5 w-5 text-[hsl(var(--tsg-blue))]" />
                        <span className="font-display text-xl font-black text-[hsl(var(--tsg-blue))]">
                          {(profileUser?.xp ?? 0).toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground">XP</span>
                      </div>
                      {xpHistoryData && xpHistoryData.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                            Recent Activity
                          </p>
                          <div className="space-y-1">
                            {xpHistoryData.slice(0, 10).map((entry) => (
                              <div
                                key={entry.id}
                                className="flex items-center justify-between rounded-md border border-border/60 bg-background/30 px-3 py-1.5"
                              >
                                <span className="text-xs text-muted-foreground">
                                  {entry.reason ?? "XP adjustment"}
                                </span>
                                <span
                                  className={cn(
                                    "text-xs font-bold",
                                    entry.amount > 0 ? "text-emerald-400" : "text-[hsl(var(--tsg-red))]",
                                  )}
                                >
                                  {entry.amount > 0 ? "+" : ""}
                                  {entry.amount}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </section>
                  )}

                   {isAuthenticated && (
                     <section className="pt-4">
                       <AchievementShowcase />
                      </section>
                    )}

                    <div className="pt-4 flex items-center gap-3">
                   <Button asChild>
                     <a href="/collection">
                       <Gem className="mr-2 h-4 w-4" />
                       View Card Collection
                     </a>
                   </Button>
                   <Button variant="outline" onClick={startEditing}>
                     {needsUsername ? "Set Username & Edit Profile" : "Edit Profile"}
                   </Button>
                   <Button variant="outline" onClick={handleLogout}>
                     <LogOut className="mr-2 h-4 w-4" /> Logout
                   </Button>
                 </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
