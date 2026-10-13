import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { X, ExternalLink } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const IMPRESSION_STORAGE_PREFIX = "tsg_ad_impressed_";
const SESSION_STORAGE_PREFIX = "tsg_ad_session_impression_";
const DISMISSAL_STORAGE_PREFIX = "tsg_ad_dismissed_";
const DISMISSAL_DURATION_MS = 30 * 60 * 1000;

type AdCreative = {
  id: number;
  title: string;
  mediaUrl: string | null;
  mediaType: "image" | "video";
  destinationUrl: string;
  buttonText: string | null;
  linkLabel: string | null;
  bodyText: string | null;
  advertiser: string | null;
  logoUrl: string | null;
  secondaryLinkUrl: string | null;
  secondaryLinkLabel: string | null;
  layout: "banner" | "card" | "image_only" | "video" | "native";
  targetPages: string | null;
  desktopVisible: boolean;
  mobileVisible: boolean;
  width: string | null;
  height: string | null;
  aspectRatio: string | null;
  alignment: "left" | "center" | "right";
  backgroundColor: string | null;
  borderColor: string | null;
  textColor: string | null;
  showBorder: boolean;
  showShadow: boolean;
  textPosition: "top" | "bottom" | "overlay" | "outside";
  ctaStyle: "filled" | "outline" | "text";
  previewImageUrl: string | null;
};

type AdCampaign = {
  id: number;
  name: string;
  advertiser: string | null;
  description: string | null;
  placement: string;
  frequencyCap: number;
  creatives: AdCreative[];
};

function getStorageKey(prefix: string, campaignId: number, creativeId?: number) {
  return `${prefix}${campaignId}${creativeId ? `_${creativeId}` : ""}`;
}

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const CTA_BUTTON_VARIANTS = {
  filled: "bg-tsg-blue hover:bg-tsg-blue/90",
  outline: "border border-tsg-blue text-tsg-blue hover:bg-tsg-blue/10",
  text: "text-tsg-blue underline decoration-transparent hover:decoration-current",
} as const;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 768;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener?.("change", handler);
    return () => mql.removeEventListener?.("change", handler);
  }, []);
  return isMobile;
}

function getAlignmentClass(alignment: "left" | "center" | "right"): string {
  switch (alignment) {
    case "left":
      return "text-left";
    case "right":
      return "text-right";
    default:
      return "text-center";
  }
}

function getMediaContainerClass(creative: AdCreative, aspectRatio: string | null): string {
  const base = "relative w-full overflow-hidden rounded";
  if (aspectRatio) {
    return `${base} ${aspectRatio}`;
  }
  if (creative.mediaType === "video") {
    return `${base} aspect-video`;
  }
  return `${base} aspect-[4/3]`;
}

