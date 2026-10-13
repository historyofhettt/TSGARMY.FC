import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";

type Category =
  | "team-logos"
  | "player-photos"
  | "owner-photos"
  | "tournament-logos"
  | "point-tables"
  | "achievement-images"
  | "card-artwork"
  | "user-avatars"
  | "team-media"
  | "other";

type Props = {
  value?: string | null; // storage key
  previewUrl?: string | null; // signed url for current value
  category: Category;
  onUploaded: (key: string | null, url: string | null) => void;
  label?: string;
  className?: string;
};

/** Image upload field — uploads to platform storage, returns the storage key. */
export function ImageUpload({ value, previewUrl, category, onUploaded, label, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const upload = trpc.storage.upload.useMutation();

  const handleFile = async (file: File) => {
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image is too large. Maximum size is 8 MB.");
      return;
    }
    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), ""),
      );
      const res = await upload.mutateAsync({
        name: file.name,
        contentBase64: base64,
        contentType: file.type || "image/png",
        category,
      });
      onUploaded(res.key, res.url);
      toast.success("Image uploaded.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className={className}>
      {label && <p className="mb-1.5 text-sm font-medium">{label}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-background/50 transition hover:border-[hsl(var(--tsg-blue)/0.6)]",
            uploading && "opacity-60",
          )}
          aria-label={value ? "Replace image" : "Upload image"}
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : previewUrl ? (
            <img src={previewUrl} alt="Current image" className="h-full w-full object-contain" />
          ) : (
            <ImagePlus className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="block text-sm font-semibold text-[hsl(var(--tsg-blue))] hover:underline"
          >
            {uploading ? "Uploading..." : value ? "Replace image" : "Choose image"}
          </button>
          <p className="text-xs text-muted-foreground">PNG, JPG, WebP up to 8 MB</p>
          {value && (
            <button
              type="button"
              onClick={() => onUploaded(null, null)}
              className="flex items-center gap-1 text-xs text-[hsl(var(--tsg-red))] hover:underline"
            >
              <X className="h-3 w-3" /> Remove
            </button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
    </div>
  );
}
