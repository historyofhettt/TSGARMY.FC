import { useState, useMemo } from "react";
import { Plus, Edit2, BarChart3, Trash2, Monitor, Smartphone, ExternalLink, Eye, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { hasAtLeastRole } from "@contracts/constants";
import { useAuth } from "@/hooks/useAuth";
import type { Role } from "@contracts/constants";
import type { AdCampaign, AdCreative } from "@db/schema";

type EditableCampaign = AdCampaign | { id: "new" } | null;
type EditableCreative = AdCreative | null;

type CampaignFormProps = {
  initialData: unknown;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
};

type CreativeFormProps = {
  campaignId: number;
  initialData: unknown;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
};

const PLACEMENT_OPTIONS = [
  { value: "sidebar", label: "Sidebar" },
  { value: "header", label: "Header" },
  { value: "between_media_items", label: "Between Media Items" },
  { value: "feed_top", label: "Feed Top" },
  { value: "feed_bottom", label: "Feed Bottom" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_BADGE: Record<string, "default" | "secondary" | "outline"> = {
  draft: "secondary",
  scheduled: "outline",
  active: "default",
  paused: "outline",
  completed: "secondary",
  cancelled: "secondary",
};

const LAYOUT_OPTIONS = [
  { value: "banner", label: "Banner" },
  { value: "card", label: "Card" },
  { value: "image_only", label: "Image Only" },
  { value: "video", label: "Video" },
  { value: "native", label: "Native" },
];

const ALIGNMENT_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

const TEXT_POSITION_OPTIONS = [
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "overlay", label: "Overlay" },
  { value: "outside", label: "Outside" },
];

const CTA_STYLE_OPTIONS = [
  { value: "filled", label: "Filled" },
  { value: "outline", label: "Outline" },
  { value: "text", label: "Text" },
];

const PAGE_OPTIONS = [
  { value: "home", label: "Home" },
  { value: "media", label: "Media" },
  { value: "media-album", label: "Media Album" },
  { value: "highlights", label: "Highlights" },
  { value: "fan-spotlight", label: "Fan Spotlight" },
  { value: "teams", label: "Teams" },
  { value: "team-detail", label: "Team Detail" },
  { value: "players", label: "Players" },
  { value: "player-detail", label: "Player Detail" },
  { value: "tournaments", label: "Tournaments" },
  { value: "tournament-detail", label: "Tournament Detail" },
  { value: "leaderboard", label: "Leaderboard" },
  { value: "community", label: "Community" },
  { value: "live", label: "Live" },
];

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_BADGE[status] ?? "default"}>
      {STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status}
    </Badge>
  );
}

type LivePreviewCreative = {
  title: string;
  bodyText: string;
  mediaKey: string;
  logoKey: string;
  previewImageKey: string;
  advertiser: string;
  destinationUrl: string;
  layout: string;
  alignment: string;
  ctaStyle: string;
  buttonText: string;
  linkLabel: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  showBorder: boolean;
  showShadow: boolean;
};

function LivePreview({ creative }: { creative: LivePreviewCreative }) {
  const previewUrl = (creative.mediaKey as string) || "https://via.placeholder.com/400x250?text=Ad+Media";
  const layout = creative.layout ?? "card";
  const alignment = creative.alignment ?? "center";
  const ctaStyle = creative.ctaStyle ?? "filled";
  const buttonText = creative.buttonText || "Learn More";
  const destinationUrl = creative.destinationUrl;

  const alignmentClass =
    alignment === "left" ? "text-left" : alignment === "right" ? "text-right" : "text-center";

  const ctaClasses = {
    filled: "bg-tsg-blue text-white hover:bg-tsg-blue/90",
    outline: "border border-tsg-blue text-tsg-blue hover:bg-tsg-blue/10",
    text: "text-tsg-blue underline hover:no-underline",
  } as const;

  const showBorder = creative.showBorder;
  const showShadow = creative.showShadow;

  const borderStyle = creative.borderColor
    ? { borderColor: creative.borderColor, borderWidth: showBorder ? 2 : 0 }
    : {};
  const bgStyle = creative.backgroundColor ? { backgroundColor: creative.backgroundColor } : {};
  const textStyle = creative.textColor ? { color: creative.textColor } : {};

  const cardClasses = cn(
    "relative rounded-lg border bg-card p-4 transition-all",
    showBorder && "border-2",
    showShadow && "shadow-md",
    alignmentClass,
  );

  return (
    <div className="border rounded-lg p-3 bg-muted/20">
      <div className="text-xs text-muted-foreground mb-2">Live Preview</div>
      <div className={cardClasses} style={{ ...borderStyle, ...bgStyle, ...textStyle }}>
        <Badge variant="outline" className="text-xs absolute top-2 right-2">
          Sponsored
        </Badge>
        {creative.logoKey && (
          <div className="mb-2 flex items-center gap-2">
            <img
              src={"https://via.placeholder.com/24?text=" + creative.advertiser}
              alt={creative.advertiser}
              className="h-5 w-5 rounded object-cover"
            />
            <span className="text-xs font-medium">{creative.advertiser || "Advertiser"}</span>
          </div>
        )}
        <h4 className="font-medium">{creative.title || "Ad Title"}</h4>
        {creative.bodyText && (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {creative.bodyText}
          </p>
        )}
        {layout !== "image_only" && (
          <img
            src={previewUrl}
            alt={creative.title}
            className={cn(
              "my-3 w-full rounded object-cover",
              layout === "banner" ? "max-h-32" : "max-h-48",
            )}
          />
        )}
        {destinationUrl && (
          <Button
            size="sm"
            className={ctaClasses[ctaStyle as keyof typeof ctaClasses]}
            disabled
          >
            {buttonText}
          </Button>
        )}
        {creative.linkLabel && (
          <button
            type="button"
            className="ml-2 text-sm font-medium text-tsg-blue underline"
            disabled
          >
            {creative.linkLabel}
          </button>
        )}
      </div>
    </div>
  );
}

