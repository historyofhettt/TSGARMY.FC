import { useState } from "react";
import {
  ImageIcon,
  ExternalLink,
  Calendar,
  User,
  Loader2,
  Search,
  Play,
  Star,
  Tags as TagIcon,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { PageLayout } from "@/components/PageLayout";
import { SectionHeading } from "@/components/SectionHeading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { AdDisplay } from "@/components/AdDisplay";
import type { RouterOutputs } from "@contracts/types";

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  edit_reel: { label: "Edit Reel", icon: "🎬" },
  fan_art: { label: "Fan Art", icon: "🎨" },
  montage: { label: "Montage", icon: "🎞️" },
  highlight: { label: "Highlight", icon: "🔥" },
  posters: { label: "Posters", icon: "🖼️" },
  thumbnail: { label: "Thumbnails", icon: "📸" },
  other: { label: "Other", icon: "⭐" },
};

const CATEGORY_FILTERS = [
  { value: "all", label: "All Categories" },
  ...Object.entries(CATEGORY_LABELS).map(([value, meta]) => ({ value, label: meta.label })),
];

type SpotlightItem = RouterOutputs["fanSpotlight"]["list"]["items"][number];

function resolveThumbnailUrl(item: SpotlightItem): string | null {
  if (item.thumbnailResolved) return item.thumbnailResolved;
  if (item.thumbnailUrl) return item.thumbnailUrl;
  if (item.youtubeVideoId) return `https://img.youtube.com/vi/${item.youtubeVideoId}/hqdefault.jpg`;
  return null;
}

function isYouTube(item: SpotlightItem): boolean {
  return !!(item.youtubeVideoId || item.embedUrl);
}

function SafeImg({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted/30">
        <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
      </div>
    );
  }
  return (
    <>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={cn("h-full w-full object-cover", className)}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.3s" }}
      />
    </>
  );
}

