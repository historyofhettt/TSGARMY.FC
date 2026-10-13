import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import { toast } from "sonner";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trophy,
  Instagram,
  Star,
  Clock,
  Gem,
  Eye,
  EyeOff,
  Upload,
  X,
  Crown,
  Share2,
  CheckCircle2,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { PageLayout } from "@/components/PageLayout";
import { CardDisplay } from "@/components/CardDisplay";
import type { CardData } from "@/components/CardDisplay";
import { cn } from "@/lib/utils";
import { initials, formatDate } from "@/lib/format";
import type { CardCategory } from "@/components/CardDisplay";

const BIO_MAX = 500;
const INSTAGRAM_MAX = 512;

function resolveInstagramUrl(ig: string): string {
  if (/^https?:\/\//i.test(ig)) return ig;
  return `https://instagram.com/${ig.replace(/^@+/, "")}`;
}

function formatInstagramDisplay(ig: string): string {
  if (/^https?:\/\//i.test(ig)) return ig;
  return `@${ig.replace(/^@+/, "")}`;
}

const CARD_CATEGORIES: { key: CardCategory; label: string }[] = [
  { key: "common", label: "Common" },
  { key: "rare", label: "Rare" },
  { key: "epic", label: "Epic" },
  { key: "legendary", label: "Legendary" },
  { key: "event", label: "Event" },
  { key: "exclusive", label: "Exclusive" },
];

export default function FanProfile() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const utils = trpc.useUtils();

  const [editingBio, setEditingBio] = useState(false);
  const [bioText, setBioText] = useState("");
  const [instagramText, setInstagramText] = useState("");
  const [editingInstagram, setEditingInstagram] = useState(false);
  const [featuredMode, setFeaturedMode] = useState(false);
  const [hiddenMode, setHiddenMode] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: profile, isLoading, isError } = trpc.user.getFanProfile.useQuery({
    username: username ?? "",
  });

  const updateBio = trpc.user.updateBio.useMutation({
    onSuccess: () => {
      utils.user.getFanProfile.invalidate({ username: username ?? "" });
      setEditingBio(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateInstagram = trpc.user.updateInstagram.useMutation({
    onSuccess: () => {
      utils.user.getFanProfile.invalidate({ username: username ?? "" });
      setEditingInstagram(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateFeaturedCards = trpc.user.updateFeaturedCards.useMutation({
    onSuccess: () => {
      utils.user.getFanProfile.invalidate({ username: username ?? "" });
      setFeaturedMode(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateHiddenCards = trpc.user.updateHiddenCards.useMutation({
    onSuccess: () => {
      utils.user.getFanProfile.invalidate({ username: username ?? "" });
      setHiddenMode(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const uploadAvatar = trpc.user.uploadAvatar.useMutation({
    onSuccess: () => {
      utils.user.getFanProfile.invalidate({ username: username ?? "" });
      utils.user.getProfile.invalidate();
      utils.auth.me.invalidate();
    },
    onError: (e) => toast.error(e.message ?? "Failed to upload avatar"),
  });

  const removeAvatar = trpc.user.removeAvatar.useMutation({
    onSuccess: () => {
      utils.user.getFanProfile.invalidate({ username: username ?? "" });
      utils.user.getProfile.invalidate();
      utils.auth.me.invalidate();
    },
    onError: (e) => toast.error(e.message ?? "Failed to remove avatar"),
  });

  if (isLoading) {
    return (
      <PageLayout>
        <div className="mx-auto max-w-6xl px-4 py-20 md:px-8">
          <p className="text-center text-muted-foreground">Loading fan profile...</p>
        </div>
      </PageLayout>
    );
  }

  if (isError || !profile) {
    return (
      <PageLayout>
        <div className="mx-auto max-w-6xl px-4 py-20 md:px-8">
          <p className="text-center text-muted-foreground">Profile not found.</p>
          <div className="mt-4 text-center">
            <Button variant="outline" onClick={() => navigate("/")}>
              Go Home
            </Button>
          </div>
        </div>
      </PageLayout>
    );
  }

  const { user, achievements, collection } = profile;
  const isOwnProfile = currentUser?.username === user.username;
  const displayName = user.name ?? user.username ?? "User";

  const handleBioSave = () => {
    updateBio.mutate({ bio: bioText.trim() || null });
  };

  const handleInstagramSave = () => {
    const cleanInsta = instagramText.trim() || null;
    updateInstagram.mutate({ instagram: cleanInsta });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadAvatar.mutate({
        name: file.name,
        contentBase64: base64,
        contentType: file.type || undefined,
      });
    };
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleRemoveAvatar = () => {
    removeAvatar.mutate();
  };

  // Convert DB card row to CardData type expected by CardDisplay
  const toCardData = (card: {
    id: number;
    name: string;
    slug: string;
    category: CardCategory;
    totalSupply: number;
    claimedSupply: number;
    description: string | null;
    imageKey: string | null;
    imageUrl?: string | null;
    isActive: boolean;
  }): CardData => ({
    id: card.id,
    name: card.name,
    slug: card.slug,
    category: card.category,
    totalSupply: card.totalSupply,
    claimedSupply: card.claimedSupply,
    description: card.description,
    imageKey: card.imageKey,
    imageUrl: card.imageUrl ?? null,
    isActive: card.isActive,
    holderCount: 0,
    remainingSupply: card.totalSupply - card.claimedSupply,
  });

  const toggleFeatured = (cardId: number) => {
    const featuredIds = collection.featuredCards.map((c) => c.cardId);
    let newIds: number[];
    if (featuredIds.includes(cardId)) {
      newIds = featuredIds.filter((id) => id !== cardId);
    } else {
      newIds = [...featuredIds, cardId];
    }
    updateFeaturedCards.mutate({ cardIds: newIds });
  };

  const toggleHidden = (cardId: number) => {
    const hiddenIds = collection.hiddenCards.map((c) => c.cardId);
    let newIds: number[];
    if (hiddenIds.includes(cardId)) {
      newIds = hiddenIds.filter((id) => id !== cardId);
    } else {
      newIds = [...hiddenIds, cardId];
    }
    updateHiddenCards.mutate({ cardIds: newIds });
  };

  const handleShare = async () => {
    const profileUrl = `${window.location.origin}/fans/${user.username}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${displayName}'s TSG Fan Profile`,
          text: `Check out ${displayName}'s TSG fan profile!`,
          url: profileUrl,
        });
      } catch {
        await navigator.clipboard.writeText(profileUrl);
        toast.success("Profile link copied to clipboard.");
      }
    } else {
      await navigator.clipboard.writeText(profileUrl);
      toast.success("Profile link copied to clipboard.");
    }
  };

  const filteredCards = activeCategory === "all"
    ? collection.cards
    : collection.cards.filter((c) => c.card.category === activeCategory);

  const featuredCardIds = new Set(collection.featuredCards.map((c) => c.cardId));
  const hiddenCardIds = new Set(collection.hiddenCards.map((c) => c.cardId));

  return (
    <PageLayout>
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
        {/* Header Banner */}
        <div className="relative">
          <div className="h-32 rounded-2xl bg-gradient-to-r from-[hsl(var(--tsg-blue)/0.3)] to-[hsl(var(--tsg-red)/0.25)]" />
          <div className="absolute -bottom-16 left-4 sm:left-8">
            <div className="relative">
              <Avatar className="h-32 w-32 border-4 border-background text-5xl">
                <AvatarImage src={user.avatarUrl ?? undefined} alt={displayName} />
                <AvatarFallback className="font-display font-bold text-[hsl(var(--tsg-blue))]">
                  {initials(displayName)}
                </AvatarFallback>
              </Avatar>
                {isOwnProfile && (
                  <>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="absolute -right-1 -bottom-1 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:text-[hsl(var(--tsg-blue))]"
                      aria-label="Change avatar"
                    >
                      <Upload className="h-4 w-4" />
                    </button>
                    {user.avatar && !editingBio && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        className="absolute -right-10 -bottom-1 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:text-[hsl(var(--tsg-red))]"
                        aria-label="Remove avatar"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </>
                )}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>
        </div>

        {/* Profile Header Info */}
        <div className="mt-20 px-4 sm:px-0">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-3xl font-black tracking-wide">
                {displayName}
              </h1>
              {user.username && (
                <p className="mt-1 text-sm text-muted-foreground">@{user.username}</p>
              )}
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Joined {formatDate(user.createdAt)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {isOwnProfile && !editingBio && (
                <Button variant="ghost" size="sm" onClick={() => { setBioText(user.bio ?? ""); setEditingBio(true); }}>
                  Edit Bio
                </Button>
              )}
              {!isOwnProfile && (
                <Button variant="ghost" size="sm" onClick={handleShare}>
                  <Share2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Bio editing / display */}
          <div className="mt-6">
            {editingBio ? (
              <div className="space-y-3">
                <Textarea
                  value={bioText}
                  onChange={(e) => setBioText(e.target.value.slice(0, BIO_MAX))}
                  rows={4}
                  maxLength={BIO_MAX}
                  placeholder="Tell us about yourself..."
                />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    {bioText.length}/{BIO_MAX}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingBio(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleBioSave} disabled={updateBio.isPending}>
                      Save
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="prose prose-sm max-w-none text-muted-foreground">
                {user.bio ? (
                  <p className="whitespace-pre-wrap">{user.bio}</p>
                ) : (
                  isOwnProfile && <p className="text-sm">No bio yet. Click "Edit Bio" to add one.</p>
                )}
              </div>
            )}
          </div>

           {/* Instagram */}
           {user.instagram && (
            <div className="mt-4 flex items-center gap-2.5">
              <Instagram className="h-4 w-4 text-pink-500" />
              {isOwnProfile && editingInstagram ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={instagramText}
                    onChange={(e) => setInstagramText(e.target.value.slice(0, INSTAGRAM_MAX))}
                    maxLength={INSTAGRAM_MAX}
                    placeholder="https://instagram.com/yourusername"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setInstagramText("")}
                    title="Clear Instagram"
                  >
                    Clear
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingInstagram(false)}
                  >
                    ✕
                  </Button>
                  <Button size="sm" onClick={handleInstagramSave} disabled={updateInstagram.isPending}>
                    Save
                  </Button>
                </div>
              ) : (
                <>
                  {isOwnProfile ? (
                    <button
                      onClick={() => { setInstagramText(user.instagram ?? ""); setEditingInstagram(true); }}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      {formatInstagramDisplay(user.instagram!)}
                    </button>
                  ) : (
                    <a
                      href={resolveInstagramUrl(user.instagram!)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-pink-500 hover:underline"
                    >
                      {formatInstagramDisplay(user.instagram!)}
                    </a>
                  )}
                </>
              )}
            </div>
          )}

          {!user.instagram && isOwnProfile && (
            <div className="mt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setInstagramText(""); setEditingInstagram(true); }}
                className="text-muted-foreground"
              >
                <Instagram className="h-4 w-4 mr-1" /> Add Instagram
              </Button>
            </div>
          )}

          {user.instagram && isOwnProfile && (
            <div className="mt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setInstagramText("");
                  setEditingInstagram(true);
                }}
                className="text-muted-foreground"
              >
                <Instagram className="h-4 w-4 mr-1" />
                Edit Instagram
              </Button>
            </div>
          )}

          {!user.instagram && !isOwnProfile && user.instagram !== null && null}
        </div>

        {/* Stats Grid */}
        {user.xpVisible && (
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card className="glass border-border">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-[hsl(var(--tsg-blue))]" />
                  <span className="text-xs font-semibold uppercase text-muted-foreground">Total XP</span>
                </div>
                <p className="mt-1 font-display text-2xl font-black text-[hsl(var(--tsg-blue))]">
                  {(user.xp ?? 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card className="glass border-border">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">XP Rank</span>
                </div>
                <p className="mt-1 font-display text-2xl font-black">
                  #{user.xpRank ?? "—"}
                </p>
              </CardContent>
            </Card>

            <Card className="glass border-border">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[hsl(var(--tsg-red))]" />
                  <span className="text-xs font-semibold uppercase text-muted-foreground">Streak</span>
                </div>
                <p className="mt-1 font-display text-2xl font-black text-[hsl(var(--tsg-red))]">
                  {user.currentStreak ?? 0}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Longest: {user.longestStreak ?? 0}
                </p>
              </CardContent>
            </Card>

            <Card className="glass border-border">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-semibold uppercase text-muted-foreground">Weekly Top Fan</span>
                </div>
                <p className="mt-1 font-display text-sm font-bold">
                  {user.weeklyTopFan ? (
                    <Badge className="bg-amber-400/20 text-amber-400">
                      <Crown className="h-3 w-3 mr-1" /> Winner
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* XP Progress Bar */}
        {user.xpVisible && (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-muted-foreground">XP Progress</span>
              <span className="text-xs text-muted-foreground">
                {(user.xp ?? 0).toLocaleString()} total
              </span>
            </div>
            <Progress value={100} className="h-2" />
            <p className="mt-1 text-xs text-muted-foreground">
              Keep earning XP to climb the leaderboard!
            </p>
          </div>
        )}

        {/* Achievements Section */}
        <div className="mt-10">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-display text-2xl font-black tracking-wide text-foreground">
              Achievements
            </h2>
            <Badge variant="outline" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {achievements.length} earned
            </Badge>
          </div>

          {achievements.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No achievements earned yet.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {achievements.map((ach) => (
                <AchievementCard key={ach.id} ach={ach} />
              ))}
            </div>
          )}
        </div>

        {/* Card Collection */}
        <div className="mt-12">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-display text-2xl font-black tracking-wide text-foreground">
              Card Collection
            </h2>
            <Badge variant="outline">
              {collection.collectedCards} / {collection.totalCards} · {collection.completionPercent}%
            </Badge>
          </div>

          {/* Category Filters */}
          <Tabs value={activeCategory} onValueChange={setActiveCategory} className="mb-4">
            <TabsList className="flex flex-wrap gap-1 bg-transparent">
              <TabsTrigger value="all" className="text-xs">All ({collection.cards.length})</TabsTrigger>
              {CARD_CATEGORIES.map((cat) => {
                const catCards = collection.cards.filter((c) => c.card.category === cat.key);
                return (
                  <TabsTrigger key={cat.key} value={cat.key} className="text-xs">
                    {cat.label} ({catCards.length})
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>

          {/* Collection Stats */}
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card className="glass border-border">
              <CardContent className="py-3">
                <span className="text-xs text-muted-foreground">Total</span>
                <p className="font-display font-bold">{collection.totalCards}</p>
              </CardContent>
            </Card>
            <Card className="glass border-border">
              <CardContent className="py-3">
                <span className="text-xs text-muted-foreground">Collected</span>
                <p className="font-display font-bold text-[hsl(var(--tsg-blue))]">{collection.collectedCards}</p>
              </CardContent>
            </Card>
            <Card className="glass border-border">
              <CardContent className="py-3">
                <span className="text-xs text-muted-foreground">Completion</span>
                <p className="font-display font-bold text-[hsl(var(--tsg-red))]">{collection.completionPercent}%</p>
              </CardContent>
            </Card>
            {collection.rarestCard && (
              <Card className="glass border-border">
                <CardContent className="py-3">
                  <span className="text-xs text-muted-foreground">Rarest Card</span>
                  <p className="font-display font-bold truncate">{collection.rarestCard.card.name}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Rarest Card Highlight */}
          {collection.rarestCard && (
            <div className="mb-8">
              <h3 className="font-display text-sm font-bold uppercase tracking-widest text-[hsl(var(--tsg-blue))] mb-3">
                Rarest Card Owned
              </h3>
              <div className="flex justify-center">
                <CardDisplay card={toCardData(collection.rarestCard!.card)} size="lg" showDetails={true} />
              </div>
            </div>
          )}

          {/* Featured Cards */}
          {collection.featuredCards.length > 0 && (
            <div className="mb-8">
              <h3 className="font-display text-sm font-bold uppercase tracking-widest text-[hsl(var(--tsg-blue))] mb-3">
                Featured Cards
              </h3>
              <div className="flex gap-4 overflow-x-auto pb-2">
                  {collection.featuredCards.map((fc) => (
                    <CardDisplay key={fc.id} card={toCardData(fc.card)} size="md" />
                  ))}
              </div>
            </div>
          )}

          {/* User Controls - Featured/Hidden Mode */}
          {isOwnProfile && (
            <div className="mb-4 flex gap-2">
              <Button
                variant={featuredMode ? "default" : "outline"}
                size="sm"
                onClick={() => setFeaturedMode(!featuredMode)}
              >
                {featuredMode ? "Save Featured" : "Select Featured"}
              </Button>
              <Button
                variant={hiddenMode ? "default" : "outline"}
                size="sm"
                onClick={() => setHiddenMode(!hiddenMode)}
                disabled={featuredMode}
              >
                {hiddenMode ? "Save Hidden" : "Select Hidden"}
              </Button>
              {(featuredMode || hiddenMode) && (
                <Button variant="ghost" size="sm" onClick={() => { setFeaturedMode(false); setHiddenMode(false); }}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          {/* Card Grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredCards.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Gem className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No cards in this category.</p>
              </div>
            ) : (
              filteredCards.map((uc) => {
                const isFeatured = featuredCardIds.has(uc.cardId);
                const isHidden = hiddenCardIds.has(uc.cardId);
                const inFeaturedMode = featuredMode && isFeatured;
                const inHiddenMode = hiddenMode && isHidden;

                return (
                  <div
                    key={uc.id}
                    className={cn(
                      "relative",
                      isHidden && !hiddenMode && "opacity-50 grayscale",
                      inFeaturedMode && "ring-2 ring-[hsl(var(--tsg-blue))] rounded-xl p-1",
                      inHiddenMode && "ring-2 ring-[hsl(var(--tsg-red))] rounded-xl p-1",
                    )}
                  >
                    <CardDisplay
                      card={toCardData(uc.card)}
                      size="md"
                      onClick={
                        isOwnProfile && (featuredMode || hiddenMode)
                          ? () => {
                              if (featuredMode) toggleFeatured(uc.cardId);
                              if (hiddenMode) toggleHidden(uc.cardId);
                            }
                          : undefined
                      }
                    />
                    {isOwnProfile && featuredMode && (
                      <div className="absolute top-1 left-1 z-10">
                        <Star
                          className={cn(
                            "h-5 w-5 cursor-pointer",
                            isFeatured ? "fill-amber-400 text-amber-400" : "text-muted-foreground/50",
                          )}
                        />
                      </div>
                    )}
                    {isOwnProfile && hiddenMode && (
                      <div className="absolute top-1 left-1 z-10">
                        {isHidden ? (
                          <EyeOff className="h-5 w-5 text-[hsl(var(--tsg-red))]" />
                        ) : (
                          <Eye className="h-5 w-5 text-muted-foreground/50" />
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Hidden Cards Section */}
          {collection.hiddenCards.length > 0 && (
            <div className="mt-8">
              <h3 className="font-display text-sm font-bold uppercase tracking-widest text-[hsl(var(--tsg-red))] mb-3">
                Hidden Cards
              </h3>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {collection.hiddenCards.map((hc) => (
                  <div key={hc.id} className="opacity-50 grayscale">
                    <CardDisplay card={toCardData(hc.card)} size="sm" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Acquisitions */}
          {collection.recentAcquisitions.length > 0 && (
            <div className="mt-8">
              <h3 className="font-display text-sm font-bold uppercase tracking-widest text-[hsl(var(--tsg-blue))] mb-3">
                Recent Acquisitions
              </h3>
              <div className="flex gap-4 overflow-x-auto pb-2">
                  {collection.recentAcquisitions.map((ra) => (
                    <div key={ra.id} className="text-center">
                      <CardDisplay card={toCardData(ra.card)} size="sm" />
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {formatDate(ra.acquiredAt)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

function AchievementCard({ ach }: { ach: {
  id: number;
  name: string;
  description: string | null;
  iconUrl: string | null;
  badge: string | null;
  tag: string | null;
  xpReward: number;
  cardImageUrl?: string | null;
  cardName?: string | null;
  earnedAt: Date;
} }) {
  return (
    <Card className="glass border-[hsl(var(--tsg-blue)/0.3)] bg-[hsl(var(--tsg-blue)/0.05)] transition-all hover:scale-[1.02]">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border bg-background/40">
            {ach.iconUrl ? (
              <img src={ach.iconUrl} alt={ach.name} className="h-8 w-8 rounded object-cover" />
            ) : (
              <Trophy className="h-5 w-5 text-[hsl(var(--tsg-blue))]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="font-display font-bold">{ach.name}</p>
              {ach.badge && (
                <Badge variant="outline" className="text-[10px]">
                  {ach.badge}
                </Badge>
              )}
            </div>
            {ach.description && (
              <p className="line-clamp-1 text-xs text-muted-foreground">{ach.description}</p>
            )}
            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
              {ach.xpReward > 0 && (
                <span className="flex items-center gap-1 text-[hsl(var(--tsg-blue))]">
                  <Trophy className="h-3 w-3" />
                  {ach.xpReward} XP
                </span>
              )}
              {ach.cardName && (
                <span className="flex items-center gap-1">
                  <Gem className="h-3 w-3" />
                  {ach.cardName}
                </span>
              )}
              <span>{formatDate(ach.earnedAt)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