type PreviewDeliveryDialogProps = {
  campaign: AdCampaign;
  open: boolean;
  onClose: () => void;
  page: string;
  onPageChange: (page: string) => void;
  isMobile: boolean;
  onIsMobileChange: (isMobile: boolean) => void;
};

function PreviewDeliveryDialog({
  campaign,
  open,
  onClose,
  page,
  onPageChange,
  isMobile,
  onIsMobileChange,
}: PreviewDeliveryDialogProps) {
  const { data: preview, isLoading, error } = trpc.admin.previewAdDelivery.useQuery(
    {
      campaignId: campaign.id,
      page,
      placement: campaign.placement,
      isMobile,
    },
    { enabled: open },
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            Ad Delivery Preview — {campaign.name}
          </DialogTitle>
          <DialogDescription>
            Simulates how this ad will be delivered publicly. Eligibility is re-checked in real time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Test Page</Label>
              <Input
                value={page}
                onChange={(e) => onPageChange(e.target.value)}
                placeholder="e.g. home, teams, players"
              />
              <p className="text-xs text-muted-foreground mt-1">
                The page slug where the ad would appear (e.g. "home", "teams", "players").
              </p>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={isMobile}
                  onCheckedChange={onIsMobileChange}
                  id="preview-mobile"
                />
                <Label htmlFor="preview-mobile">Mobile view</Label>
              </div>
            </div>
          </div>

          {isLoading && (
            <p className="text-sm text-muted-foreground">Checking ad delivery eligibility...</p>
          )}

          {error && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              {error.message}
            </div>
          )}

          {preview && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Delivery Result —{" "}
                  <span className={preview.eligible ? "text-green-600" : "text-red-600"}>
                    {preview.eligible ? "Eligible to display" : "Not eligible"}
                  </span>
                </CardTitle>
                {!preview.eligible && (
                  <CardDescription>
                    The following issues prevent this ad from displaying:
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {!preview.eligible && preview.reasons.length > 0 && (
                  <ul className="space-y-1 text-sm">
                    {preview.reasons.map((reason: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {preview.eligible && (
                  <p className="text-sm text-muted-foreground">
                    This ad will be delivered publicly on the "{page}" page in the
                    "{campaign.placement}" placement.
                  </p>
                )}

                {preview.creatives && preview.creatives.length > 0 && (
                  <div className="mt-4 border-t pt-4">
                    <Label className="mb-2 block">Creative Preview</Label>
                     {preview.creatives.map((cr: { id: number; title: string; mediaKey: string | null; mediaUrl: string | null; mediaType: string; destinationUrl: string; layout: string; logoUrl: string | null; previewImageUrl: string | null }) => (
                      <Card key={cr.id} className="mt-2">
                        <CardContent className="pt-4">
                          <div className="flex items-start gap-3">
                            {cr.mediaUrl && (
                              <div className="flex-shrink-0">
                                {cr.mediaType === "video" ? (
                                  <video
                                    src={cr.mediaUrl}
                                    controls
                                    className="h-16 w-24 rounded object-cover"
                                  />
                                ) : (
                                  <img
                                    src={cr.mediaUrl}
                                    alt={cr.title}
                                    className="h-16 w-24 rounded object-cover"
                                  />
                                )}
                              </div>
                            )}
                            <div>
                              <p className="font-medium">{cr.title}</p>
                              <p className="text-sm text-muted-foreground">
                                Destination: {cr.destinationUrl}
                              </p>
                              <Badge variant="outline" className="mt-1 text-xs">
                                {cr.layout}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SponsoredAds() {
  const { role } = useAuth();
  const utils = trpc.useUtils();
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<EditableCampaign>(null);
  const [creativeDialogOpen, setCreativeDialogOpen] = useState(false);
  const [editingCreative, setEditingCreative] = useState<EditableCreative>(null);
  const [currentCampaignForCreatives, setCurrentCampaignForCreatives] = useState<AdCampaign | null>(null);
  const [previewCampaign, setPreviewCampaign] = useState<AdCampaign | null>(null);
  const [previewPage, setPreviewPage] = useState<string>("home");
  const [previewIsMobile, setPreviewIsMobile] = useState<boolean>(false);

  const [placementFilter, setPlacementFilter] = useState<
    "sidebar" | "header" | "between_media_items" | "feed_top" | "feed_bottom" | null
  >(null);

  const { data: campaigns = [], isLoading: listLoading, error: listError } = trpc.admin.listAdCampaigns.useQuery(
    undefined,
    { enabled: hasAtLeastRole(role as Role, "moderator") },
  );

  const { data: campaignDetail } = trpc.admin.getAdCampaign.useQuery(
    { id: editingCampaign && editingCampaign.id !== "new" ? editingCampaign.id : 0 },
    { enabled: !!editingCampaign && editingCampaign.id !== "new" },
  );

  const shouldFetchPlacement = hasAtLeastRole(role as Role, "moderator") && !!placementFilter;
  const { data: placementPerf } = trpc.admin.getAdPlacementPerformance.useQuery(
    { placement: placementFilter! },
    { enabled: shouldFetchPlacement },
  );

  const createCampaign = trpc.admin.createAdCampaign.useMutation({
    onSuccess: () => {
      void utils.admin.listAdCampaigns.invalidate();
      toast.success("Campaign created");
      setCampaignDialogOpen(false);
      setEditingCampaign(null);
    },
    onError: (e: { message?: string }) => toast.error(e.message ?? "Error"),
  });

  const updateCampaign = trpc.admin.updateAdCampaign.useMutation({
    onSuccess: () => {
      void utils.admin.listAdCampaigns.invalidate();
      toast.success("Campaign updated");
      setCampaignDialogOpen(false);
      setEditingCampaign(null);
    },
    onError: (e: { message?: string }) => toast.error(e.message ?? "Error"),
  });

  const createCreative = trpc.admin.createAdCreative.useMutation({
    onSuccess: () => {
      void utils.admin.getAdCampaign.invalidate();
      toast.success("Creative created");
      setCreativeDialogOpen(false);
      setEditingCreative(null);
    },
    onError: (e: { message?: string }) => toast.error(e.message ?? "Error"),
  });

  const updateCreative = trpc.admin.updateAdCreative.useMutation({
    onSuccess: () => {
      void utils.admin.getAdCampaign.invalidate();
      toast.success("Creative updated");
      setCreativeDialogOpen(false);
      setEditingCreative(null);
    },
    onError: (e: { message?: string }) => toast.error(e.message ?? "Error"),
  });

  const deleteCampaignMut = trpc.admin.deleteAdCampaign.useMutation({
    onSuccess: () => {
      void utils.admin.listAdCampaigns.invalidate();
      toast.success("Campaign deleted");
    },
    onError: (e: { message?: string }) => toast.error(e.message ?? "Error"),
  });

  const deleteCreativeMut = trpc.admin.deleteAdCreative.useMutation({
    onSuccess: () => {
      void utils.admin.getAdCampaign.invalidate();
      toast.success("Creative deleted");
    },
    onError: (e: { message?: string }) => toast.error(e.message ?? "Error"),
  });

  const mutateCampaignDelete = (id: number) => {
    deleteCampaignMut.mutate({ id });
  };

  const mutateCreativeDelete = (id: number) => {
    deleteCreativeMut.mutate({ id });
  };

  const handleSaveCampaign = (data: Record<string, unknown>) => {
    const id = data.id;
    if (!id || id === "new") {
      createCampaign.mutate(data as never);
    } else {
      updateCampaign.mutate({ id: id as number, ...data } as never);
    }
  };

  const handleSaveCreative = (data: Record<string, unknown>) => {
    if (!editingCreative?.id) {
      createCreative.mutate(data as never);
    } else {
      updateCreative.mutate({ id: editingCreative.id, ...data } as never);
    }
  };

  function CampaignForm({ initialData, onSubmit, onCancel }: CampaignFormProps) {
    const initial = initialData as AdCampaign | null | undefined;
    const [formData, setFormData] = useState({
      name: initial?.name ?? "",
      advertiser: initial?.advertiser ?? "",
      description: initial?.description ?? "",
      status: initial?.status ?? ("draft" as const),
      placement: initial?.placement ?? ("sidebar" as const),
      targetPages: [] as string[],
      budget: initial?.budget ?? 0,
      priority: initial?.priority ?? 0,
      impressionLimit: initial?.impressionLimit ?? null as number | null,
      startDate: initial?.startDate ? new Date(initial.startDate).toISOString().slice(0, 16) : "",
      endDate: initial?.endDate ? new Date(initial.endDate).toISOString().slice(0, 16) : "",
      frequencyCap: initial?.frequencyCap ?? 3,
      isActive: initial?.isActive ?? true,
    });

    const [targetPagesText, setTargetPagesText] = useState(
      initial?.targetPages
        ? (() => {
            try {
              const parsed = JSON.parse(initial.targetPages);
              return Array.isArray(parsed) ? parsed.join(", ") : initial.targetPages;
            } catch {
              return initial.targetPages;
            }
          })()
        : "",
    );

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const targetPages = targetPagesText
        ? targetPagesText.split(",").map((s) => s.trim()).filter(Boolean)
        : formData.targetPages;
      onSubmit({
        ...formData,
        startDate: formData.startDate ? new Date(formData.startDate) : null,
        endDate: formData.endDate ? new Date(formData.endDate) : null,
        targetPages: targetPages.length > 0 ? targetPages : undefined,
        priority: formData.priority,
        impressionLimit: formData.impressionLimit,
      });
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Campaign Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="advertiser">Advertiser</Label>
            <Input
              id="advertiser"
              value={formData.advertiser}
              onChange={(e) => setFormData({ ...formData, advertiser: e.target.value })}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="status">Status *</Label>
            <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as AdCampaign["status"] })}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="placement">Placement *</Label>
            <Select value={formData.placement} onValueChange={(v) => setFormData({ ...formData, placement: v as AdCampaign["placement"] })}>
              <SelectTrigger id="placement">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLACEMENT_OPTIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="budget">Budget</Label>
            <Input
              id="budget"
              type="number"
              min={0}
              value={formData.budget}
              onChange={(e) => setFormData({ ...formData, budget: parseInt(e.target.value) || 0 })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="datetime-local"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="datetime-local"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="frequencyCap">Frequency Cap (impressions/user) *</Label>
            <Input
              id="frequencyCap"
              type="number"
              min={1}
              max={100}
              value={formData.frequencyCap}
              onChange={(e) => setFormData({ ...formData, frequencyCap: parseInt(e.target.value) || 3 })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="priority">Priority</Label>
            <Input
              id="priority"
              type="number"
              min={0}
              max={1000}
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
            />
            <p className="text-xs text-muted-foreground mt-1">Higher priority campaigns display first. Range 0-1000.</p>
          </div>
          <div>
            <Label htmlFor="impressionLimit">Impression Limit</Label>
            <Input
              id="impressionLimit"
              type="number"
              min={0}
              value={formData.impressionLimit ?? ""}
              onChange={(e) => setFormData({ ...formData, impressionLimit: parseInt(e.target.value) || null })}
              placeholder="Unlimited"
            />
            <p className="text-xs text-muted-foreground mt-1">Max total impressions. Leave blank for unlimited.</p>
          </div>
          <div className="flex items-end">
            <div className="flex items-center gap-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="isActive">Active</Label>
            </div>
          </div>
        </div>

        <div>
          <Label htmlFor="targetPages">Target Pages - leave empty for all pages</Label>
          <Input
            id="targetPages"
            value={targetPagesText}
            onChange={(e) => setTargetPagesText(e.target.value)}
            placeholder="e.g. media, fan-spotlight, home"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Shows available pages: {PAGE_OPTIONS.map((p) => p.label).join(", ")}
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">
            {initial?.id ? "Update" : "Create"} Campaign
          </Button>
        </DialogFooter>
      </form>
    );
  }

  function CreativeForm({ campaignId, initialData, onSubmit, onCancel }: CreativeFormProps) {
    const initial = initialData as AdCreative | null | undefined;

    const [formData, setFormData] = useState({
      title: initial?.title ?? "",
      mediaKey: initial?.mediaKey ?? "",
      mediaType: initial?.mediaType ?? "image",
      destinationUrl: initial?.destinationUrl ?? "",
      advertiser: initial?.advertiser ?? "",
      logoKey: initial?.logoKey ?? "",
      buttonText: initial?.buttonText ?? "",
      linkLabel: initial?.linkLabel ?? "",
      bodyText: initial?.bodyText ?? "",
      isAdminOnly: initial?.isAdminOnly ?? false,
      layout: initial?.layout ?? "card",
      targetPages: initial?.targetPages ?? "",
      desktopVisible: initial?.desktopVisible ?? true,
      mobileVisible: initial?.mobileVisible ?? true,
      width: initial?.width ?? "",
      height: initial?.height ?? "",
      aspectRatio: initial?.aspectRatio ?? "",
      alignment: initial?.alignment ?? "center",
      backgroundColor: initial?.backgroundColor ?? "",
      borderColor: initial?.borderColor ?? "",
      textColor: initial?.textColor ?? "",
      showBorder: initial?.showBorder ?? false,
      showShadow: initial?.showShadow ?? false,
      textPosition: initial?.textPosition ?? "bottom",
      ctaStyle: initial?.ctaStyle ?? "filled",
      previewImageKey: initial?.previewImageKey ?? "",
      secondaryLinkUrl: initial?.secondaryLinkUrl ?? "",
      secondaryLinkLabel: initial?.secondaryLinkLabel ?? "",
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const tpInput = formData.targetPages?.trim();
      let targetPages: string[] | undefined;
      if (tpInput) {
        try {
          targetPages = JSON.parse(tpInput);
        } catch {
          targetPages = tpInput.split(",").map((s) => s.trim()).filter(Boolean);
        }
      }
      onSubmit({
        ...formData,
        campaignId,
        mediaType: formData.mediaType,
        isAdminOnly: formData.isAdminOnly,
        layout: formData.layout,
        desktopVisible: formData.desktopVisible,
        mobileVisible: formData.mobileVisible,
        showBorder: formData.showBorder,
        showShadow: formData.showShadow,
        alignment: formData.alignment,
        textPosition: formData.textPosition,
        ctaStyle: formData.ctaStyle,
        targetPages: targetPages,
      });
    };

    const previewCreative: LivePreviewCreative = useMemo(() => {
      return {
        title: formData.title,
        bodyText: formData.bodyText,
        mediaKey: formData.mediaKey,
        logoKey: formData.logoKey,
        previewImageKey: formData.previewImageKey,
        advertiser: formData.advertiser,
        destinationUrl: formData.destinationUrl,
        layout: formData.layout,
        alignment: formData.alignment,
        ctaStyle: formData.ctaStyle,
        buttonText: formData.buttonText,
        linkLabel: formData.linkLabel,
        backgroundColor: formData.backgroundColor,
        borderColor: formData.borderColor,
        textColor: formData.textColor,
        showBorder: formData.showBorder,
        showShadow: formData.showShadow,
      };
    }, [formData]);

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="creativeTitle">Title *</Label>
          <Input
            id="creativeTitle"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="mediaType">Media Type</Label>
            <Select value={formData.mediaType} onValueChange={(v: "image" | "video") => setFormData({ ...formData, mediaType: v })}>
              <SelectTrigger id="mediaType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="video">Video</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="destinationUrl">Destination URL *</Label>
            <Input
              id="destinationUrl"
              type="url"
              value={formData.destinationUrl}
              onChange={(e) => setFormData({ ...formData, destinationUrl: e.target.value })}
              placeholder="https://..."
              required
            />
          </div>
        </div>

        <div>
          <Label htmlFor="mediaKey">Media Key (storage key)</Label>
          <Input
            id="mediaKey"
            value={formData.mediaKey}
            onChange={(e) => setFormData({ ...formData, mediaKey: e.target.value })}
            placeholder="e.g. ads/creative-1.png"
          />
        </div>

        <div>
          <Label htmlFor="previewImageKey">Preview Image Key</Label>
          <Input
            id="previewImageKey"
            value={formData.previewImageKey}
            onChange={(e) => setFormData({ ...formData, previewImageKey: e.target.value })}
            placeholder="e.g. ads/preview-1.png"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="advertiser">Advertiser Name</Label>
            <Input
              id="advertiser"
              value={formData.advertiser}
              onChange={(e) => setFormData({ ...formData, advertiser: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="logoKey">Advertiser Logo Key</Label>
            <Input
              id="logoKey"
              value={formData.logoKey}
              onChange={(e) => setFormData({ ...formData, logoKey: e.target.value })}
              placeholder="e.g. ads/logo-1.png"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="bodyText">Body Text</Label>
          <Textarea
            id="bodyText"
            value={formData.bodyText}
            onChange={(e) => setFormData({ ...formData, bodyText: e.target.value })}
            rows={3}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="buttonText">Button Text</Label>
            <Input
              id="buttonText"
              value={formData.buttonText}
              onChange={(e) => setFormData({ ...formData, buttonText: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="linkLabel">Link Label</Label>
            <Input
              id="linkLabel"
              value={formData.linkLabel}
              onChange={(e) => setFormData({ ...formData, linkLabel: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="secondaryLinkUrl">Secondary Link URL</Label>
            <Input
              id="secondaryLinkUrl"
              type="url"
              value={formData.secondaryLinkUrl}
              onChange={(e) => setFormData({ ...formData, secondaryLinkUrl: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div>
            <Label htmlFor="secondaryLinkLabel">Secondary Link Label</Label>
            <Input
              id="secondaryLinkLabel"
              value={formData.secondaryLinkLabel}
              onChange={(e) => setFormData({ ...formData, secondaryLinkLabel: e.target.value })}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="layout">Layout *</Label>
          <Select value={formData.layout} onValueChange={(v) => setFormData({ ...formData, layout: v as AdCreative["layout"] })}>
            <SelectTrigger id="layout">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LAYOUT_OPTIONS.map((l) => (
                <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="targetPages">Target Pages (JSON string)</Label>
            <Input
              id="targetPages"
              value={formData.targetPages}
              onChange={(e) => setFormData({ ...formData, targetPages: e.target.value })}
              placeholder='e.g. ["home","media"]'
            />
          </div>
          <div>
            <Label htmlFor="alignment">Alignment *</Label>
            <Select value={formData.alignment} onValueChange={(v) => setFormData({ ...formData, alignment: v as AdCreative["alignment"] })}>
              <SelectTrigger id="alignment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALIGNMENT_OPTIONS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="width">Width</Label>
            <Input
              id="width"
              value={formData.width}
              onChange={(e) => setFormData({ ...formData, width: e.target.value })}
              placeholder="e.g. 300px or 100%"
            />
          </div>
          <div>
            <Label htmlFor="height">Height</Label>
            <Input
              id="height"
              value={formData.height}
              onChange={(e) => setFormData({ ...formData, height: e.target.value })}
              placeholder="e.g. 250px or auto"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="aspectRatio">Aspect Ratio</Label>
          <Input
            id="aspectRatio"
            value={formData.aspectRatio}
            onChange={(e) => setFormData({ ...formData, aspectRatio: e.target.value })}
            placeholder="e.g. 16/9, 4/3, 1/1"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="backgroundColor">Background Color</Label>
            <Input
              id="backgroundColor"
              value={formData.backgroundColor}
              onChange={(e) => setFormData({ ...formData, backgroundColor: e.target.value })}
              placeholder="#ffffff or blue"
            />
          </div>
          <div>
            <Label htmlFor="borderColor">Border Color</Label>
            <Input
              id="borderColor"
              value={formData.borderColor}
              onChange={(e) => setFormData({ ...formData, borderColor: e.target.value })}
              placeholder="#000000 or gray"
            />
          </div>
          <div>
            <Label htmlFor="textColor">Text Color</Label>
            <Input
              id="textColor"
              value={formData.textColor}
              onChange={(e) => setFormData({ ...formData, textColor: e.target.value })}
              placeholder="#000000 or inherit"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="textPosition">Text Position *</Label>
          <Select value={formData.textPosition} onValueChange={(v) => setFormData({ ...formData, textPosition: v as AdCreative["textPosition"] })}>
            <SelectTrigger id="textPosition">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEXT_POSITION_OPTIONS.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="ctaStyle">CTA Style *</Label>
          <Select value={formData.ctaStyle} onValueChange={(v) => setFormData({ ...formData, ctaStyle: v as AdCreative["ctaStyle"] })}>
            <SelectTrigger id="ctaStyle">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CTA_STYLE_OPTIONS.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="desktopVisible"
              checked={formData.desktopVisible}
              onCheckedChange={(checked) => setFormData({ ...formData, desktopVisible: checked })}
            />
            <Label htmlFor="desktopVisible" className="flex items-center gap-1">
              <Monitor className="h-4 w-4" />
              Desktop Visible
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="mobileVisible"
              checked={formData.mobileVisible}
              onCheckedChange={(checked) => setFormData({ ...formData, mobileVisible: checked })}
            />
            <Label htmlFor="mobileVisible" className="flex items-center gap-1">
              <Smartphone className="h-4 w-4" />
              Mobile Visible
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="showBorder"
              checked={formData.showBorder}
              onCheckedChange={(checked) => setFormData({ ...formData, showBorder: checked })}
            />
            <Label htmlFor="showBorder">Show Border</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="showShadow"
              checked={formData.showShadow}
              onCheckedChange={(checked) => setFormData({ ...formData, showShadow: checked })}
            />
            <Label htmlFor="showShadow">Show Shadow</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="isAdminOnly"
              checked={formData.isAdminOnly}
              onCheckedChange={(checked) => setFormData({ ...formData, isAdminOnly: checked })}
            />
            <Label htmlFor="isAdminOnly">Admin-only (not shown to public)</Label>
          </div>
        </div>

        <div className="border rounded-lg p-3 bg-muted/20">
          <Label className="mb-2 block text-xs font-medium text-muted-foreground">Live Preview</Label>
          <LivePreview creative={previewCreative} />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">
            {initial?.id ? "Update" : "Create"} Creative
          </Button>
        </DialogFooter>
      </form>
    );
  }

  if (!hasAtLeastRole(role as Role, "moderator")) {
    return (
      <AdminLayout title="Sponsored Ads" minRole="moderator">
        <p>Access denied. You must have moderator permissions.</p>
      </AdminLayout>
    );
  }

  const campaignDetailView = campaignDetail || null;

  if (listError) {
    return (
      <AdminLayout title="Sponsored Ads" minRole="moderator">
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
          <p className="font-medium">Failed to load campaigns</p>
          <p className="text-sm">{listError.message}</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Sponsored Ads" minRole="moderator">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sponsored Ads</h1>
            <p className="text-sm text-muted-foreground">Manage ad campaigns, creatives, and analytics</p>
          </div>
          <Button onClick={() => {
            setEditingCampaign({ id: "new" });
            setCampaignDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </Button>
        </div>

        {listLoading && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">Loading campaigns...</p>
            </CardContent>
          </Card>
        )}

        {!listLoading && campaigns.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">No campaigns yet. Create one to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {!listLoading && campaigns.map((campaign) => (
            <Card key={campaign.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{campaign.name}</CardTitle>
                    <StatusBadge status={campaign.status} />
                  </div>
                  <CardDescription>
                    {campaign.advertiser && <span className="font-medium">Advertiser:</span>} {campaign.advertiser || "N/A"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
                    <span>Placement: {PLACEMENT_OPTIONS.find((p) => p.value === campaign.placement)?.label ?? campaign.placement}</span>
                    <span>Budget: ${campaign.budget}</span>
                    <span>Priority: {campaign.priority ?? 0}</span>
                    {campaign.impressionLimit !== null && campaign.impressionLimit !== undefined && (
                      <span>Impression Limit: {campaign.impressionLimit}</span>
                    )}
                    <span>Impressions: {campaign.impressions}</span>
                    <span>Clicks: {campaign.clicks}</span>
                    <span>Dismissals: {campaign.dismissals}</span>
                    <span>Freq Cap: {campaign.frequencyCap}/hr</span>
                    <span className={campaign.isActive ? "text-green-600" : "text-red-600"}>
                      {campaign.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => {
                      setCurrentCampaignForCreatives(campaign);
                      setEditingCampaign(campaign);
                    }}>
                      <BarChart3 className="h-4 w-4 mr-1" />
                      Analytics
                    </Button>
                   <Button size="sm" variant="outline" onClick={() => {
                       setEditingCampaign(campaign);
                       setCampaignDialogOpen(true);
                     }}>
                       <Edit2 className="h-4 w-4 mr-1" />
                       Edit
                     </Button>
                     <Button
                       size="sm"
                       variant="outline"
                       onClick={() => setPreviewCampaign(campaign)}
                     >
                       <Eye className="h-4 w-4 mr-1" />
                       Preview
                     </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Campaign?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will also delete all creatives and metrics for this campaign. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => mutateCampaignDelete(campaign.id)}
                            className="bg-destructive"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {campaignDetailView && (
          <Card>
            <CardHeader>
              <CardTitle>Creatives for "{campaignDetailView.name}"</CardTitle>
              <CardDescription>
                Manage creatives within this campaign. Each creative can have its own media, layout, and design controls.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {campaignDetailView.creatives.length === 0 ? (
                <p className="text-sm text-muted-foreground">No creatives yet. Add one to get started.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {campaignDetailView.creatives.map((creative) => (
                    <div key={creative.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{creative.title}</span>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingCreative(creative);
                              setCreativeDialogOpen(true);
                            }}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="destructive">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Creative?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will delete the creative "{creative.title}". This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => mutateCreativeDelete(creative.id)}
                                  className="bg-destructive"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>Layout: {creative.layout}</span>
                        <span>CTA: {creative.ctaStyle}</span>
                        <span>Desktop: {creative.desktopVisible ? "Yes" : "No"}</span>
                        <span>Mobile: {creative.mobileVisible ? "Yes" : "No"}</span>
                        {creative.destinationUrl && (
                          <span
                            className="text-tsg-blue underline cursor-pointer"
                            onClick={() => window.open(creative.destinationUrl, "_blank")}
                          >
                            <ExternalLink className="h-3 w-3 inline mr-1" />
                            Preview URL
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button
                size="sm"
                className="mt-4"
                onClick={() => {
                  setEditingCreative(null);
                  setCreativeDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                New Creative
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Placement Performance</CardTitle>
              <div className="flex gap-2">
                <Select value={placementFilter ?? "all"} onValueChange={(v) => setPlacementFilter(v === "all" ? null : (v as NonNullable<typeof placementFilter>))}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by placement" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Placements</SelectItem>
                    {PLACEMENT_OPTIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {placementPerf ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold">{placementPerf.campaigns.length}</div>
                    <div className="text-xs text-muted-foreground">Campaigns</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">
                      {placementPerf.placements.reduce((s, p) => s + p.impressions, 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">Impressions</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">
                      {placementPerf.placements.reduce((s, p) => s + p.clicks, 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">Clicks</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">
                      {placementPerf.placements.reduce((s, p) => s + p.dismissals, 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">Dismissals</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">
                      {(() => {
                        const imp = placementPerf.placements.reduce((s, p) => s + p.impressions, 0);
                        const clk = placementPerf.placements.reduce((s, p) => s + p.clicks, 0);
                        return imp > 0 ? `${((clk / imp) * 100).toFixed(1)}%` : "0%";
                      })()}
                    </div>
                    <div className="text-xs text-muted-foreground">CTR</div>
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-2">Placement</th>
                        <th className="text-right p-2">Campaigns</th>
                        <th className="text-right p-2">Impressions</th>
                        <th className="text-right p-2">Clicks</th>
                        <th className="text-right p-2">Dismissals</th>
                        <th className="text-right p-2">CTR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {placementPerf.placements.map((p) => (
                        <tr key={p.placement} className="border-t">
                          <td className="p-2">{PLACEMENT_OPTIONS.find((x) => x.value === p.placement)?.label ?? p.placement}</td>
                          <td className="text-right p-2">{p.campaigns}</td>
                          <td className="text-right p-2">{p.impressions}</td>
                          <td className="text-right p-2">{p.clicks}</td>
                          <td className="text-right p-2">{p.dismissals}</td>
                          <td className="text-right p-2">{p.ctr.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Loading placement performance...</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* -------------------------------------------------- Preview Dialog */}
      {previewCampaign && (
        <PreviewDeliveryDialog
          campaign={previewCampaign}
          open={!!previewCampaign}
          onClose={() => setPreviewCampaign(null)}
          page={previewPage}
          onPageChange={setPreviewPage}
          isMobile={previewIsMobile}
          onIsMobileChange={setPreviewIsMobile}
        />
      )}

      <Dialog open={campaignDialogOpen || !!editingCampaign} onOpenChange={(open) => {
        if (!open) {
          setCampaignDialogOpen(false);
          setEditingCampaign(null);
        }
      }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingCampaign?.id && editingCampaign.id !== "new" ? "Edit Campaign" : "New Campaign"}</DialogTitle>
          </DialogHeader>
          {editingCampaign && (
            <CampaignForm
              initialData={editingCampaign.id === "new" ? null : campaignDetail}
              onSubmit={(data) => handleSaveCampaign(data)}
              onCancel={() => {
                setCampaignDialogOpen(false);
                setEditingCampaign(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={creativeDialogOpen} onOpenChange={setCreativeDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingCreative?.id ? "Edit Creative" : "New Creative"}</DialogTitle>
          </DialogHeader>
          {currentCampaignForCreatives && (
            <CreativeForm
              campaignId={currentCampaignForCreatives.id}
              initialData={editingCreative?.id ? editingCreative : null}
              onSubmit={(data) => handleSaveCreative(data)}
              onCancel={() => {
                setCreativeDialogOpen(false);
                setEditingCreative(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
