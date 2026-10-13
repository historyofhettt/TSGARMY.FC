import { useState } from "react";
import { Save, Instagram, Youtube, MessageCircle, Globe } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { hasAtLeastRole } from "@contracts/constants";
import { useAuth } from "@/hooks/useAuth";
import type { Role } from "@contracts/constants";
import type { DeveloperInfo } from "@db/schema";

type SocialUrlInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
};

function SocialUrlInput({ label, value, onChange, placeholder }: SocialUrlInputProps) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type="url"
      />
    </div>
  );
}

export default function DeveloperInfoAdmin() {
  const { role } = useAuth();
  const utils = trpc.useUtils();

  const { data: info, isLoading, error } = trpc.admin.getDeveloperInfo.useQuery(undefined, {
    enabled: hasAtLeastRole(role as Role, "admin"),
  });

  const [editForm, setEditForm] = useState<Partial<DeveloperInfo>>({});

  const updateMutation = trpc.admin.updateDeveloperInfo.useMutation({
    onSuccess: () => {
      void utils.admin.getDeveloperInfo.invalidate();
      void utils.public.developerInfo.invalidate();
      toast.success("Developer info saved");
    },
    onError: (e: { message?: string }) => toast.error(e.message ?? "Error"),
  });

  const handleSave = () => {
    if (!editForm.developerName || editForm.developerName.trim() === "") {
      toast.error("Developer name is required");
      return;
    }
    updateMutation.mutate({
      developerName: editForm.developerName,
      developerPhotoKey: editForm.developerPhotoKey ?? null,
      bio: editForm.bio ?? null,
      instagramUrl: editForm.instagramUrl ?? null,
      youtubeUrl: editForm.youtubeUrl ?? null,
      discordUrl: editForm.discordUrl ?? null,
      portfolioUrl: editForm.portfolioUrl ?? null,
      showOnHomePage: editForm.showOnHomePage ?? false,
    });
  };

  if (!hasAtLeastRole(role as Role, "admin")) {
    return (
      <AdminLayout title="Developer Info" minRole="admin">
        <p>Access denied. You must have admin permissions.</p>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout title="Developer Info" minRole="admin">
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
          <p className="font-medium">Failed to load developer info</p>
          <p className="text-sm">{error.message}</p>
        </div>
      </AdminLayout>
    );
  }

  if (isLoading) {
    return (
      <AdminLayout title="Developer Info" minRole="admin">
        <p className="text-center text-muted-foreground py-10">Loading...</p>
      </AdminLayout>
    );
  }

  const displayInfo = info ? { ...info, ...editForm } : editForm as DeveloperInfo;

  return (
    <AdminLayout title="Developer Info" minRole="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Developer / Website Credits</h1>
            <p className="text-sm text-muted-foreground">
              Edit developer information displayed at the bottom of the Home page.
            </p>
          </div>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Personal Info</CardTitle>
            <CardDescription>Basic developer information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="developerName">Developer Name *</Label>
              <Input
                id="developerName"
                value={displayInfo.developerName ?? ""}
                onChange={(e) => setEditForm({ ...editForm, developerName: e.target.value })}
                placeholder="e.g. TSG Developer"
              />
            </div>
            <div>
              <Label htmlFor="developerPhotoKey">Photo/Media Key</Label>
              <Input
                id="developerPhotoKey"
                value={displayInfo.developerPhotoKey ?? ""}
                onChange={(e) => setEditForm({ ...editForm, developerPhotoKey: e.target.value || undefined })}
                placeholder="e.g. dev/photo.png"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Storage key for the developer photo. Use the Media Library to upload and get a key.
              </p>
            </div>
            <div>
              <Label htmlFor="bio">Bio / Description</Label>
              <Textarea
                id="bio"
                value={displayInfo.bio ?? ""}
                onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                rows={4}
                placeholder="Short bio or description..."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Social Links</CardTitle>
            <CardDescription>
              External profile links. Only configured links will be displayed on the Home page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SocialUrlInput
              label="Instagram URL"
              value={displayInfo.instagramUrl ?? ""}
              onChange={(v) => setEditForm({ ...editForm, instagramUrl: v || undefined })}
              placeholder="https://instagram.com/..."
            />
            <SocialUrlInput
              label="YouTube URL"
              value={displayInfo.youtubeUrl ?? ""}
              onChange={(v) => setEditForm({ ...editForm, youtubeUrl: v || undefined })}
              placeholder="https://youtube.com/..."
            />
            <SocialUrlInput
              label="Discord URL"
              value={displayInfo.discordUrl ?? ""}
              onChange={(v) => setEditForm({ ...editForm, discordUrl: v || undefined })}
              placeholder="https://discord.gg/..."
            />
            <SocialUrlInput
              label="Portfolio URL"
              value={displayInfo.portfolioUrl ?? ""}
              onChange={(v) => setEditForm({ ...editForm, portfolioUrl: v || undefined })}
              placeholder="https://..."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Visibility</CardTitle>
            <CardDescription>Control whether developer info appears on the Home page.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Switch
                id="showOnHomePage"
                checked={displayInfo.showOnHomePage ?? false}
                onCheckedChange={(checked) => setEditForm({ ...editForm, showOnHomePage: checked })}
              />
              <Label htmlFor="showOnHomePage">
                Show on Home page (uncheck to hide the developer credits section)
              </Label>
            </div>
          </CardContent>
        </Card>

        {displayInfo.developerName && (
          <Card>
            <CardHeader>
              <CardTitle>Live Preview</CardTitle>
              <CardDescription>How this will appear at the bottom of the Home page.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-[hsl(var(--tsg-navy))] rounded-lg p-6 border border-border">
                <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                  {displayInfo.developerPhotoKey && (
                    <div className="flex-shrink-0">
                      <div className="h-24 w-24 rounded-full bg-tsg-blue/20 flex items-center justify-center overflow-hidden">
                        <span className="text-xs text-muted-foreground">Photo loaded via key</span>
                      </div>
                    </div>
                  )}
                  <div className="text-center md:text-left">
                    <h3 className="font-display text-xl font-bold text-white">
                      {displayInfo.developerName}
                    </h3>
                    {displayInfo.bio && (
                      <p className="mt-2 text-sm text-muted-foreground max-w-md line-clamp-3">
                        {displayInfo.bio}
                      </p>
                    )}
                    {displayInfo.showOnHomePage && (
                      <div className="mt-3 flex justify-center md:justify-start gap-3">
                        {displayInfo.instagramUrl && (
                          <a
                            href={displayInfo.instagramUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-tsg-red hover:text-tsg-red/80"
                            aria-label="Instagram"
                          >
                            <Instagram className="h-5 w-5" />
                          </a>
                        )}
                        {displayInfo.youtubeUrl && (
                          <a
                            href={displayInfo.youtubeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-tsg-red hover:text-tsg-red/80"
                            aria-label="YouTube"
                          >
                            <Youtube className="h-5 w-5" />
                          </a>
                        )}
                        {displayInfo.discordUrl && (
                          <a
                            href={displayInfo.discordUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-tsg-red hover:text-tsg-red/80"
                            aria-label="Discord"
                          >
                            <MessageCircle className="h-5 w-5" />
                          </a>
                        )}
                        {displayInfo.portfolioUrl && (
                          <a
                            href={displayInfo.portfolioUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-tsg-red hover:text-tsg-red/80"
                            aria-label="Portfolio"
                          >
                            <Globe className="h-5 w-5" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