function SpotlightCard({ item }: { item: SpotlightItem }) {
  const thumbnail = resolveThumbnailUrl(item);
  const isYouTubeVideo = isYouTube(item);
  const accentColor = item.accentColor || "#00E1FF";
  const buttonText = item.buttonText || "Watch Original";
  const buttonUrl = item.buttonUrl || item.contentUrl || "";
  const creatorName = item.fanName || item.creator?.name || item.creator?.username || "Anonymous";
  const cardStyle = item.cardStyle ?? "card";

  if (cardStyle === "grid") {
    return (
      <a href={`/spotlight/${item.id}`} className="group block">
        <Card className="h-full border-border bg-background/60 transition-all duration-300 hover:border-[hsl(var(--tsg-blue)/0.6)] hover:shadow-[0_0_20px_hsl(var(--tsg-blue)/0.3)]">
          <CardContent className="p-0">
            <div className="relative aspect-video overflow-hidden">
              {thumbnail ? (
                <SafeImg src={thumbnail} alt={item.title} />
              ) : (
                <div className="flex h-full w-full items-center justify-center border-2 border-dashed border-border bg-muted/30">
                  <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
                </div>
              )}
              {isYouTubeVideo && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--tsg-red))]/90 text-white shadow-lg">
                    <Play className="h-7 w-7" />
                  </div>
                </div>
              )}
              {item.category && (
                <Badge
                  variant="secondary"
                  className="absolute left-2 top-2 border-none bg-[hsl(var(--tsg-navy)/0.8)] text-[hsl(var(--tsg-blue))] backdrop-blur-sm"
                >
                  {CATEGORY_LABELS[item.category]?.icon} {CATEGORY_LABELS[item.category]?.label}
                </Badge>
              )}
              {item.isFeatured && (
                <Badge className="absolute right-2 top-2 border-none bg-[hsl(var(--tsg-blue)/0.2)] text-[hsl(var(--tsg-blue))]">
                  <Star className="h-3 w-3" />
                </Badge>
              )}
            </div>
            <div className="p-4">
              {item.subtitle && <p className="text-xs text-muted-foreground">{item.subtitle}</p>}
              <CardTitle className="line-clamp-1 text-lg font-bold group-hover:text-[hsl(var(--tsg-blue))]">
                {item.title}
              </CardTitle>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                {item.creator?.avatar ? (
                  <img
                    src={item.creator.avatar}
                    alt={item.creator.name ?? item.creator.username ?? ""}
                    className="h-5 w-5 rounded-full object-cover"
                  />
                ) : (
                  <User className="h-3 w-3" />
                )}
                <span>{creatorName}</span>
              </div>
              {buttonUrl && (
                <a
                  href={buttonUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="mt-2 flex items-center gap-1 text-xs font-medium text-[hsl(var(--tsg-blue))] hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {buttonText}
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      </a>
    );
  }

  if (cardStyle === "banner") {
    return (
      <a href={`/spotlight/${item.id}`} className="group block">
        <Card className="border-border bg-background/60 transition-all duration-300 hover:border-[hsl(var(--tsg-blue)/0.6)] hover:shadow-[0_0_20px_hsl(var(--tsg-blue)/0.3)]">
          <CardContent className="p-0">
            <div className="relative aspect-video overflow-hidden">
              {thumbnail ? (
                <SafeImg src={thumbnail} alt={item.title} />
              ) : (
                <div className="flex h-full w-full items-center justify-center border-2 border-dashed border-border bg-muted/30">
                  <ImageIcon className="h-12 w-12 text-muted-foreground/50" />
                </div>
              )}
              {isYouTubeVideo && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--tsg-red))]/90 text-white shadow-lg">
                    <Play className="h-8 w-8" />
                  </div>
                </div>
              )}
              {item.category && (
                <Badge
                  variant="secondary"
                  className="absolute left-3 top-3 border-none bg-[hsl(var(--tsg-navy)/0.8)] text-[hsl(var(--tsg-blue))] backdrop-blur-sm"
                >
                  {CATEGORY_LABELS[item.category]?.icon} {CATEGORY_LABELS[item.category]?.label}
                </Badge>
              )}
            </div>
            <div className="p-5">
              {item.subtitle && <p className="text-sm text-muted-foreground">{item.subtitle}</p>}
              <h3
                className="font-display text-xl font-bold tracking-wide group-hover:text-[hsl(var(--tsg-blue))]"
                style={{ color: accentColor }}
              >
                {item.title}
              </h3>
              {item.description && (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {item.description}
                </p>
              )}
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  {item.creator?.avatar ? (
                    <img
                      src={item.creator.avatar}
                      alt={item.creator.name ?? item.creator.username ?? ""}
                      className="h-4 w-4 rounded-full object-cover"
                    />
                  ) : (
                    <User className="h-3 w-3" />
                  )}
                  <span>{creatorName}</span>
                </div>
                {item.tags && item.tags.length > 0 && (
                  <>
                    <span>·</span>
                    <div className="flex items-center gap-1">
                      <TagIcon className="h-3 w-3" />
                      {item.tags.slice(0, 3).map((t) => (
                        <Badge key={t} variant="secondary" className="border-none bg-[hsl(var(--tsg-navy)/0.5)] text-[10px]">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </>
                )}
              </div>
              {buttonUrl && (
                <a
                  href={buttonUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="mt-2 flex items-center gap-1 text-sm font-medium text-[hsl(var(--tsg-blue))] hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {buttonText}
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      </a>
    );
  }

  // Default card layout
  return (
    <a href={`/spotlight/${item.id}`} className="group block">
      <Card className="h-full border-border bg-background/60 transition-all duration-300 hover:border-[hsl(var(--tsg-blue)/0.6)] hover:shadow-[0_0_20px_hsl(var(--tsg-blue)/0.3)]">
        <CardHeader className="p-0">
          <div className="relative aspect-video overflow-hidden rounded-t-lg">
            {thumbnail ? (
              <SafeImg src={thumbnail} alt={item.title} />
            ) : (
              <div className="flex h-full w-full items-center justify-center border-2 border-dashed border-border bg-muted/30">
                <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
              </div>
            )}
            {isYouTubeVideo && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--tsg-red))]/90 text-white shadow-lg">
                  <Play className="h-7 w-7" />
                </div>
              </div>
            )}
            {item.category && (
              <Badge
                variant="secondary"
                className="absolute left-2 top-2 border-none bg-[hsl(var(--tsg-navy)/0.8)] text-[hsl(var(--tsg-blue))] backdrop-blur-sm"
              >
                {CATEGORY_LABELS[item.category]?.icon} {CATEGORY_LABELS[item.category]?.label}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {item.subtitle && <p className="text-xs text-muted-foreground">{item.subtitle}</p>}
          <CardTitle className="line-clamp-1 text-lg font-bold group-hover:text-[hsl(var(--tsg-blue))]">
            {item.title}
          </CardTitle>
          {item.description && (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
              {item.description}
            </p>
          )}
          <div className="mt-4 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              {item.creator?.avatar ? (
                <img
                  src={item.creator.avatar}
                  alt={item.creator.name ?? item.creator.username ?? ""}
                  className="h-3 w-3 rounded-full object-cover"
                />
              ) : (
                <User className="h-3 w-3" />
              )}
              <span>{creatorName}</span>
            </div>
            {buttonUrl && (
              <a
                href={buttonUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 font-medium text-[hsl(var(--tsg-blue))] hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-3 w-3" />
                {buttonText}
              </a>
            )}
          </div>
        </CardContent>
      </Card>
    </a>
  );
}

