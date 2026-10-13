import { useState, useRef } from "react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { trpc } from "@/providers/trpc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Eye,
  EyeOff,
  Star,
  Trash2,
  Save,
  Search,
  ExternalLink,
  User,
  Calendar,
  CalendarDays,
  Plus,
  Pencil,
  X,
  ImageIcon,
  Play,
  Monitor,
  Smartphone,
} from "lucide-react";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ImageUpload } from "@/components/admin/ImageUpload";
import type { RouterInputs, RouterOutputs } from "@contracts/types";

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  edit_reel: { label: "Edit Reel", icon: "🎬" },
  fan_art: { label: "Fan Art", icon: "🎨" },
  montage: { label: "Montage", icon: "🎞️" },
  highlight: { label: "Highlight", icon: "🔥" },
  posters: { label: "Posters", icon: "🖼️" },
  thumbnail: { label: "Thumbnails", icon: "📸" },
  other: { label: "Other", icon: "⭐" },
};

const CATEGORIES = Object.entries(CATEGORY_LABELS).map(([value, meta]) => ({
  value,
  label: meta.label,
  icon: meta.icon,
}));

const STATUS_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: "draft", label: "Draft", color: "text-muted-foreground" },
  { value: "pending", label: "Pending Review", color: "text-muted-foreground" },
  { value: "approved", label: "Approved", color: "text-[hsl(var(--tsg-blue))]" },
  { value: "rejected", label: "Rejected", color: "text-[hsl(var(--tsg-red))]" },
];

const CARD_STYLE_OPTIONS = [
  { value: "card", label: "Card", desc: "Compact card layout" },
  { value: "grid", label: "Grid", desc: "Grid-style layout" },
  { value: "banner", label: "Banner", desc: "Full-width banner" },
];

type SpotlightEntry = RouterOutputs["fanSpotlight"]["listAll"][number];
type SpotlightCategory = NonNullable<RouterInputs["fanSpotlight"]["create"]["category"]>;

type EditFormProps = {
  entry: SpotlightEntry | null;
  onClose: () => void;
  onSuccess: () => void;
};

type FormValues = {
  title: string;
  subtitle: string;
  fanName: string;
  creatorProfileUrl: string;
  description: string;
  category: SpotlightCategory;
  tags: string;
  contentUrl: string;
  embedUrl: string;
  thumbnailUrl: string;
  thumbnailKey: string | null;
   mediaItemId: string;
   additionalImageKeys: string[];
   buttonText: string;
  buttonUrl: string;
  accentColor: string;
  cardStyle: "grid" | "card" | "banner";
  isApproved: boolean;
  isFeatured: boolean;
  status: string;
  publishDate: string;
  adminNotes: string;
};

const DEFAULT_FORM: FormValues = {
  title: "",
  subtitle: "",
  fanName: "",
  creatorProfileUrl: "",
  description: "",
  category: "other",
  tags: "",
  contentUrl: "",
  embedUrl: "",
  thumbnailUrl: "",
  thumbnailKey: null,
   mediaItemId: "",
   additionalImageKeys: [],
   buttonText: "",
  buttonUrl: "",
  accentColor: "",
  cardStyle: "card",
  isApproved: false,
  isFeatured: false,
  status: "draft",
  publishDate: "",
  adminNotes: "",
};

