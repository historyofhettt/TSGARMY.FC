import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function SettingsAdmin() {
  const utils = trpc.useUtils();
  const { data: org, isLoading, isError, error } = trpc.public.org.useQuery();
  const [form, setForm] = useState({
    orgName: "",
    shortName: "",
    tagline: "",
    description: "",
    logoKey: null as string | null,
    logoUrl: null as string | null,
    youtube: "",
    instagram: "",
    x: "",
    discord: "",
  });

  useEffect(() => {
    if (org) {
      setForm({
        orgName: org.orgName,
        shortName: org.shortName,
        tagline: org.tagline,
        description: org.description ?? "",
        logoKey: org.logoKey,
        logoUrl: org.logoUrl,
        youtube: org.youtube ?? "",
        instagram: org.instagram ?? "",
        x: org.x ?? "",
        discord: org.discord ?? "",
      });
    }
  }, [org]);

  const save = trpc.admin.updateOrg.useMutation({
    onSuccess: () => {
      toast.success("Organization settings saved.");
      utils.public.org.invalidate();
    },
    onError: (e) => toast.error(`Unable to save settings. ${e.message}`),
  });

  if (isLoading) {
    return (
      <AdminLayout title="Organization Settings">
        <p className="text-muted-foreground">Loading settings...</p>
      </AdminLayout>
    );
  }

  if (isError || !org) {
    return (
      <AdminLayout title="Organization Settings">
        <p className="text-[hsl(var(--tsg-red))]">
          Failed to load organization settings: {error?.message ?? "Unknown error"}
        </p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Organization Settings">
      <div className="max-w-2xl space-y-6">
          <section className="glass space-y-4 rounded-xl p-6">
            <h2 className="font-display text-sm font-bold tracking-widest">IDENTITY</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Organization Name</Label>
                <Input value={form.orgName} onChange={(e) => setForm({ ...form, orgName: e.target.value })} />
              </div>
              <div>
                <Label>Short Name</Label>
                <Input value={form.shortName} onChange={(e) => setForm({ ...form, shortName: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Homepage Tagline</Label>
              <Input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
              <p className="mt-1 text-xs text-muted-foreground">Shown in the hero section on the home page.</p>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <ImageUpload
              label="Organization Logo"
              value={form.logoKey}
              previewUrl={form.logoUrl}
              category="team-logos"
              onUploaded={(key, url) => setForm({ ...form, logoKey: key, logoUrl: url })}
            />
          </section>

          <section className="glass space-y-4 rounded-xl p-6">
            <h2 className="font-display text-sm font-bold tracking-widest">SOCIAL LINKS</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>YouTube</Label>
                <Input value={form.youtube} onChange={(e) => setForm({ ...form, youtube: e.target.value })} placeholder="https://youtube.com/@..." />
              </div>
              <div>
                <Label>Instagram</Label>
                <Input value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} placeholder="https://instagram.com/..." />
              </div>
              <div>
                <Label>X (Twitter)</Label>
                <Input value={form.x} onChange={(e) => setForm({ ...form, x: e.target.value })} placeholder="https://x.com/..." />
              </div>
              <div>
                <Label>Discord</Label>
                <Input value={form.discord} onChange={(e) => setForm({ ...form, discord: e.target.value })} placeholder="https://discord.gg/..." />
              </div>
            </div>
          </section>

          <div className="sticky bottom-4">
            <Button
              onClick={() =>
                save.mutate({
                  orgName: form.orgName || "Two Side Gamers",
                  shortName: form.shortName || "TSG",
                  tagline: form.tagline,
                  description: form.description || null,
                  logoKey: form.logoKey,
                  youtube: form.youtube || null,
                  instagram: form.instagram || null,
                  x: form.x || null,
                  discord: form.discord || null,
                })
              }
              disabled={save.isPending}
              className="w-full bg-[hsl(var(--tsg-blue))] py-6 font-display text-sm font-bold tracking-[0.15em] hover:bg-[hsl(var(--tsg-blue)/0.85)]"
            >
              {save.isPending ? "Saving settings..." : "SAVE SETTINGS"}
            </Button>
          </div>
        </div>
      </AdminLayout>
    );
  }