function FeaturedSpotlight({ item }: { item: SpotlightItem }) {
  const thumbnail = resolveThumbnailUrl(item);
  const isYouTubeVideo = isYouTube(item);
  const accentColor = item.accentColor || "#00E1FF";
  const buttonText = item.buttonText || "Watch Original";
  const buttonUrl = item.buttonUrl || item.contentUrl || "";
  const creatorName = item.fanName || item.creator?.name || item.creator?.username || "Anonymous";
  const publishDate = item.publishDate ?? item.createdAt;

  return (
    <a href={`/spotlight/${item.id}`} className="group block">
      <Card className="border-2 border-[hsl(var(--tsg-blue)/0.4)] bg-background/60 shadow-[0_0_25px_hsl(var(--tsg-blue)/0.15)] transition-all duration-300 hover:border-[hsl(var(--tsg-blue))] hover:shadow-[0_0_30px_hsl(var(--tsg-blue)/0.3)]">
        <CardContent className="p-0">
          <div className="relative aspect-video overflow-hidden rounded-lg">
            {thumbnail ? (
              <SafeImg src={thumbnail} alt={item.title} />
            ) : (
              <div className="flex h-full w-full items-center justify-center border-2 border-dashed border-border bg-muted/30">
                <ImageIcon className="h-12 w-12 text-muted-foreground/50" />
              </div>
            )}
            {isYouTubeVideo && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--tsg-red))]/90 text-white shadow-lg">
                  <Play className="h-8 w-8" />
                </div>
              </div>
            )}
            {item.category && (
              <Badge
                variant="secondary"
                className="absolute left-3 top-3 border-none bg-[hsl(var(--tsg-navy)/0.8)] text-[hsl(var(--tsg-blue))] backdrop-blur-sm"
              >
                {CATEGORY_LABELS[item.category]?.icon} {CATEGORY_LABELS[item.category]?.label}
              </Badge>
            )}
            {item.isFeatured && (
              <Badge className="absolute right-3 top-3 border-none bg-[hsl(var(--tsg-blue)/0.2)] text-[hsl(var(--tsg-blue))]">
                <Star className="h-3 w-3" />
              </Badge>
            )}
          </div>
          <div className="p-4">
            {item.subtitle && <p className="text-sm text-muted-foreground">{item.subtitle}</p>}
            <h3
              className="font-display text-xl font-bold tracking-wide group-hover:text-[hsl(var(--tsg-blue))]"
              style={{ color: accentColor }}
            >
              {item.title}
            </h3>
            {item.description && (
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                {item.description}
              </p>
            )}
            <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                {item.creator?.avatar ? (
                  <img
                    src={item.creator.avatar}
                    alt={item.creator.name ?? item.creator.username ?? ""}
                    className="h-4 w-4 rounded-full object-cover"
                  />
                ) : (
                  <User className="h-3 w-3" />
                )}
                <span>{creatorName}</span>
              </div>
              {publishDate && (
                <>
                  <span>·</span>
                  <Calendar className="h-3 w-3" />
                  <span>{formatDate(publishDate)}</span>
                </>
              )}
            </div>
            {item.tags && item.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {item.tags.slice(0, 5).map((t) => (
                  <Badge key={t} variant="secondary" className="border-none bg-[hsl(var(--tsg-navy)/0.5)] text-[10px]">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
            {buttonUrl && (
              <a
                href={buttonUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="mt-3 flex items-center gap-1 text-sm font-medium text-[hsl(var(--tsg-blue))] hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                {buttonText}
              </a>
            )}
          </div>
        </CardContent>
      </Card>
    </a>
  );
}

export default function FanSpotlight() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const {
    data: featuredData,
    isLoading: isLoadingFeatured,
    isError: isFeaturedError,
  } = trpc.fanSpotlight.featured.useQuery();

  const {
    data: listData,
    isLoading: isLoadingList,
    isError: isListError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.fanSpotlight.list.useInfiniteQuery(
    { limit: 24 },
    { getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined },
  );

  const allFeatured = featuredData?.items ?? [];
  const displayedItems = listData?.pages.flatMap((page) => page.items) ?? [];
  const query = searchQuery.toLowerCase();
  const filteredItems = displayedItems.filter((item) => {
    if (activeCategory !== "all" && item.category !== activeCategory) return false;
    if (!query) return true;
    return (
      item.title.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query) ||
      item.creator?.username?.toLowerCase().includes(query) ||
      item.creator?.name?.toLowerCase().includes(query) ||
      item.fanName?.toLowerCase().includes(query) ||
      item.tags?.some((tag) => tag.toLowerCase().includes(query))
    );
  });

  const handleCategoryChange = (value: string) => {
    setActiveCategory(value);
  };

  if (isLoadingList) {
    return (
      <PageLayout>
        <div className="mx-auto max-w-3xl py-16 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[hsl(var(--tsg-blue))]" />
          <p className="mt-4">Loading spotlight...</p>
        </div>
      </PageLayout>
    );
  }

  if (isListError) {
    return (
      <PageLayout>
        <div className="mx-auto max-w-6xl py-16 text-center">
          <ImageIcon className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold text-[hsl(var(--tsg-red))]">
            Failed to load spotlight
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Please try again later.
          </p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="mx-auto max-w-6xl px-4 py-12">
        {/* Header */}
        <div className="mb-12 text-center">
          <SectionHeading
            kicker="TSG Community"
            title="Fan Spotlight"
            description="Showcasing the best creative works from the TSG community — edits, art, highlights, and more."
            align="center"
          />
        </div>

        {/* Featured Section */}
        {!isLoadingFeatured && !isFeaturedError && allFeatured.length > 0 && (
          <section className="mb-16">
            <h2 className="mb-6 font-display text-xl font-bold tracking-wide text-[hsl(var(--tsg-blue))]">
              Featured Creators
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {allFeatured.slice(0, 3).map((item) => (
                <FeaturedSpotlight key={item.id} item={item} />
              ))}
            </div>
          </section>
        )}

        {/* Controls */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {CATEGORY_FILTERS.map((filter) => (
              <button
                key={filter.value}
                 onClick={() => handleCategoryChange(filter.value)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-all",
                  activeCategory === filter.value
                    ? "bg-[hsl(var(--tsg-blue))] text-[hsl(var(--tsg-navy))] shadow-[0_0_15px_hsl(var(--tsg-blue)/0.5)]"
                    : "border border-border text-muted-foreground hover:border-[hsl(var(--tsg-blue)/0.4)] hover:text-[hsl(var(--tsg-blue))]",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search spotlight..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 border-border bg-background/60"
            />
          </div>
        </div>

        {/* Search results count */}
        {searchQuery && (
          <p className="mb-4 text-sm text-muted-foreground">
            Showing {filteredItems.length} result{filteredItems.length !== 1 ? "s" : ""} for &quot;{searchQuery}&quot;
          </p>
        )}

        {/* Feed Top Ad */}
        <div className="mb-6">
          <AdDisplay placement="feed_top" page="fan-spotlight" />
        </div>

        {/* Grid */}
        {filteredItems.length === 0 ? (
          <div className="py-16 text-center">
            <ImageIcon className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold">No spotlight entries found</h3>
            <p className="mt-2 text-muted-foreground">
              {searchQuery
                ? "Try adjusting your search or category filter."
                : "Check back soon — new creative works are added regularly."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredItems.map((item) => (
              <SpotlightCard key={item.id} item={item} />
            ))}
          </div>
        )}

        {/* Load more */}
        {hasNextPage && (
          <div className="mt-8 text-center">
            <Button
              variant="outline"
              onClick={() => void fetchNextPage()}
              disabled={isFetchingNextPage}
              className="border-border text-[hsl(var(--tsg-blue))]"
            >
              {isFetchingNextPage ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading more...
                </>
              ) : (
                "Load More"
              )}
            </Button>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