export function AdDisplay({
  placement,
  page,
  className,
}: {
  placement?: "sidebar" | "header" | "between_media_items" | "feed_top" | "feed_bottom";
  page?: string;
  className?: string;
}) {
  const utils = trpc.useUtils();
  const isMobile = useIsMobile();
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(() => {
    try {
      const stored = localStorage.getItem("tsg_ads_dismissed");
      return stored ? new Set(JSON.parse(stored) as number[]) : new Set();
    } catch {
      return new Set();
    }
  });
  const [impressionTracked, setImpressionTracked] = useState<Set<string>>(new Set());
  const impressionTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const { data: ads, error: adsError } = trpc.public.activeAds.useQuery(
    { placement, page, limit: 10 },
    { staleTime: 60_000, retry: 1 },
  );

  const adsList = useMemo((): AdCampaign[] => (ads ?? []) as AdCampaign[], [ads]);

  const trackEvent = trpc.public.trackAdEvent.useMutation({
    onSuccess: () => {
      void utils.public.activeAds.invalidate();
    },
  });

  const persistDismissed = useCallback((ids: Set<number>) => {
    try {
      localStorage.setItem("tsg_ads_dismissed", JSON.stringify(Array.from(ids)));
    } catch {
      // ignore
    }
  }, []);

  const handleDismiss = useCallback(
    (campaignId: number) => {
      const now = Date.now();
      localStorage.setItem(`${DISMISSAL_STORAGE_PREFIX}${campaignId}`, String(now));
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.add(campaignId);
        return next;
      });
      persistDismissed(new Set([...dismissedIds, campaignId]));
      trackEvent.mutate({ campaignId, eventType: "dismissal" });
    },
    [dismissedIds, setDismissedIds, persistDismissed, trackEvent],
  );

  const handleImpression = useCallback(
    (campaignId: number, creativeId: number) => {
      const key = `${campaignId}_${creativeId}`;
      if (impressionTracked.has(key)) return;
      if (impressionTimerRef.current[key]) return;

      const sessionKey = getStorageKey(SESSION_STORAGE_PREFIX, campaignId, creativeId);
      if (sessionStorage.getItem(sessionKey) === "1") {
        setImpressionTracked((prev) => new Set(prev).add(key));
        return;
      }

      const freqKey = getStorageKey(IMPRESSION_STORAGE_PREFIX, campaignId, creativeId);
      const now = Date.now();
      const lastImp = parseInt(localStorage.getItem(freqKey) ?? "0", 10);

      const campaign = adsList.find((a: AdCampaign) => a.id === campaignId);
      if (!campaign) return;

      const capMs = campaign.frequencyCap ? campaign.frequencyCap * 60_000 : 3 * 60_000;
      if (now - lastImp < capMs) {
        setImpressionTracked((prev) => new Set(prev).add(key));
        return;
      }

      impressionTimerRef.current[key] = setTimeout(() => {
        sessionStorage.setItem(sessionKey, "1");
        localStorage.setItem(freqKey, String(now));
        trackEvent.mutate({ campaignId, creativeId, eventType: "impression" });
        setImpressionTracked((prev) => new Set(prev).add(key));
        delete impressionTimerRef.current[key];
      }, 1000);
    },
    [impressionTracked, trackEvent, adsList],
  );

  const handleClick = (campaignId: number, creativeId: number, url: string) => {
    if (!isSafeUrl(url)) return;
    trackEvent.mutate({ campaignId, creativeId, eventType: "click" });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleSecondaryClick = (campaignId: number, creativeId: number, url: string | null) => {
    if (!url || !isSafeUrl(url)) return;
    trackEvent.mutate({ campaignId, creativeId, eventType: "click" });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Filter ads based on mobile visibility settings
  // Note: Dismissal cooldown is checked in handleDismiss and via a timer tick,
  // not during render (Date.now is impure per React compiler rules)
  const visibleAds = useMemo(() => {
    return adsList.filter((ad) => {
      if (dismissedIds.has(ad.id)) return false;
      const creative = ad.creatives?.[0];
      if (!creative) return false;
      if (isMobile && !creative.mobileVisible) return false;
      if (!isMobile && !creative.desktopVisible) return false;
      return true;
    });
  }, [adsList, dismissedIds, isMobile]);

  // Re-check dismissed ads after the cooldown period expires
  useEffect(() => {
    const checkExpired = () => {
      const expired: Set<number> = new Set();
      dismissedIds.forEach((id) => {
        const dismissedAt = parseInt(localStorage.getItem(`${DISMISSAL_STORAGE_PREFIX}${id}`) ?? "0", 10);
        if (Date.now() - dismissedAt >= DISMISSAL_DURATION_MS) {
          expired.add(id);
        }
      });
      if (expired.size > 0) {
        setDismissedIds((prev) => {
          const next = new Set(prev);
          expired.forEach((id) => next.delete(id));
          return next;
        });
      }
    };
    checkExpired();
    const interval = setInterval(checkExpired, 60000);
    return () => clearInterval(interval);
  }, [dismissedIds]);

   if (adsError) {
     console.warn(`[AdDisplay] Failed to fetch ads for placement=${placement} page=${page}:`, adsError.message);
     return null;
   }
   if (!ads || ads.length === 0) return null;
   if (visibleAds.length === 0) return null;

  return (
    <div className={cn("space-y-4", className)}>
      {visibleAds.map((ad) => {
        const creative = ad.creatives?.[0];
        if (!creative) return null;

        const adKey = `ad-${ad.id}-${creative.id}`;
        const alignmentClass = getAlignmentClass(creative.alignment);
        const ctaVariant = creative.ctaStyle && CTA_BUTTON_VARIANTS[creative.ctaStyle];
        const isImageOnly = creative.layout === "image_only";
        const borderWidth = creative.showBorder ? "border-2" : "";
        const shadowClass = creative.showShadow ? "shadow-md" : "";
        const borderColorStyle = creative.borderColor
          ? { borderColor: creative.borderColor }
          : {};
        const bgColorStyle = creative.backgroundColor
          ? { backgroundColor: creative.backgroundColor }
          : {};
        const textColorStyle = creative.textColor ? { color: creative.textColor } : {};

        const textClasses = cn(
          "transition-opacity",
          creative.textPosition === "overlay" && "absolute inset-0 flex flex-col justify-center",
          alignmentClass,
        );

        const intersectionRefs = (node: HTMLDivElement | null) => {
          if (!node) return;
          const observer = new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                if (entry.isIntersecting) {
                  handleImpression(ad.id, creative.id);
                  observer.disconnect();
                }
              });
            },
            { threshold: 0.5 },
          );
          observer.observe(node);
          return () => observer.disconnect();
        };

        const mediaNode = (
          <div className={cn("relative my-3 flex justify-center", alignmentClass)}>
            {creative.mediaUrl ? (
              <div
                className={cn(
                  getMediaContainerClass(creative, creative.aspectRatio),
                  borderWidth,
                  shadowClass,
                )}
                style={{ ...borderColorStyle, ...bgColorStyle }}
              >
                {creative.mediaType === "video" ? (
                  <video
                    src={creative.mediaUrl}
                    controls
                    className="h-full w-full object-cover"
                    preload="metadata"
                  />
                ) : (
                  <img
                    src={creative.mediaUrl}
                    alt={creative.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                )}
              </div>
            ) : (
              creative.previewImageUrl && (
                <img
                  src={creative.previewImageUrl}
                  alt={creative.title}
                  className="max-h-24 w-auto rounded object-cover opacity-60"
                  loading="lazy"
                />
              )
            )}
          </div>
        );

        return (
          <div
            key={adKey}
            ref={intersectionRefs}
            className={cn(
              "relative rounded-lg border bg-card p-4",
              borderWidth,
              shadowClass,
            )}
            style={{ ...borderColorStyle, ...bgColorStyle, ...textColorStyle }}
          >
            <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
              <Badge variant="outline" className="text-xs">
                Sponsored
              </Badge>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleDismiss(ad.id);
                }}
                className="rounded-full p-1 text-muted-foreground opacity-60 hover:opacity-100 hover:bg-accent hover:text-foreground"
                aria-label="Dismiss ad"
              >
                <X className="h-3 w-3" />
              </button>
            </div>

            {creative.logoUrl && !isImageOnly && (
              <div className="mb-2 flex items-center gap-2">
                <img
                  src={creative.logoUrl}
                  alt={creative.advertiser ?? "Advertiser"}
                  className="h-5 w-5 rounded object-cover"
                  loading="lazy"
                />
                <span className="text-xs font-medium text-muted-foreground">
                  {creative.advertiser}
                </span>
              </div>
            )}

            <div className={cn("pr-6 pt-2", textClasses)}>
              {!isImageOnly && (
                <>
                  <h4 className="font-medium">{creative.title}</h4>
                  {creative.bodyText && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {creative.bodyText}
                    </p>
                  )}
                </>
              )}
            </div>

            {mediaNode}

            {!isImageOnly && (
              <div className={cn("mt-3 flex items-center gap-2", alignmentClass)}>
                {creative.destinationUrl && isSafeUrl(creative.destinationUrl) && (
                  <Button
                    size="sm"
                    onClick={() => handleClick(ad.id, creative.id, creative.destinationUrl)}
                    className={ctaVariant}
                  >
                    {creative.buttonText || "Learn More"}
                  </Button>
                )}
                {creative.linkLabel &&
                  creative.destinationUrl &&
                  isSafeUrl(creative.destinationUrl) && (
                    <button
                      type="button"
                      onClick={() => handleClick(ad.id, creative.id, creative.destinationUrl)}
                      className="text-sm font-medium text-tsg-blue underline decoration-transparent hover:decoration-current"
                    >
                      {creative.linkLabel}
                      <ExternalLink className="ml-1 h-3 w-3 inline" />
                    </button>
                  )}
              </div>
            )}

            {!isImageOnly &&
              creative.secondaryLinkUrl &&
              isSafeUrl(creative.secondaryLinkUrl) && (
                <div
                  className="mt-2 cursor-pointer text-xs text-tsg-blue underline decoration-transparent hover:decoration-current"
                  onClick={() =>
                    handleSecondaryClick(ad.id, creative.id, creative.secondaryLinkUrl)
                  }
                >
                  {creative.secondaryLinkLabel || creative.secondaryLinkUrl}
                  <ExternalLink className="ml-1 h-3 w-3 inline" />
                </div>
              )}

            {!isImageOnly &&
              creative.destinationUrl &&
              isSafeUrl(creative.destinationUrl) && (
                <div
                  className="mt-1 cursor-pointer text-xs text-muted-foreground underline"
                  onClick={() => handleClick(ad.id, creative.id, creative.destinationUrl)}
                >
                  {creative.destinationUrl}
                </div>
              )}
          </div>
        );
      })}
    </div>
  );
}