function isValidUrl(input: string): boolean {
  try {
    const url = new URL(input);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function extractYouTubeVideoId(input: string): string | null {
  try {
    const url = new URL(input.trim());
    if (url.hostname === "youtu.be") return url.pathname.slice(1) || null;
    if (url.hostname.includes("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v) return v;
      const parts = url.pathname.split("/");
      const idx = parts.findIndex((p) => ["embed", "v", "live", "shorts"].includes(p));
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    }
  } catch {
    return null;
  }
  return null;
}

function resolveThumbnail(form: Pick<FormValues, "thumbnailUrl" | "thumbnailKey" | "contentUrl">): string | null {
  if (form.thumbnailUrl) return form.thumbnailUrl;
  if (form.thumbnailKey) return `/uploads/${form.thumbnailKey}`;
  if (form.contentUrl) {
    const videoId = extractYouTubeVideoId(form.contentUrl);
    if (videoId) return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  }
  return null;
}

function SpotlightPreview({ values }: { values: Omit<FormValues, "tags"> & { tags: string[] } }) {
  const thumbnail = resolveThumbnail(values);
  const isYouTube = !!(values.contentUrl && extractYouTubeVideoId(values.contentUrl));
  const cardStyle = values.cardStyle;
  const accentColor = values.accentColor || "#00E1FF";
  const displayValue = (v: string) => (v && v.trim() ? v.trim() : null);

  const title = displayValue(values.title);
  const subtitle = displayValue(values.subtitle);
  const fanName = displayValue(values.fanName);
  const description = displayValue(values.description);
  const category = displayValue(values.category);
  const buttonText = displayValue(values.buttonText) || (values.contentUrl ? "Watch Original" : null);
  const buttonUrl = displayValue(values.buttonUrl) || values.contentUrl;

  if (cardStyle === "grid") {
    return (
      <div className="relative overflow-hidden rounded-xl border border-border bg-[hsl(var(--tsg-navy)/0.5)] aspect-[16/12]">
        {thumbnail ? (
          <img src={thumbnail} alt={title || "Preview"} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
          </div>
        )}
        {isYouTube && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--tsg-red))]/90 text-white shadow-lg">
              <Play className="h-6 w-6" />
            </div>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4">
          {category && (
            <Badge
              variant="secondary"
              className="mb-1 border-none bg-[hsl(var(--tsg-navy)/0.8)] text-[hsl(var(--tsg-blue))] text-[10px] px-1 py-0"
            >
              {CATEGORY_LABELS[category]?.icon} {CATEGORY_LABELS[category]?.label}
            </Badge>
          )}
          {title && <h3 className="font-display text-lg font-bold text-white">{title}</h3>}
          {subtitle && <p className="text-sm text-gray-300">{subtitle}</p>}
        </div>
      </div>
    );
  }

  if (cardStyle === "banner") {
    return (
      <div className="relative overflow-hidden rounded-xl border border-border bg-[hsl(var(--tsg-navy)/0.5)] aspect-[16/6]">
        {thumbnail ? (
          <img src={thumbnail} alt={title || "Preview"} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
          </div>
        )}
        {isYouTube && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--tsg-red))]/90 text-white shadow-lg">
              <Play className="h-6 w-6" />
            </div>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6">
          {category && (
            <Badge
              variant="secondary"
              className="mb-2 border-none bg-[hsl(var(--tsg-navy)/0.8)] text-[hsl(var(--tsg-blue))] text-[10px] px-1 py-0"
            >
              {CATEGORY_LABELS[category]?.icon} {CATEGORY_LABELS[category]?.label}
            </Badge>
          )}
          {title && <h2 className="font-display text-2xl font-bold text-white">{title}</h2>}
          {subtitle && <p className="mt-1 text-lg text-gray-300">{subtitle}</p>}
          {buttonUrl && buttonText && (
            <a
              href={buttonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[hsl(var(--tsg-blue))] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3 w-3" />
              {buttonText}
            </a>
          )}
        </div>
      </div>
    );
  }

  // Default: card layout
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-[hsl(var(--tsg-navy)/0.5)]">
      <div className="relative aspect-video overflow-hidden bg-muted/30">
        {thumbnail ? (
          <img src={thumbnail} alt={title || "Preview"} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
          </div>
        )}
        {isYouTube && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--tsg-red))]/90 text-white shadow-lg">
              <Play className="h-6 w-6" />
            </div>
          </div>
        )}
        {category && (
          <Badge
            variant="secondary"
            className="absolute left-2 top-2 border-none bg-[hsl(var(--tsg-navy)/0.8)] text-[hsl(var(--tsg-blue))] text-[10px] px-1 py-0"
          >
            {CATEGORY_LABELS[category]?.icon} {CATEGORY_LABELS[category]?.label}
          </Badge>
        )}
      </div>
      <div className="p-4 space-y-2">
        {title && <h3 className="font-display text-lg font-bold text-[hsl(var(--tsg-blue))]" style={{ color: accentColor }}>{title}</h3>}
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        {fanName && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            <span>By {fanName}</span>
          </div>
        )}
        {description && <p className="text-sm text-muted-foreground line-clamp-3">{description}</p>}
        {buttonUrl && buttonText && (
          <a
            href={buttonUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-[hsl(var(--tsg-blue))] hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3 w-3" />
            {buttonText}
          </a>
        )}
      </div>
    </div>
  );
}

