import { useState } from "react";
import { Download, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: "team-logos", label: "Team Logos" },
  { value: "player-photos", label: "Player Photos" },
  { value: "owner-photos", label: "Owner Photos" },
  { value: "tournament-logos", label: "Tournament Logos" },
  { value: "point-tables", label: "Point Tables" },
  { value: "other", label: "Other" },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];

export default function MediaAdmin() {
  const utils = trpc.useUtils();
  const [category, setCategory] = useState<Category | "all">("all");
  const [q, setQ] = useState("");
  const { data: list, isLoading } = trpc.admin.listMedia.useQuery(
    category === "all" ? undefined : { category },
  );
  const upload = trpc.storage.upload.useMutation();
  const updateCat = trpc.admin.updateMediaCategory.useMutation({
    onSuccess: () => utils.admin.listMedia.invalidate(),
  });
  const del = trpc.admin.deleteMedia.useMutation({
    onSuccess: () => {
      toast.success("File deleted.");
      utils.admin.listMedia.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), ""));
      await upload.mutateAsync({
        name: file.name,
        contentBase64: base64,
        contentType: file.type || "image/png",
        category: category === "all" ? "other" : category,
      });
      toast.success("Uploaded to media library.");
      utils.admin.listMedia.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const filtered = (list ?? []).filter((m) =>
    q ? m.fileName.toLowerCase().includes(q.toLowerCase()) : true,
  );

  return (
    <AdminLayout title="Media Library">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search files..."
            className="w-56 pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setCategory("all")}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-semibold",
              category === "all" ? "border-[hsl(var(--tsg-blue)/0.6)] text-[hsl(var(--tsg-blue))]" : "border-border text-muted-foreground",
            )}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs font-semibold",
                category === c.value ? "border-[hsl(var(--tsg-blue)/0.6)] text-[hsl(var(--tsg-blue))]" : "border-border text-muted-foreground",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <label className="ml-auto">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = "";
            }}
          />
          <Button asChild disabled={uploading} className="cursor-pointer gap-1.5 bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]">
            <span>
              <Upload className="h-4 w-4" /> {uploading ? "Uploading..." : "Upload"}
            </span>
          </Button>
        </label>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading media...</p>
      ) : filtered.length === 0 ? (
        <p className="glass rounded-xl p-10 text-center text-sm text-muted-foreground">
          No files yet. Upload team logos, player photos and point tables here.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {filtered.map((m) => (
            <div key={m.id} className="glass overflow-hidden rounded-xl">
              <div className="flex aspect-square items-center justify-center bg-background/40 p-3">
                {m.url ? (
                  <img src={m.url} alt={m.fileName} className="max-h-full max-w-full object-contain" loading="lazy" />
                ) : (
                  <span className="text-xs text-muted-foreground">Preview unavailable</span>
                )}
              </div>
              <div className="space-y-2 p-3">
                <p className="truncate text-xs font-semibold" title={m.fileName}>{m.fileName}</p>
                <Select
                  value={m.category}
                  onValueChange={(v) => updateCat.mutate({ id: m.id, category: v as Category })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-1.5">
                  {m.url && (
                    <a href={m.url} download target="_blank" rel="noreferrer" className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-1 text-xs">
                        <Download className="h-3 w-3" /> Get
                      </Button>
                    </a>
                  )}
                  <ConfirmDialog
                    trigger={
                      <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs">
                        <Trash2 className="h-3 w-3 text-[hsl(var(--tsg-red))]" /> Delete
                      </Button>
                    }
                    title={`Delete ${m.fileName}?`}
                    description="Records using this image will keep the key but show no image."
                    onConfirm={() => del.mutate({ id: m.id })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