function EditForm({ entry, onClose, onSuccess }: EditFormProps) {
  const [form, setForm] = useState<FormValues>(
    entry
      ? {
          title: entry.title ?? "",
          subtitle: entry.subtitle ?? "",
          fanName: entry.fanName ?? "",
          creatorProfileUrl: entry.creatorProfileUrl ?? "",
          description: entry.description ?? "",
          category: entry.category && CATEGORY_LABELS[entry.category] ? entry.category as SpotlightCategory : "other",
          tags: entry.tags ? entry.tags.join(", ") : "",
          contentUrl: entry.contentUrl ?? "",
          embedUrl: entry.embedUrl ?? "",
          thumbnailUrl: entry.thumbnailUrl ?? "",
          thumbnailKey: entry.thumbnailKey,
           mediaItemId: entry.mediaItemId ? String(entry.mediaItemId) : "",
           additionalImageKeys: entry.additionalImageKeys ?? [],
           buttonText: entry.buttonText ?? "",
          buttonUrl: entry.buttonUrl ?? "",
          accentColor: entry.accentColor ?? "",
          cardStyle: entry.cardStyle ?? "card",
          isApproved: entry.isApproved ?? false,
          isFeatured: entry.isFeatured ?? false,
          status: entry.status ?? "draft",
          publishDate: entry.publishDate ? entry.publishDate.toISOString().slice(0, 10) : "",
          adminNotes: entry.adminNotes ?? "",
        }
      : { ...DEFAULT_FORM },
  );

  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(
    entry?.thumbnailResolved ?? entry?.thumbnailUrl ?? null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"content" | "preview">("content");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");

  const utils = trpc.useUtils();

  const createMut = trpc.fanSpotlight.create.useMutation({
    onSuccess: () => {
      utils.fanSpotlight.listAll.invalidate();
      utils.fanSpotlight.list.invalidate();
      utils.fanSpotlight.featured.invalidate();
      onSuccess();
    },
    onError: (e) => {
      setSubmitError(e.message);
      setIsSubmitting(false);
    },
  });

  const updateMut = trpc.fanSpotlight.update.useMutation({
    onSuccess: () => {
      utils.fanSpotlight.listAll.invalidate();
      utils.fanSpotlight.list.invalidate();
      utils.fanSpotlight.featured.invalidate();
      onSuccess();
    },
    onError: (e) => {
      setSubmitError(e.message);
      setIsSubmitting(false);
    },
  });

  const updateField = (field: keyof FormValues, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSubmitError(null);
  };

  const handleThumbnailUpload = (key: string | null, url: string | null) => {
    if (key) setForm((prev) => ({ ...prev, thumbnailKey: key }));
    if (url) {
      setForm((prev) => ({ ...prev, thumbnailUrl: "" }));
      setThumbnailPreview(url);
    }
    if (!key && !url) setThumbnailPreview(null);
  };

  const handleThumbnailUrlChange = (url: string) => {
    updateField("thumbnailUrl", url);
    setThumbnailPreview(url || resolveThumbnail(form) || null);
  };

  const handleThumbnailRemove = () => {
    updateField("thumbnailKey", null);
    updateField("thumbnailUrl", "");
    setThumbnailPreview(null);
  };

  const validateUrl = (label: string, value: string): string | null => {
    if (!value.trim()) return null;
    if (!isValidUrl(value)) return `${label} is not a valid URL (must include http:// or https://).`;
    return null;
  };

  const handleSubmit = async (isPublish: boolean) => {
    setSubmitError(null);

    const title = form.title.trim();
    if (!title) {
      setSubmitError("Title is required.");
      return;
    }

    // Validate all URLs
    const urlChecks = [
      ["Content URL", form.contentUrl],
      ["Embed URL", form.embedUrl],
      ["Thumbnail URL", form.thumbnailUrl],
      ["Creator profile URL", form.creatorProfileUrl],
      ["Button URL", form.buttonUrl],
    ];
    for (const [label, value] of urlChecks) {
      const err = validateUrl(label as string, value as string);
      if (err) {
        setSubmitError(err);
        return;
      }
    }

    if (form.accentColor && !/^#?[0-9A-Fa-f]{3,8}$/.test(form.accentColor)) {
      setSubmitError("Accent color must be a valid hex code (e.g. #00E1FF or 00E1FF).");
      return;
    }

    const payload: Parameters<typeof createMut.mutateAsync>[0] = {
      title: title,
      subtitle: form.subtitle.trim() || undefined,
      fanName: form.fanName.trim() || undefined,
      creatorProfileUrl: form.creatorProfileUrl.trim() || undefined,
      description: form.description.trim() || undefined,
      category: form.category || "other",
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0),
      contentUrl: form.contentUrl.trim() || undefined,
      embedUrl: form.embedUrl.trim() || undefined,
      thumbnailKey: form.thumbnailKey ?? undefined,
      thumbnailUrl: form.thumbnailUrl.trim() || undefined,
      buttonText: form.buttonText.trim() || undefined,
      buttonUrl: form.buttonUrl.trim() || undefined,
      accentColor: form.accentColor.trim() || undefined,
      cardStyle: form.cardStyle,
      isApproved: isPublish,
      isFeatured: form.isFeatured,
      status: isPublish ? "approved" : (form.status === "approved" ? "approved" : "draft"),
      publishDate: form.publishDate ? new Date(form.publishDate) : undefined,
      adminNotes: form.adminNotes.trim() || undefined,
    };

    if (form.mediaItemId) {
      payload.mediaItemId = parseInt(form.mediaItemId, 10);
    }
    if (form.additionalImageKeys && form.additionalImageKeys.length > 0) {
      payload.additionalImageKeys = form.additionalImageKeys;
    }
    if (isPublish && form.status === "approved" && form.isFeatured) {
      payload.isFeatured = true;
    }

    setIsSubmitting(true);
    try {
      if (entry) {
        await updateMut.mutateAsync({ id: entry.id, ...payload });
      } else {
        await createMut.mutateAsync(payload);
      }
      // isSubmitting is set false in onError; success calls onSuccess which closes modal
    } catch {
      // handled by onError callback
    }
  };

  const handleSaveDraft = () => {
    handleSubmit(false);
  };

  const handlePublish = () => {
    handleSubmit(true);
  };

  const handleCancel = () => {
    if (form.title.trim() || form.description.trim() || form.contentUrl.trim() || form.thumbnailUrl.trim()) {
      if (!confirm("You have unsaved changes. Close without saving?")) return;
    }
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) handleCancel();
  };

  const tagInputRef = useRef<HTMLInputElement>(null);
  const [tags, setTags] = useState<string[]>(entry?.tags ?? []);

  const handleTagAdd = (tag: string) => {
    if (tag.trim() && !tags.includes(tag.trim())) {
      setTags([...tags, tag.trim()]);
      updateField("tags", [...tags, tag.trim()].join(", "));
    }
    if (tagInputRef.current) tagInputRef.current.value = "";
  };

  const handleTagRemove = (tag: string) => {
    const newTags = tags.filter((t) => t !== tag);
    setTags(newTags);
    updateField("tags", newTags.join(", "));
  };

  const previewContent = { ...form, tags };
  const isYouTube = !!(form.contentUrl && extractYouTubeVideoId(form.contentUrl));
  const thumbnailSrc = thumbnailPreview || resolveThumbnail(form);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <Card
        className="w-full max-w-6xl border-border bg-[hsl(var(--tsg-navy))] max-h-[95vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader>
          <CardTitle className="text-xl">
            {entry ? `Edit Spotlight Entry #${entry.id}` : "Create New Spotlight Entry"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            All fields are optional except Title. Fill only what you need.
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {submitError && (
            <div className="rounded-md border border-[hsl(var(--tsg-red))/0.3] bg-[hsl(var(--tsg-red))/0.1] p-3 text-sm text-[hsl(var(--tsg-red))]">
              {submitError}
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex border-b border-border">
            <button
              type="button"
              onClick={() => setActiveTab("content")}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                activeTab === "content"
                  ? "border-[hsl(var(--tsg-blue))] text-[hsl(var(--tsg-blue))]"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              Content Fields
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                activeTab === "preview"
                  ? "border-[hsl(var(--tsg-blue))] text-[hsl(var(--tsg-blue))]"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              Live Preview
            </button>
          </div>

          <div className={cn("transition-all", activeTab !== "content" && "hidden")}>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Left column — form fields */}
              <div className="space-y-5 lg:col-span-2">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Title *</label>
                    <Input
                      value={form.title}
                      onChange={(e) => updateField("title", e.target.value)}
                      placeholder="e.g. Epic TSG Edit 2025"
                      maxLength={255}
                      className="mt-1 border-border bg-background/60"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Subtitle</label>
                    <Input
                      value={form.subtitle}
                      onChange={(e) => updateField("subtitle", e.target.value)}
                      placeholder="e.g. A player's journey from amateur to pro"
                      maxLength={255}
                      className="mt-1 border-border bg-background/60"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Creator / Fan Name</label>
                    <Input
                      value={form.fanName}
                      onChange={(e) => updateField("fanName", e.target.value)}
                      placeholder="e.g. PlayerX"
                      maxLength={255}
                      className="mt-1 border-border bg-background/60"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Creator Profile URL</label>
                    <Input
                      value={form.creatorProfileUrl}
                      onChange={(e) => updateField("creatorProfileUrl", e.target.value)}
                      placeholder="https://twitter.com/playerx"
                      maxLength={1024}
                      className="mt-1 border-border bg-background/60"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Description / Caption</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => updateField("description", e.target.value)}
                    placeholder="Tell us about this work..."
                    maxLength={2000}
                    className="mt-1 w-full rounded-md border border-border bg-background/60 p-2 text-sm outline-none"
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Category</label>
                    <select
                      value={form.category}
                      onChange={(e) => updateField("category", e.target.value as SpotlightCategory)}
                      className="mt-1 w-full rounded-md border border-border bg-background/60 p-2 text-sm"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.icon} {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Card Style</label>
                    <select
                      value={form.cardStyle}
                      onChange={(e) => updateField("cardStyle", e.target.value as FormValues["cardStyle"])}
                      className="mt-1 w-full rounded-md border border-border bg-background/60 p-2 text-sm"
                    >
                      {CARD_STYLE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label} — {o.desc}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Tags</label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="border-none bg-[hsl(var(--tsg-navy)/0.7)] text-[hsl(var(--tsg-blue))] text-[11px] px-2 py-0.5"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleTagRemove(tag)}
                          className="ml-1 rounded-full p-0.5 hover:bg-[hsl(var(--tsg-red))/0.2]"
                        >
                          <X className="h-3 w-3 text-[hsl(var(--tsg-red))]" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <input
                    ref={tagInputRef}
                    type="text"
                    placeholder="Type and press Enter to add tags (max 10)"
                    className="mt-2 w-full rounded-md border border-border bg-background/60 p-2 text-sm outline-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && tags.length < 10) {
                        e.preventDefault();
                        handleTagAdd(e.currentTarget.value);
                      }
                    }}
                    maxLength={64}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tags.length}/10 tags. Press Enter to add, click × to remove.
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">Content URL</label>
                  <Input
                    value={form.contentUrl}
                    onChange={(e) => updateField("contentUrl", e.target.value)}
                    placeholder="YouTube, Instagram Reel, TikTok, Twitter, or any external link"
                    maxLength={1024}
                    className="mt-1 border-border bg-background/60"
                  />
                  {isYouTube && (
                    <p className="mt-1 text-xs text-[hsl(var(--tsg-blue))]">
                      Social media / video URL detected — thumbnail will be auto-loaded.
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium">Embed URL (Optional)</label>
                  <Input
                    value={form.embedUrl}
                    onChange={(e) => updateField("embedUrl", e.target.value)}
                    placeholder="iframe-compatible embed URL (e.g. https://www.youtube.com/embed/VIDEO_ID)"
                    maxLength={1024}
                    className="mt-1 border-border bg-background/60"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    If empty, YouTube embed is auto-generated from Content URL.
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">Thumbnail Image</label>
                  <div className="mt-1 flex items-center gap-4">
                    <ImageUpload
                      value={form.thumbnailKey}
                      previewUrl={thumbnailPreview || undefined}
                      category="team-media"
                      label="Upload thumbnail"
                      onUploaded={handleThumbnailUpload}
                    />
                    <div className="flex-1">
                      <Input
                        value={form.thumbnailUrl}
                        onChange={(e) => handleThumbnailUrlChange(e.target.value)}
                        placeholder="Or paste external thumbnail URL"
                        maxLength={512}
                        className="border-border bg-background/60"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Upload an image or enter a URL. Max 8 MB.
                      </p>
                    </div>
                    {(form.thumbnailKey || form.thumbnailUrl) && (
                      <button
                        type="button"
                        onClick={handleThumbnailRemove}
                        className="rounded-md border border-[hsl(var(--tsg-red))/0.3] p-1 text-[hsl(var(--tsg-red))] hover:bg-[hsl(var(--tsg-red))/0.15]"
                        title="Remove thumbnail"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Additional Image URLs</label>
                  <Input
                    value={form.additionalImageKeys.join(", ")}
                    onChange={(e) => updateField("additionalImageKeys", e.target.value.split(",").map((s) => s.trim()).filter((s) => s))}
                    placeholder="https://example.com/img1.jpg, https://example.com/img2.jpg"
                    maxLength={2048}
                    className="mt-1 border-border bg-background/60"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Enter multiple image URLs, comma-separated. These will be displayed as additional media.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Button Text</label>
                    <Input
                      value={form.buttonText}
                      onChange={(e) => updateField("buttonText", e.target.value)}
                      placeholder="e.g. Watch Original, View Art"
                      maxLength={128}
                      className="mt-1 border-border bg-background/60"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Button URL</label>
                    <Input
                      value={form.buttonUrl}
                      onChange={(e) => updateField("buttonUrl", e.target.value)}
                      placeholder="Defaults to Content URL"
                      maxLength={1024}
                      className="mt-1 border-border bg-background/60"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Accent Color</label>
                  <div className="mt-1 flex items-center gap-3">
                    <Input
                      value={form.accentColor}
                      onChange={(e) => updateField("accentColor", e.target.value)}
                      placeholder="e.g. #00E1FF or 00E1FF"
                      maxLength={16}
                      className="border-border bg-background/60"
                    />
                    <input
                      type="color"
                      value={form.accentColor || "#00E1FF"}
                      onChange={(e) => updateField("accentColor", e.target.value)}
                      className="h-8 w-8 cursor-pointer rounded border border-border"
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Overrides the default TSG electric blue for the title and accents.
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">Publish Date</label>
                  <div className="mt-1 relative">
                    <CalendarDays className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="date"
                      value={form.publishDate}
                      onChange={(e) => updateField("publishDate", e.target.value)}
                      className="w-full rounded-md border border-border bg-background/60 pl-8 pr-2 py-1.5 text-sm outline-none"
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Leave empty for immediate publishing. Schedule for a future date.
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">Admin Notes (Internal)</label>
                  <textarea
                    value={form.adminNotes}
                    onChange={(e) => updateField("adminNotes", e.target.value)}
                    placeholder="Internal moderation notes..."
                    maxLength={2000}
                    className="mt-1 w-full rounded-md border border-border bg-background/60 p-2 text-sm outline-none"
                    rows={3}
                  />
                </div>

                <div className="flex gap-6 pt-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.isApproved}
                      onChange={(e) => updateField("isApproved", e.target.checked)}
                    />
                    Published (visible publicly)
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.isFeatured}
                      onChange={(e) => updateField("isFeatured", e.target.checked)}
                      disabled={!form.isApproved}
                    />
                    Featured (prominently displayed)
                  </label>
                </div>
              </div>

              {/* Right column — live preview */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="font-display text-sm font-bold tracking-wider text-muted-foreground uppercase">
                    Live Preview
                  </h4>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setPreviewMode("desktop")}
                      className={cn(
                        "rounded-md border border-border p-1.5 text-xs transition-colors",
                        previewMode === "desktop"
                          ? "bg-[hsl(var(--tsg-blue))/0.15] text-[hsl(var(--tsg-blue))]"
                          : "hover:bg-accent",
                      )}
                      title="Desktop preview"
                    >
                      <Monitor className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode("mobile")}
                      className={cn(
                        "rounded-md border border-border p-1.5 text-xs transition-colors",
                        previewMode === "mobile"
                          ? "bg-[hsl(var(--tsg-blue))/0.15] text-[hsl(var(--tsg-blue))]"
                          : "hover:bg-accent",
                      )}
                      title="Mobile preview"
                    >
                      <Smartphone className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                <div
                  className={cn(
                    "relative mx-auto overflow-hidden rounded-xl border border-border bg-[hsl(var(--tsg-navy)/0.7)]",
                    previewMode === "desktop"
                      ? "aspect-[16/9] w-full max-w-full"
                      : "aspect-[9/19] w-full max-w-xs",
                  )}
                >
                  <SpotlightPreview values={previewContent} />
                </div>

                <div className="mt-3 space-y-2">
                  <p className="text-xs text-muted-foreground">Layout: {form.cardStyle}</p>
                  <p className="text-xs text-muted-foreground">Thumbnail: {thumbnailSrc || "None"}</p>
                  {isYouTube && <p className="text-xs text-[hsl(var(--tsg-blue))]">YouTube video detected</p>}
                </div>
              </div>
            </div>
          </div>

          <div
            className={cn("space-y-4 transition-all", activeTab !== "preview" && "hidden")}
          >
            <div className="flex items-center justify-center gap-3 py-8">
              <p className="text-sm text-muted-foreground">
                Switch to the "Live Preview" tab to see how this entry will appear.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="ghost" onClick={handleCancel} disabled={isSubmitting}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={isSubmitting}
              className="border-border text-muted-foreground"
            >
              {isSubmitting && entry === null ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {entry ? "Save Draft" : "Save as Draft"}
            </Button>
            <Button
              onClick={handlePublish}
              disabled={isSubmitting}
              className="bg-[hsl(var(--tsg-blue))] font-semibold text-[hsl(var(--tsg-navy))] hover:bg-[hsl(var(--tsg-blue)/0.9)]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {entry ? "Updating..." : "Creating..."}
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {entry ? "Save & Publish" : "Create & Publish"}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function FanSpotlightAdmin() {
  const utils = trpc.useUtils();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [formEntry, setFormEntry] = useState<SpotlightEntry | null>(null);

  const { data: entries, isLoading, isError, error } = trpc.fanSpotlight.listAll.useQuery();

  const updateMutation = trpc.fanSpotlight.update.useMutation({
    onSuccess: () => {
      utils.fanSpotlight.listAll.invalidate();
      utils.fanSpotlight.list.invalidate();
      utils.fanSpotlight.featured.invalidate();
      toast.success("Entry updated.");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.fanSpotlight.delete.useMutation({
    onSuccess: () => {
      utils.fanSpotlight.listAll.invalidate();
      utils.fanSpotlight.list.invalidate();
      utils.fanSpotlight.featured.invalidate();
      toast.success("Entry deleted.");
    },
    onError: (e) => toast.error(e.message),
  });

  const reorderMutation = trpc.fanSpotlight.reorder.useMutation({
    onSuccess: () => {
      utils.fanSpotlight.listAll.invalidate();
      utils.fanSpotlight.list.invalidate();
      toast.success("Display order updated.");
    },
    onError: (e) => toast.error(e.message),
  });

  const filtered = (entries ?? []).filter((e) => {
    const matchesSearch =
      !searchQuery ||
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.fanName?.toLowerCase()?.includes(searchQuery.toLowerCase()) ||
      e.creator?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.creator?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || e.status === statusFilter;
    const matchesCategory = categoryFilter === "all" || e.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const handleEdit = (entry: SpotlightEntry) => {
    setFormEntry(entry);
    setShowForm(true);
  };

  const handleCreate = () => {
    setFormEntry(null);
    setShowForm(true);
  };

  const handleFeature = async (id: number, current: boolean) => {
    await updateMutation.mutateAsync({ id, isFeatured: !current });
  };

  const handlePublish = async (id: number, published: boolean) => {
    const entry = filtered.find((e) => e.id === id);
    if (!entry) return;
    await updateMutation.mutateAsync({
      id,
      isApproved: published,
      status: published ? "approved" : (entry.status === "approved" ? "approved" : "draft"),
    });
  };

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`Remove "${title}"? This cannot be undone.`)) return;
    await deleteMutation.mutateAsync({ id });
  };

  const handleReorder = async (newOrder: SpotlightEntry[]) => {
    const ids = newOrder.map((e) => e.id);
    await reorderMutation.mutateAsync({ ids });
  };

  const dragStartIdRef = useRef<number | null>(null);

  const handleDragStart = (id: number) => {
    dragStartIdRef.current = id;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    if (dragStartIdRef.current === null || dragStartIdRef.current === targetId) return;

    const startId = dragStartIdRef.current;
    dragStartIdRef.current = null;

    const newList = [...filtered];
    const fromIdx = newList.findIndex((item) => item.id === startId);
    const toIdx = newList.findIndex((item) => item.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const [moved] = newList.splice(fromIdx, 1);
    newList.splice(toIdx, 0, moved);
    handleReorder(newList);
  };

  if (isLoading) {
    return (
      <AdminLayout title="Fan Spotlight">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading entries...</span>
        </div>
      </AdminLayout>
    );
  }

  if (isError) {
    return (
      <AdminLayout title="Fan Spotlight">
        <p className="text-[hsl(var(--tsg-red))]">Error: {error?.message}</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Fan Spotlight">
      <div className="space-y-4">
        {/* Header actions */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {filtered.length} entr{filtered.length !== 1 ? "ies" : "y"} total
            </p>
          </div>
          <Button
            onClick={handleCreate}
            className="bg-[hsl(var(--tsg-blue))] font-semibold text-[hsl(var(--tsg-navy))] hover:bg-[hsl(var(--tsg-blue)/0.9)]"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Entry
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search by title, creator, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 rounded-md border border-border bg-background/60 pl-8 pr-2 py-1.5 text-sm"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-border bg-background/60 px-2 py-1 text-sm"
          >
            <option value="all">All Statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-md border border-border bg-background/60 px-2 py-1 text-sm"
          >
            <option value="all">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.icon} {meta.label}
              </option>
            ))}
          </select>
        </div>

        {/* Entries */}
        {filtered.length === 0 ? (
          <Card className="border-border">
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                No fan spotlight entries found.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((entry: SpotlightEntry) => (
              <Card
                key={entry.id}
                className={cn(
                  "border-border transition-colors",
                  entry.isFeatured && "ring-1 ring-[hsl(var(--tsg-blue)/0.4)]",
                  !entry.isApproved && "opacity-75",
                )}
                draggable
                onDragStart={() => handleDragStart(entry.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, entry.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Thumbnail */}
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/30">
                      {entry.thumbnailResolved ? (
                        <img
                          src={entry.thumbnailResolved}
                          alt={entry.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : entry.youtubeVideoId ? (
                        <img
                          src={`https://img.youtube.com/vi/${entry.youtubeVideoId}/hqdefault.jpg`}
                          alt={entry.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                        </div>
                      )}
                      {entry.category && (
                        <Badge
                          variant="secondary"
                          className="absolute bottom-1 left-1 border-none bg-[hsl(var(--tsg-navy)/0.8)] text-[hsl(var(--tsg-blue))] text-[10px] px-1 py-0"
                        >
                          {CATEGORY_LABELS[entry.category]?.icon}
                        </Badge>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-display font-bold text-lg">{entry.title}</h3>
                          {entry.subtitle && <p className="text-sm text-muted-foreground">{entry.subtitle}</p>}
                          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            {entry.fanName ? (
                              <span className="font-medium">
                                {entry.fanName}
                              </span>
                            ) : entry.creator ? (
                              <>
                                {entry.creator.avatar ? (
                                  <img
                                    src={entry.creator.avatar}
                                    alt={entry.creator.name ?? entry.creator.username ?? ""}
                                    className="h-5 w-5 rounded-full object-cover"
                                  />
                                ) : (
                                  <User className="h-3 w-3" />
                                )}
                                <span className="font-medium">
                                  {entry.creator.name ?? entry.creator.username ?? "Unknown"}
                                </span>
                              </>
                            ) : (
                              <span className="font-medium">Unknown creator</span>
                            )}
                            {entry.creator?.username && <span className="opacity-50">@{entry.creator.username}</span>}
                            <span className="opacity-50">•</span>
                            <span>{STATUS_OPTIONS.find((s) => s.value === entry.status)?.label || entry.status}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {entry.isFeatured && (
                            <Badge className="border-none bg-[hsl(var(--tsg-blue)/0.15)] text-[hsl(var(--tsg-blue))]">
                              <Star className="h-3 w-3 mr-1" />
                              Featured
                            </Badge>
                          )}
                          {!entry.isApproved && entry.status === "draft" && (
                            <Badge variant="secondary" className="border-none bg-[hsl(var(--tsg-navy)/0.5)] text-muted-foreground">
                              Draft
                            </Badge>
                          )}
                        </div>
                      </div>

                      {entry.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {entry.description}
                        </p>
                      )}

                      {entry.contentUrl && (
                        <a
                          href={entry.contentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 flex items-center gap-1 text-xs text-[hsl(var(--tsg-blue))] hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {entry.buttonText || "View on social media"}
                        </a>
                      )}

                      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Order: #{entry.displayOrder}</span>
                        <span>·</span>
                        <Calendar className="h-3 w-3" />
                        <time dateTime={entry.createdAt.toISOString()}>{formatDate(entry.createdAt)}</time>
                        {entry.publishDate && (
                          <>
                            <span>·</span>
                            <Calendar className="h-3 w-3" />
                            <span>Published {formatDate(entry.publishDate)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => handleEdit(entry)}
                        title="Edit"
                        className="rounded-md border border-border p-1 text-xs hover:bg-accent"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleFeature(entry.id, entry.isFeatured)}
                        title={entry.isFeatured ? "Unfeature" : "Feature"}
                        className={cn(
                          "rounded-md border border-border p-1 text-xs transition-colors",
                          entry.isFeatured
                            ? "bg-[hsl(var(--tsg-blue)/0.15)] text-[hsl(var(--tsg-blue))]"
                            : "hover:bg-accent hover:text-foreground",
                        )}
                      >
                        <Star className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handlePublish(entry.id, !entry.isApproved)}
                        title={entry.isApproved ? "Unpublish" : "Publish"}
                        className={cn(
                          "rounded-md border p-1 text-xs transition-colors",
                          entry.isApproved
                            ? "border-[hsl(var(--tsg-green)/0.4)] bg-[hsl(var(--tsg-green)/0.15)] text-[hsl(var(--tsg-green))]"
                            : "border-border hover:bg-accent",
                        )}
                      >
                        {entry.isApproved ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => handleDelete(entry.id, entry.title)}
                        title="Delete"
                        className="rounded-md border border-[hsl(var(--tsg-red)/0.4)] p-1 text-[hsl(var(--tsg-red))] hover:bg-[hsl(var(--tsg-red)/0.15)]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit/Create Form Modal */}
        {showForm && (
          <EditForm
            entry={formEntry}
            onClose={() => {
              setShowForm(false);
              setFormEntry(null);
            }}
            onSuccess={() => {
              setShowForm(false);
              setFormEntry(null);
            }}
          />
        )}
      </div>
    </AdminLayout>
  );
}
