import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Search, Plus, Pencil, Trash2, Star, Eye, EyeOff,
  Upload, X, Loader2, Image as ImageIcon, Film, Play, FolderOpen,
  Settings2, Users, Trophy, Calendar, Tag, GripVertical,
  Clock, Download, Check,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import {
  MEDIA_TAGS,
  MEDIA_TYPES,
  ALBUM_STATUSES,
   ALBUM_BULK_UPLOAD_LIMIT,
   type AlbumStatus,
   type MediaPageConfig,
   type MediaType,
} from "@contracts/constants";

export type MediaItem = {
  id: number;
  title: string;
  description: string | null;
  type: MediaType;
  fileKey: string | null;
  thumbnailKey: string | null;
  youtubeVideoId: string | null;
  driveUrl: string | null;
  fileUrl: string | null;
  thumbnailUrl: string | null;
  embedUrl: string | null;
  watchUrl?: string | null;
  driveFileId?: string | null;
  category: string | null;
  teamId: number | null;
  tournamentId: number | null;
  albumId: number | null;
  tags: string[];
  featured: boolean;
  displayOrder: number;
  isActive: boolean;
  uploadDate: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  team: { id: number; name: string; slug: string } | null;
  tournament: { id: number; name: string; slug: string } | null;
};

 export type Album = {
  id: number;
  title: string;
  description: string | null;
  eventDate: Date | string | null;
  category: string | null;
  teamId: number | null;
  tournamentId: number | null;
  tags: string[];
  coverKey: string | null;
  coverUrl: string | null;
  status: AlbumStatus;
  displayOrder: number;
  mediaCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  team: { id: number; name: string; slug: string } | null;
  tournament: { id: number; name: string; slug: string } | null;
};

export type AlbumLink = {
  id: number;
  albumId: number;
  label: string;
  url: string;
  displayOrder: number;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type AlbumItem = {
  id: number;
  title: string;
  description: string | null;
  type: MediaType;
  fileKey: string | null;
  thumbnailKey: string | null;
  youtubeVideoId: string | null;
  driveUrl: string | null;
  fileUrl: string | null;
  thumbnailUrl: string | null;
  embedUrl: string | null;
  watchUrl: string | null;
  driveFileId: string | null;
  category: string | null;
  teamId: number | null;
  tournamentId: number | null;
  tags: string[];
  featured: boolean;
  displayOrder: number;
   isActive: boolean;
   uploadDate: Date | string | null;
   createdAt: Date | string;
 };
 
 const TYPE_LABEL: Record<MediaType, string> = {
  photo: "Photo",
  video: "Video",
  youtube: "YouTube",
  drive: "Google Drive",
};

const CATEGORY_OPTIONS = [
  "Highlights",
  "Photos",
  "Videos",
  "Streams",
  "Behind the Scenes",
  "Interviews",
  "Other",
];

// ---------------------------------------------------------------------------
// Media item CRUD form
// ---------------------------------------------------------------------------
function MediaFormDialog({
  open,
  onOpenChange,
  editing,
  teams,
  tournaments,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: MediaItem | null;
  teams: { id: number; name: string }[];
  tournaments: { id: number; name: string }[];
  onSaved: () => void;
}) {
  const utils = trpc.useUtils();
  const [title, setTitle] = useState(editing?.title ?? "");
  const [type, setType] = useState<MediaType>(editing?.type ?? "photo");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [category, setCategory] = useState(editing?.category ?? "");
  const [tags, setTags] = useState<string[]>(editing?.tags ?? []);
  const [teamId, setTeamId] = useState<number | "">(editing?.teamId ?? "");
  const [tournamentId, setTournamentId] = useState<number | "">(editing?.tournamentId ?? "");
  const [fileData, setFileData] = useState<{ fileBase64: string; fileName: string; fileContentType: string } | null>(null);
  const [featured, setFeatured] = useState(editing?.featured ?? false);
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);

  const createMut = trpc.media.create.useMutation({
    onSuccess: () => {
      utils.media.listAll.invalidate();
      onSaved();
      onOpenChange(false);
      toast.success("Media item created.");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.media.update.useMutation({
    onSuccess: () => {
      utils.media.listAll.invalidate();
      onSaved();
      onOpenChange(false);
      toast.success("Media item updated.");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (editing) {
      updateMut.mutate({
        id: editing.id,
        title,
        description: description || null,
        category: category || null,
        tags,
        featured,
        isActive,
        albumId: undefined,
      });
    } else {
      if ((type === "photo" || type === "video") && !fileData) {
        toast.error("Please upload a file.");
        return;
      }
      createMut.mutate({
        title,
        description: description || null,
        type,
        fileBase64: fileData?.fileBase64,
        fileName: fileData?.fileName,
        fileContentType: fileData?.fileContentType,
        category: category || null,
        teamId: teamId === "" ? undefined : Number(teamId),
        tournamentId: tournamentId === "" ? undefined : Number(tournamentId),
        tags,
        featured,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Media" : "Add Media"}</DialogTitle>
          <DialogDescription>
            {editing ? "Update media details." : "Add a new media item."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Type *</Label>
            <Select value={type} onValueChange={(v) => setType(v as MediaType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEDIA_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <MediaFileField
            type={type}
            onData={(d) => setFileData(d)}
          />
          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div>
            <Label>Category</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div>
            <Label>Team</Label>
            <Select value={teamId === "" ? "" : String(teamId)} onValueChange={(v) => setTeamId(v === "" ? "" : Number(v))}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tournament</Label>
            <Select value={tournamentId === "" ? "" : String(tournamentId)} onValueChange={(v) => setTournamentId(v === "" ? "" : Number(v))}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {tournaments.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tags</Label>
            <Input
              value={tags.join(", ")}
              onChange={(e) => setTags(e.target.value.split(",").map((t) => t.trim()).filter(Boolean))}
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={featured} onCheckedChange={setFeatured} />
              <Label className="mb-0">Featured</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label className="mb-0">Active</Label>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t pt-4">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editing ? "Save" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MediaFileField({
  type,
  onData,
}: {
  type: MediaType;
  onData: (data: { fileBase64: string; fileName: string; fileContentType: string }) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = (f: File) => {
    setFile(f);
    if (f.type.startsWith("image/")) {
      const r = new FileReader();
      r.onload = () => setPreview(r.result as string);
      r.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    if (file.size > (type === "video" ? 100 : 8) * 1024 * 1024) {
      toast.error(`File exceeds the ${(type === "video" ? 100 : 8)} MB limit.`);
      return;
    }
    const buf = await file.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    onData({ fileBase64: b64, fileName: file.name, fileContentType: file.type });
  };

  return (
    <div>
      <Label>Photo/Video file</Label>
      {file ? (
        <div className="flex items-center gap-3">
          {preview ? <img src={preview} alt="preview" className="h-16 w-16 object-cover rounded border" /> : <Film className="h-10 w-10 text-muted-foreground" />}
          <span className="text-xs">{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
          <button type="button" onClick={() => { setFile(null); setPreview(null); }} className="rounded p-1 text-muted-foreground hover:bg-muted">
            <X className="h-3 w-3" />
          </button>
          <Button size="sm" onClick={handleUpload}>Attach</Button>
        </div>
      ) : (
        <label className="flex h-20 cursor-pointer items-center justify-center rounded-lg border border-dashed border-border">
          <input
            type="file"
            accept={type === "video" ? "video/*" : "image/*"}
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          <Upload className="h-5 w-5 text-muted-foreground" />
        </label>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Album CRUD form
// ---------------------------------------------------------------------------
function AlbumFormDialog({
  open,
  onOpenChange,
  editing,
  teams,
  tournaments,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Album | null;
  teams: { id: number; name: string }[];
  tournaments: { id: number; name: string }[];
  onSaved: () => void;
}) {
  const create = trpc.media.albumCreate.useMutation();
  const update = trpc.media.albumUpdate.useMutation();
  const upload = trpc.storage.uploadMedia.useMutation();
  const utils = trpc.useUtils();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [category, setCategory] = useState("");
  const [teamId, setTeamId] = useState<string>("");
  const [tournamentId, setTournamentId] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);
  const [status, setStatus] = useState<AlbumStatus>("draft");
  const [displayOrder, setDisplayOrder] = useState(0);
  const [coverKey, setCoverKey] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);

  if (open && !initialized) {
    if (editing) {
      setTitle(editing.title);
      setDescription(editing.description ?? "");
      setEventDate(
        editing.eventDate
          ? new Date(editing.eventDate).toISOString().slice(0, 10)
          : "",
      );
      setCategory(editing.category ?? "");
      setTeamId(editing.teamId ? String(editing.teamId) : "");
      setTournamentId(editing.tournamentId ? String(editing.tournamentId) : "");
      setTags(editing.tags ?? []);
      setStatus(editing.status);
      setDisplayOrder(editing.displayOrder);
      setCoverKey(editing.coverKey);
      setCoverUrl(editing.coverUrl);
    } else {
      setTitle("");
      setDescription("");
      setEventDate("");
      setCategory("");
      setTeamId("");
      setTournamentId("");
      setTags([]);
      setStatus("draft");
      setDisplayOrder(0);
      setCoverKey(null);
      setCoverUrl(null);
    }
    setInitialized(true);
  }
  if (!open && initialized) {
    setInitialized(false);
  }

  const handleCoverUpload = async (file: File) => {
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Cover image must be under 8 MB.");
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), ""),
      );
      const res = await upload.mutateAsync({
        name: file.name,
        contentBase64: base64,
        contentType: file.type || "application/octet-stream",
      });
      setCoverKey(res.key);
      setCoverUrl(res.url);
      toast.success("Cover image uploaded.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Title is required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        eventDate: eventDate ? new Date(eventDate).toISOString() : null,
        category: category || null,
        teamId: teamId ? Number(teamId) : null,
        tournamentId: tournamentId ? Number(tournamentId) : null,
        tags,
        coverKey: coverKey ?? null,
        status,
        displayOrder,
      };

      if (editing) {
        await update.mutateAsync({ id: editing.id, ...payload });
        toast.success("Album updated.");
      } else {
        const res = await create.mutateAsync(payload);
        toast.success(`Album "${res.id}" created.`);
      }
      utils.media.albumListAll.invalidate();
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save album.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-w-2xl border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            {editing ? "Edit album" : "Create album"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Update album details."
              : "Create a new album (folder) to group media."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-2">
          <div className="space-y-1.5">
            <Label htmlFor="af-title">Title *</Label>
            <Input
              id="af-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Grand Finals v Arsenal"
              maxLength={255}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="af-desc">Description</Label>
            <Textarea
              id="af-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              maxLength={2000}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="af-date">Event date</Label>
              <Input
                id="af-date"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="af-category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="af-category" className="h-9">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="af-team">Team</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger id="af-team" className="h-9">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="af-tournament">Tournament</Label>
              <Select value={tournamentId} onValueChange={setTournamentId}>
                <SelectTrigger id="af-tournament" className="h-9">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {tournaments.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Cover image</Label>
            <div className="flex items-center gap-4">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt="Cover"
                  className="h-20 w-20 rounded-lg border border-border object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-border bg-background/50">
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="space-y-1">
                <label className="flex cursor-pointer items-center gap-1 text-sm font-semibold text-[hsl(var(--tsg-blue))] hover:underline">
                  <Upload className="h-4 w-4" /> Choose image
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleCoverUpload(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                <p className="text-xs text-muted-foreground">PNG/JPG/WebP up to 8 MB</p>
                {coverKey && (
                  <button
                    type="button"
                    onClick={() => {
                      setCoverKey(null);
                      setCoverUrl(null);
                    }}
                    className="text-xs text-[hsl(var(--tsg-red))] hover:underline"
                  >
                    Remove cover
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2">
              {MEDIA_TAGS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() =>
                    setTags((prev) =>
                      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
                    )
                  }
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-xs font-semibold transition",
                    tags.includes(t)
                      ? "border-[hsl(var(--tsg-blue)/0.6)] bg-[hsl(var(--tsg-blue)/0.1)] text-[hsl(var(--tsg-blue))]"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="af-status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as AlbumStatus)}>
                <SelectTrigger id="af-status" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALBUM_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="af-order">Display order</Label>
              <Input
                id="af-order"
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="gap-2 bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? "Save changes" : "Create album"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Bulk upload form (per album)
// ---------------------------------------------------------------------------
function AlbumBulkUploadForm({
  albumId,
  onDone,
}: {
  albumId: number;
  onDone: () => void;
}) {
  const utils = trpc.useUtils();
  const bulkUpload = trpc.media.albumBulkUpload.useMutation();
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);
  const [captions, setCaptions] = useState<Record<number, string>>({});
  const [types, setTypes] = useState<Record<number, MediaType>>({});
  const [youtubeUrls, setYoutubeUrls] = useState<Record<number, string>>({});
  const [driveUrls, setDriveUrls] = useState<Record<number, string>>({});
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<{ ok: number; fail: number } | null>(null);

  const MAX_IMAGE = 8 * 1024 * 1024;
  const MAX_VIDEO = 100 * 1024 * 1024;
  const IMAGE_TYPES = new Set([
    "image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "image/avif", "image/svg+xml",
  ]);
  const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const arr = Array.from(newFiles);
    if (fileEntries.length + arr.length > ALBUM_BULK_UPLOAD_LIMIT) {
      toast.error(`You can upload up to ${ALBUM_BULK_UPLOAD_LIMIT} files at once.`);
      return;
    }
    const validated: FileEntry[] = [];
    for (let i = 0; i < arr.length; i++) {
      const f = arr[i];
      const isImage = IMAGE_TYPES.has(f.type);
      const isVideo = VIDEO_TYPES.has(f.type);
      if (!isImage && !isVideo) {
        toast.error(`${f.name}: Only image and video files are allowed.`);
        continue;
      }
      const maxSize = isVideo ? MAX_VIDEO : MAX_IMAGE;
      if (f.size > maxSize) {
        toast.error(`${f.name}: exceeds the ${isVideo ? 100 : 8} MB limit.`);
        continue;
      }
      validated.push({ file: f, id: `${Date.now()}-${i}-${f.name}` });
    }
    setFileEntries((prev) => [...prev, ...validated]);
  };

  const handleUpload = async () => {
    if (fileEntries.length === 0) {
      toast.error("Choose at least one file.");
      return;
    }
    setUploading(true);
    setProgress(0);
    setUploadResult(null);

    const items: {
      title: string;
      description?: string;
      type: MediaType;
      fileBase64?: string;
      fileName?: string;
      fileContentType?: string;
      fileKey?: string;
      youtubeUrl?: string;
      driveUrl?: string;
      caption?: string;
      displayOrder?: number;
    }[] = [];

    let processed = 0;
    const failed: string[] = [];

    for (let i = 0; i < fileEntries.length; i++) {
      const entry = fileEntries[i];
      const f = entry.file;
      const t = types[i] ?? (f.type.startsWith("image/") ? "photo" : "video");
      const caption = captions[i] || f.name;
      setProgress(Math.round(((i + 1) / fileEntries.length) * 100));

      if (t === "photo" || t === "video") {
        try {
          const buffer = await f.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), ""),
          );
          items.push({
            title: caption,
            type: t,
            fileBase64: base64,
            fileName: f.name,
            fileContentType: f.type || "application/octet-stream",
            caption,
            displayOrder: i,
          });
          processed++;
        } catch {
          failed.push(f.name);
        }
      } else if (t === "youtube") {
        items.push({
          title: caption,
          type: t,
          youtubeUrl: youtubeUrls[i] || "",
          caption,
          displayOrder: i,
        });
        processed++;
      } else if (t === "drive") {
        items.push({
          title: caption,
          type: t,
          driveUrl: driveUrls[i] || "",
          caption,
          displayOrder: i,
        });
        processed++;
      }
    }

    try {
      const res = await bulkUpload.mutateAsync({ albumId, items });
      setUploadResult({ ok: res.count, fail: failed.length });
      toast.success(`${res.count} item(s) added to album.`);
      utils.media.albumListAll.invalidate();
      utils.media.albumGet.invalidate();
      setFileEntries([]);
      setCaptions({});
      setTypes({});
      setYoutubeUrls({});
      setDriveUrls({});
      onDone();
    } catch (e) {
      setUploadResult({ ok: processed, fail: failed.length });
      toast.error(e instanceof Error ? e.message : "Bulk upload failed.");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="glass rounded-xl p-4">
      <div className="mb-3 flex items-center gap-2">
        <Upload className="h-4 w-4 text-[hsl(var(--tsg-blue))]" />
        <h4 className="font-display text-sm font-bold">Add media (up to {ALBUM_BULK_UPLOAD_LIMIT})</h4>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-background/40 px-4 py-6 text-center">
          <Input
            type="file"
            multiple
            accept="image/*,video/mp4,video/webm,video/quicktime"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="bulk-files"
          />
          <label
            htmlFor="bulk-files"
            className="cursor-pointer text-sm font-semibold text-[hsl(var(--tsg-blue))] hover:underline"
          >
            Choose files to upload
          </label>
        </div>

        {fileEntries.length > 0 && (
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {fileEntries.map((entry, i) => {
              const t = types[i] ?? (entry.file.type.startsWith("image/") ? "photo" : "video");
              return (
                <div key={entry.id} className="flex items-center gap-2 rounded-md border border-border p-2 text-xs">
                  <FileTypeIcon file={entry.file} />
                  <span className="truncate">{entry.file.name}</span>
                  <span className="text-muted-foreground">({(entry.file.size / 1024 / 1024).toFixed(1)} MB)</span>
                  <Select
                    value={t}
                    onValueChange={(v) => setTypes((p) => ({ ...p, [i]: v as MediaType }))}
                  >
                    <SelectTrigger className="h-6 w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEDIA_TYPES.map((mt) => (
                        <SelectItem key={mt} value={mt}>{TYPE_LABEL[mt]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(t === "photo" || t === "video") && (
                    <Input
                      value={captions[i] || ""}
                      onChange={(e) => setCaptions((p) => ({ ...p, [i]: e.target.value }))}
                      placeholder="Caption / title"
                      className="h-6 w-40"
                    />
                  )}
                  {t === "youtube" && (
                    <Input
                      value={youtubeUrls[i] || ""}
                      onChange={(e) => setYoutubeUrls((p) => ({ ...p, [i]: e.target.value }))}
                      placeholder="YouTube URL"
                      className="h-6 w-40"
                    />
                  )}
                  {t === "drive" && (
                    <Input
                      value={driveUrls[i] || ""}
                      onChange={(e) => setDriveUrls((p) => ({ ...p, [i]: e.target.value }))}
                      placeholder="Google Drive share URL"
                      className="h-6 w-40"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setFileEntries((prev) => prev.filter((e) => e.id !== entry.id))}
                    className="rounded p-1 text-muted-foreground hover:bg-muted"
                    title="Remove"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {uploadResult && (
          <p className="text-xs">
            Uploaded: {uploadResult.ok} successful{uploadResult.fail > 0 && `, ${uploadResult.fail} failed`}
          </p>
        )}

        {uploading && (
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded bg-border">
              <div className="h-full bg-[hsl(var(--tsg-blue))]" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs">{progress}%</span>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            setFileEntries([]);
            setCaptions({});
            setTypes({});
            setYoutubeUrls({});
            setDriveUrls({});
            setUploadResult(null);
          }} disabled={uploading}>
            Clear
          </Button>
          <Button
            size="sm"
            disabled={fileEntries.length === 0 || uploading}
            className="gap-1.5 bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]"
            onClick={handleUpload}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload All
          </Button>
        </div>
      </div>
    </div>
  );
}

type FileEntry = { file: File; id: string };

function FileTypeIcon({ file }: { file: File }) {
  if (file.type.startsWith("image/")) return <ImageIcon className="h-5 w-5 text-[hsl(var(--tsg-blue))]" />;
  if (file.type.startsWith("video/")) return <Film className="h-5 w-5 text-[hsl(var(--tsg-blue))]" />;
  return <ImageIcon className="h-5 w-5 text-muted-foreground" />;
}

// ---------------------------------------------------------------------------
// Album links manager
// ---------------------------------------------------------------------------
function AlbumLinksManager({ albumId }: { albumId: number }) {
  const utils = trpc.useUtils();
  const { data: links, isLoading } = trpc.media.albumLinks.useQuery({ albumId });
  const upsert = trpc.media.albumLinkUpsert.useMutation({
    onSuccess: () => {
      utils.media.albumLinks.invalidate({ albumId });
      toast.success("Link saved.");
    },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.media.albumLinkDelete.useMutation({
    onSuccess: () => {
      utils.media.albumLinks.invalidate({ albumId });
      toast.success("Link removed.");
    },
    onError: (e) => toast.error(e.message),
  });

  const [editing, setEditing] = useState<AlbumLink | null>(null);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [order, setOrder] = useState(0);

  const startEdit = (link: AlbumLink) => {
    setEditing(link);
    setLabel(link.label);
    setUrl(link.url);
    setOrder(link.displayOrder);
  };
  const startNew = () => {
    setEditing(null);
    setLabel("");
    setUrl("");
    setOrder((links?.length ?? 0));
  };
  const save = async () => {
    if (!label.trim() || !url.trim()) {
      toast.error("Label and URL are required.");
      return;
    }
    await upsert.mutateAsync({
      id: editing?.id,
      albumId,
      label: label.trim(),
      url: url.trim(),
      displayOrder: order,
    });
    setEditing(null);
    setLabel("");
    setUrl("");
  };

  if (isLoading) {
    return <p className="py-4 text-sm text-muted-foreground">Loading links...</p>;
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-display text-sm font-bold">Album links</h4>
        <Button variant="outline" size="sm" className="gap-1" onClick={startNew}>
          <Plus className="h-3 w-3" /> Add link
        </Button>
      </div>

      {editing !== null && (
        <div className="glass rounded-md p-3">
          <div className="mb-2 text-xs font-semibold">
            {editing ? "Edit link" : "New link"}
          </div>
          <div className="grid grid-cols-[1fr_2fr_auto] gap-2 items-end">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label"
              maxLength={128}
            />
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              maxLength={1024}
            />
            <Input
              type="number"
              value={order}
              onChange={(e) => setOrder(Number(e.target.value))}
              className="w-16"
            />
          </div>
          <div className="mt-2 flex gap-2">
            <Button size="sm" className="gap-1" onClick={save}>
              <Check className="h-3 w-3" /> Save
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditing(null);
                setLabel("");
                setUrl("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {(links?.length ?? 0) === 0 && editing === null ? (
        <p className="text-xs text-muted-foreground">No links yet.</p>
      ) : (
        <div className="space-y-1">
          {(links ?? []).map((l) => (
            <div key={l.id} className="flex items-center justify-between rounded-md border border-border px-2 py-1.5 text-sm">
              <div className="flex items-center gap-2">
                <GripVertical className="h-3 w-3 text-muted-foreground" />
                <span className="font-semibold">{l.label}</span>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {l.url}
                </a>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => startEdit(l)}
                  className="rounded p-1 text-muted-foreground hover:text-foreground"
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <ConfirmDialog
                  trigger={
                    <button className="rounded p-1 text-[hsl(var(--tsg-red))] hover:bg-[hsl(var(--tsg-red)/0.08)]" title="Delete link">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  }
                  title={`Remove link "${l.label}"?`}
                  onConfirm={() => del.mutate({ id: l.id })}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Album detail view (inside an album folder)
// ---------------------------------------------------------------------------
function AlbumDetail({
  album,
  onBack,
  onDelete,
  onItemDelete,
}: {
  album: Album;
  onBack: () => void;
  onDelete: () => void;
  onItemDelete: (id: number) => void;
}) {
  const utils = trpc.useUtils();
  const { data, isLoading, refetch } = trpc.media.albumGet.useQuery(
    { id: album.id },
    { staleTime: 10_000 },
  );
  const setFeatured = trpc.media.setFeatured.useMutation({
    onSuccess: () => utils.media.albumGet.invalidate({ id: album.id }),
    onError: (e) => toast.error(e.message),
  });
  const toggleActive = trpc.media.update.useMutation({
    onSuccess: () => utils.media.albumGet.invalidate({ id: album.id }),
    onError: (e) => toast.error(e.message),
  });
  const bulkDelete = trpc.media.albumBulkDeleteItems.useMutation({
    onSuccess: () => {
      utils.media.albumGet.invalidate({ id: album.id });
      utils.media.albumListAll.invalidate();
      toast.success("Selected items removed from album.");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateAlbum = trpc.media.albumUpdate.useMutation({
    onSuccess: () => {
      utils.media.albumGet.invalidate({ id: album.id });
      utils.media.albumListAll.invalidate();
      toast.success("Album updated.");
    },
    onError: (e) => toast.error(e.message),
  });

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editingCover, setEditingCover] = useState(false);

  const items: AlbumItem[] = data?.items ?? [];
  const photoItems = items.filter((i) => i.type === "photo");
  const hasPhotos = photoItems.length > 0;
  const download = trpc.media.albumDownloadPhotos.useQuery(
    { id: album.id },
    { enabled: !!album && album.status === "published" && hasPhotos },
  );

  const moveItemOut = async (itemId: number) => {
    try {
      await toggleActive.mutateAsync({ id: itemId, albumId: null });
      toast.success("Item removed from album.");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Move failed.");
    }
  };

  const exportZip = () => {
    if (download.data?.zip) {
      const binary = atob(download.data.zip);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `album-photos-${album.id}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to albums
      </button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold">{album.title}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {album.category && (
              <span className="flex items-center gap-1"><Tag className="h-3 w-3" /> {album.category}</span>
            )}
            {album.eventDate && (
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(album.eventDate)}</span>
            )}
            {album.team && <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {album.team.name}</span>}
            {album.tournament && <span className="flex items-center gap-1"><Trophy className="h-3 w-3" /> {album.tournament.name}</span>}
            {album.tags.length > 0 && <span className="flex items-center gap-1"><Tag className="h-3 w-3" /> {album.tags.join(", ")}</span>}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> Status: {album.status}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={album.status === "published"}
            onCheckedChange={(checked) =>
              updateAlbum.mutate({
                id: album.id,
                status: checked ? "published" : "draft",
              })
            }
          />
          <Label className="text-xs">Published</Label>
          <ConfirmDialog
            trigger={
              <Button variant="outline" size="sm" className="gap-1 text-xs">
                <Trash2 className="h-3 w-3 text-[hsl(var(--tsg-red))]" /> Delete album
              </Button>
            }
            title={`Delete album "${album.title}"?`}
            description="Media items will be disassociated (not deleted) and links removed. This cannot be undone."
            onConfirm={() => onDelete()}
          />
        </div>
      </div>

      {/* Cover selector */}
      <div className="flex items-center gap-4 rounded-lg border border-border p-3">
        <div className="flex items-center gap-2">
          <Label>Cover image:</Label>
          {data?.coverUrl ? (
            <img src={data.coverUrl} alt="Cover" className="h-16 w-16 rounded object-cover" />
          ) : (
            <FolderOpen className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        {editingCover ? (
          <div className="flex items-center gap-2">
            <Input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 8 * 1024 * 1024) {
                  toast.error("Cover image must be under 8 MB.");
                  return;
                }
                try {
                  const buffer = await f.arrayBuffer();
                  const base64 = btoa(
                    new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), ""),
                  );
                  const upload = trpc.storage.uploadMedia.useMutation();
                  const res = await upload.mutateAsync({
                    name: f.name,
                    contentBase64: base64,
                    contentType: f.type || "application/octet-stream",
                  });
          await updateAlbum.mutateAsync({ id: album.id, coverKey: res.key });
          toast.success("Cover set.");
                  refetch();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Cover upload failed.");
                } finally {
                  setEditingCover(false);
                }
              }}
            />
            <Button size="sm" variant="ghost" onClick={() => setEditingCover(false)}>Cancel</Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setEditingCover(true)}>
            <Pencil className="h-3 w-3" /> {data?.coverUrl ? "Change" : "Set"} cover
          </Button>
        )}
        {data?.coverKey && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1 text-xs text-[hsl(var(--tsg-red))]"
            onClick={() => updateAlbum.mutate({ id: album.id, coverKey: null })}
            title="Remove cover"
          >
            <X className="h-3 w-3" /> Remove
          </Button>
        )}
      </div>

      {/* Bulk upload */}
      <AlbumBulkUploadForm albumId={album.id} onDone={refetch} />

      {/* Download ZIP */}
      {album.status === "published" && hasPhotos && (download.data?.entries ?? 0) > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-border p-3">
          <Download className="h-4 w-4 text-[hsl(var(--tsg-blue))]" />
          <span className="text-sm">Photos are ready for download as a ZIP.</span>
          <Button size="sm" className="ml-auto gap-1.5" onClick={exportZip}>
            Download ZIP
          </Button>
        </div>
      )}

      {/* Links */}
      <AlbumLinksManager albumId={album.id} />

      {/* Items header */}
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-bold">Album items ({items.length})</h3>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <>
              <ConfirmDialog
                trigger={
                  <Button variant="outline" size="sm" className="gap-1 text-xs">
                    <FolderOpen className="h-3 w-3" /> Remove {selected.size} from album
                  </Button>
                }
                title={`Remove ${selected.size} item(s) from this album?`}
                description="Items are moved back to the shared media library. No files are deleted from storage."
                onConfirm={async () => {
                  for (const id of selected) {
                    await moveItemOut(id);
                  }
                  setSelected(new Set());
                  refetch();
                }}
              />
              <ConfirmDialog
                trigger={
                  <Button variant="outline" size="sm" className="gap-1 text-xs text-[hsl(var(--tsg-red))]">
                    <Trash2 className="h-3 w-3" /> Permanently delete {selected.size}
                  </Button>
                }
                title={`Permanently delete ${selected.size} item(s)?`}
                description="The uploaded files will be removed from storage. This cannot be undone."
                onConfirm={async () => {
                  await bulkDelete.mutateAsync({ albumId: album.id, ids: [...selected] });
                  setSelected(new Set());
                  refetch();
                }}
              />
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => setSelected(new Set())}
              >
                Clear selection
              </Button>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading items...</p>
      ) : items.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center">
          <Upload className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-semibold">No media in this album yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Use the bulk upload above to add photos and videos.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full text-xs">
            <thead className="border-b border-border bg-background/40">
              <tr>
                <th className="w-8 px-2 py-2 text-left">
                  <input
                    type="checkbox"
                    checked={selected.size === items.length && items.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) setSelected(new Set(items.map((i) => i.id)));
                      else setSelected(new Set());
                    }}
                  />
                </th>
                <th className="px-2 py-2 text-left">Order</th>
                <th className="px-2 py-2 text-left">Type</th>
                <th className="px-2 py-2 text-left">Preview</th>
                <th className="px-2 py-2 text-left">Title / Caption</th>
                <th className="px-2 py-2 text-left">Team</th>
                <th className="px-2 py-2 text-left">Date</th>
                <th className="px-2 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border/50">
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(item.id);
                        else next.delete(item.id);
                        setSelected(next);
                      }}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <GripVertical className="h-4 w-4 cursor-move text-muted-foreground" />
                  </td>
                  <td className="px-2 py-2">
                    <span className="flex items-center gap-1">
                      {ITEM_TYPE_ICON[item.type]} {TYPE_LABEL[item.type as MediaType] ?? item.type}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    {item.thumbnailUrl || item.fileUrl ? (
                      item.type === "video" ? (
                        <video src={item.fileUrl!} className="h-10 w-16 rounded object-cover" />
                      ) : (
                        <img src={item.thumbnailUrl || item.fileUrl!} alt={item.title} className="h-10 w-16 rounded object-cover" />
                      )
                    ) : item.embedUrl ? (
                      <img src={item.embedUrl.replace("https://www.youtube.com/embed/", "https://i.ytimg.com/vi/")} alt={item.title} className="h-10 w-16 rounded object-cover" />
                    ) : (
                      <FolderOpen className="h-6 w-6 text-muted-foreground" />
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => {
                        const v = e.target.value;
                        // optimistic local rename via mutation
                        toggleActive.mutate({ id: item.id, title: v });
                      }}
                      className="w-full text-xs"
                      style={{ background: "transparent", border: "none", outline: "none" }}
                    />
                    {item.description && (
                      <p className="text-[10px] text-muted-foreground">{item.description}</p>
                    )}
                  </td>
                   <td className="px-2 py-2">{item.category ?? "—"}</td>
                   <td className="px-2 py-2">
                     {item.uploadDate ? formatDate(item.uploadDate) : "—"}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => moveItemOut(item.id)}
                        title="Remove from album (keep item)"
                        className="rounded p-1 text-muted-foreground hover:text-foreground"
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-1"
                        onClick={() => setFeatured.mutate({ id: item.id, featured: !item.featured })}
                        title={item.featured ? "Unfeature" : "Feature"}
                      >
                        {item.featured ? <Star className="h-3 w-3 fill-[hsl(var(--tsg-blue))] text-[hsl(var(--tsg-blue))]" /> : <Star className="h-3 w-3" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-1"
                        onClick={() => toggleActive.mutate({ id: item.id, isActive: !item.isActive })}
                        title={item.isActive ? "Hide" : "Show"}
                      >
                        {item.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </Button>
                       <Button
                         variant="ghost"
                         size="sm"
                         className="h-6 w-6 p-1"
                         onClick={() => {
                           const coverKey = item.thumbnailKey || item.fileKey || null;
                           if (coverKey) {
                             updateAlbum.mutateAsync({ id: album.id, coverKey });
                             refetch();
                           }
                         }}
                         title="Use as cover"
                       >
                         <ImageIcon className="h-3.5 w-3.5" />
                        </Button>
                        {item.type === "photo" && item.fileKey && (
                          <a
                            href={`/api/media/download/${item.fileKey}`}
                            className="rounded p-1 text-muted-foreground hover:text-foreground"
                            title="Download original"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <ConfirmDialog
                         trigger={
                           <button className="rounded p-1 text-[hsl(var(--tsg-red))] hover:bg-[hsl(var(--tsg-red)/0.08)]" title="Delete item">
                             <Trash2 className="h-3.5 w-3.5" />
                           </button>
                         }
                         title={`Permanently delete "${item.title}"?`}
                         description="The uploaded file will be removed from storage. This cannot be undone."
                         onConfirm={() => onItemDelete(item.id)}
                       />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const ITEM_TYPE_ICON: Record<string, ReactNode> = {
  photo: <ImageIcon className="h-4 w-4" />,
  video: <Film className="h-4 w-4" />,
  youtube: <Play className="h-4 w-4" />,
  drive: <FolderOpen className="h-4 w-4" />,
};

// Re-export for reuse
export { ITEM_TYPE_ICON };

// ---------------------------------------------------------------------------
// All Media (standalone items) — reuse form + list
// ---------------------------------------------------------------------------
// (The standalone media management reuses the existing item list + MediaFormDialog
//  logic from this file. See below.)

// ---------------------------------------------------------------------------
// Page settings
// ---------------------------------------------------------------------------
function ConfigPanel({
  config,
  onSaved,
}: {
  config: MediaPageConfig;
  onSaved: () => void;
}) {
  const updateConfig = trpc.media.updateConfig.useMutation({
    onSuccess: () => {
      toast.success("Configuration saved.");
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  const [local, setLocal] = useState<MediaPageConfig>(config);
  const [syncedFrom, setSyncedFrom] = useState<MediaPageConfig | null>(null);
  if (config && Object.keys(config).length > 0 && syncedFrom !== config) {
    setLocal(config);
    setSyncedFrom(config);
  }

  const FLAGS: { key: keyof MediaPageConfig; label: string; hint: string }[] = [
    { key: "showFeaturedSection", label: "Featured section", hint: "Show the featured items banner at the top." },
    { key: "showGallery", label: "Gallery grid", hint: "Show the main media grid." },
    { key: "showTeamFilter", label: "Team filter", hint: "Allow filtering by team." },
    { key: "showCategoryFilter", label: "Category filter", hint: "Allow filtering by category." },
    { key: "showTournamentFilter", label: "Tournament filter", hint: "Allow filtering by tournament." },
    { key: "showTagFilter", label: "Tag filter", hint: "Allow filtering by TSG ARMY / TSG PROS / TSG ARTEMIS tags." },
    { key: "showSearch", label: "Search", hint: "Show the search box." },
    { key: "showSorting", label: "Sorting", hint: "Show sort options (newest, oldest, featured, title)." },
    { key: "showDescriptions", label: "Descriptions", hint: "Show item descriptions on cards." },
    { key: "showUploadDates", label: "Upload dates", hint: "Show upload dates on cards." },
    { key: "showFullscreenPreview", label: "Fullscreen preview", hint: "Allow opening items in a fullscreen dialog." },
    { key: "showMediaCount", label: "Media count", hint: "Show the total number of items." },
    { key: "includeHighlights", label: "Include player highlights", hint: "Reuse existing player highlights in the gallery (no duplication)." },
  ];

  return (
    <div className="glass rounded-xl p-5">
      <div className="mb-4 flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-[hsl(var(--tsg-blue))]" />
        <h3 className="font-display text-sm font-bold tracking-wider">
          PAGE FEATURES
        </h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Every optional feature of the Media Page can be toggled independently.
        Disabled features disappear from the public page.
      </p>
      <div className="space-y-1">
        {FLAGS.map((f) => (
          <div
            key={f.key}
            className="flex items-center justify-between gap-4 rounded-lg px-3 py-2.5 transition hover:bg-accent/50"
          >
            <div>
              <p className="text-sm font-semibold">{f.label}</p>
              <p className="text-xs text-muted-foreground">{f.hint}</p>
            </div>
            <Switch
              checked={local[f.key] ?? false}
              onCheckedChange={(checked) =>
                setLocal((prev) => ({ ...prev, [f.key]: checked }))
              }
            />
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <Button
          onClick={() => updateConfig.mutate({ config: local as Record<string, boolean> })}
          disabled={updateConfig.isPending}
          className="gap-2 bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]"
        >
          {updateConfig.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save configuration
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
type Tab = "albums" | "media" | "config";

export default function MediaPageAdmin() {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<Tab>("albums");
  const [albumFormOpen, setAlbumFormOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);

  const { data: allAlbums, isLoading: albumsLoading } = trpc.media.albumListAll.useQuery();
  const { data: config } = trpc.media.getConfig.useQuery();
  const { data: teamsData } = trpc.public.teams.useQuery();
  const { data: tournamentsData } = trpc.public.tournaments.useQuery();

  const teamOptions = useMemo(
    () => (teamsData ?? []).map((t) => ({ id: t.id, name: t.name })),
    [teamsData],
  );
  const tournamentOptions = useMemo(
    () => (tournamentsData ?? []).map((t) => ({ id: t.id, name: t.name })),
    [tournamentsData],
  );

   const albums: Album[] = (allAlbums ?? []) as Album[];
   const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);

   // ---- All media tab ----
   const [search, setSearch] = useState("");
   const [typeFilter, setTypeFilter] = useState<MediaType | "all">("all");
   const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
   const { data: allItems, isLoading: itemsLoading } = trpc.media.listAll.useQuery({
    search: search || undefined,
    type: typeFilter === "all" ? undefined : typeFilter,
    active: activeFilter === "all" ? undefined : activeFilter === "active",
   });
   const [itemFormOpen, setItemFormOpen] = useState(false);
   const [editingItem, setEditingItem] = useState<MediaItem | null>(null);

  const delItem = trpc.media.delete.useMutation({
    onSuccess: () => {
      toast.success("Media item deleted.");
      utils.media.listAll.invalidate();
      utils.media.albumGet.invalidate();
      utils.media.albumListAll.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const moveItem = trpc.media.update.useMutation({
    onSuccess: () => {
      utils.media.listAll.invalidate();
      utils.media.albumGet.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const albumDelete = trpc.media.albumDelete.useMutation({
    onSuccess: () => {
      toast.success("Album deleted.");
      utils.media.albumListAll.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const filteredItems = allItems ?? [];

  return (
    <AdminLayout title="Media Page">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-border p-0.5">
          <button
            onClick={() => setActiveTab("albums")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition",
              activeTab === "albums"
                ? "bg-[hsl(var(--tsg-blue)/0.15)] text-[hsl(var(--tsg-blue))]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <FolderOpen className="h-3.5 w-3.5" /> Albums / Folders
          </button>
          <button
            onClick={() => setActiveTab("media")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition",
              activeTab === "media"
                ? "bg-[hsl(var(--tsg-blue)/0.15)] text-[hsl(var(--tsg-blue))]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ImageIcon className="h-3.5 w-3.5" /> All Media
          </button>
          <button
            onClick={() => setActiveTab("config")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition",
              activeTab === "config"
                ? "bg-[hsl(var(--tsg-blue)/0.15)] text-[hsl(var(--tsg-blue))]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Settings2 className="h-3.5 w-3.5" /> Page Settings
          </button>
        </div>
        {activeTab === "media" && (
          <Button
            onClick={() => {
              setEditingItem(null);
              setItemFormOpen(true);
            }}
            className="ml-auto gap-1.5 bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]"
          >
            <Plus className="h-4 w-4" /> Add media
          </Button>
        )}
        {activeTab === "albums" && !selectedAlbum && (
          <Button
            onClick={() => {
              setEditingAlbum(null);
              setAlbumFormOpen(true);
            }}
            className="ml-auto gap-1.5 bg-[hsl(var(--tsg-blue))] hover:bg-[hsl(var(--tsg-blue)/0.85)]"
          >
            <Plus className="h-4 w-4" /> New album
          </Button>
        )}
      </div>

      {/* ===== Albums/Folders tab ===== */}
      {activeTab === "albums" && (
        <>
          {selectedAlbum ? (
            <AlbumDetail
              album={selectedAlbum}
              onBack={() => setSelectedAlbum(null)}
              onDelete={async () => {
                await albumDelete.mutateAsync({ id: selectedAlbum.id });
                setSelectedAlbum(null);
                utils.media.albumListAll.invalidate();
              }}
              onItemDelete={async (id) => {
                await delItem.mutateAsync({ id });
                utils.media.albumGet.invalidate({ id: selectedAlbum.id });
                utils.media.albumListAll.invalidate();
              }}
            />
          ) : albumsLoading ? (
            <p className="py-8 text-sm text-muted-foreground">Loading albums...</p>
          ) : albums.length === 0 ? (
            <div className="glass rounded-xl p-12 text-center">
              <FolderOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-semibold">No albums yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Albums group media into folders shown on the public Media page.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {albums.map((a) => (
                <div
                  key={a.id}
                  className="glass flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background/40">
                    {a.coverUrl ? (
                      <img src={a.coverUrl} alt={a.title} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <FolderOpen className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold" title={a.title}>
                        {a.title}
                      </p>
                      {a.status === "published" ? (
                        <Eye className="h-3.5 w-3.5 text-[hsl(var(--tsg-green))]" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {a.category && <span>{a.category}</span>}
                      {a.team && <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {a.team.name}</span>}
                      {a.tournament && <span className="flex items-center gap-1"><Trophy className="h-3 w-3" /> {a.tournament.name}</span>}
                      {a.eventDate && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(a.eventDate)}</span>}
                      <span>{a.mediaCount ?? 0} items</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs"
                      onClick={() => setSelectedAlbum(a)}
                    >
                      <Pencil className="h-3 w-3" /> Manage
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs"
                      onClick={() => {
                        setEditingAlbum(a);
                        setAlbumFormOpen(true);
                      }}
                    >
                      <Settings2 className="h-3 w-3" /> Edit
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <button
                          className="rounded-md border border-[hsl(var(--tsg-red)/0.5)] px-2 py-1 text-xs font-semibold text-[hsl(var(--tsg-red))] hover:bg-[hsl(var(--tsg-red)/0.08)]"
                          title="Delete album"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      }
                      title={`Delete album "${a.title}"?`}
                      description="Media items will be disassociated (not deleted) and links removed."
                      onConfirm={() => albumDelete.mutate({ id: a.id })}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ===== All Media tab ===== */}
      {activeTab === "media" && (
        <>
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items..."
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setTypeFilter("all")}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-semibold transition",
                  typeFilter === "all"
                    ? "border-[hsl(var(--tsg-blue)/0.6)] text-[hsl(var(--tsg-blue))]"
                    : "border-border text-muted-foreground",
                )}
              >
                All types
              </button>
              {MEDIA_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-xs font-semibold transition",
                    typeFilter === t
                      ? "border-[hsl(var(--tsg-blue)/0.6)] text-[hsl(var(--tsg-blue))]"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 md:ml-auto">
              {(["all", "active", "inactive"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setActiveFilter(a)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-xs font-semibold capitalize transition",
                    activeFilter === a
                      ? "border-[hsl(var(--tsg-blue)/0.6)] text-[hsl(var(--tsg-blue))]"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
           </div>

           <div className="flex items-center justify-end gap-2">
             <Button size="sm" className="gap-1" onClick={() => { setEditingItem(null); setItemFormOpen(true); }}>
               <Plus className="h-4 w-4" /> Add Media
             </Button>
           </div>

           {itemsLoading ? (
            <p className="py-8 text-sm text-muted-foreground">Loading media...</p>
          ) : filteredItems.length === 0 ? (
            <div className="glass rounded-xl p-12 text-center">
              <ImageIcon className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-semibold">No media items yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload photos, videos, YouTube links and Google Drive files.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map((m) => (
                <div
                  key={m.id}
                  className="glass flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background/40">
                    {m.type === "photo" && m.fileUrl ? (
                      <img src={m.fileUrl} alt={m.title} className="h-full w-full object-cover" loading="lazy" />
                    ) : m.thumbnailUrl ? (
                      <img src={m.thumbnailUrl} alt={m.title} className="h-full w-full object-cover" loading="lazy" />
                    ) : m.embedUrl ? (
                      <Play className="h-6 w-6 text-[hsl(var(--tsg-blue))]" />
                    ) : m.type === "drive" ? (
                      <FolderOpen className="h-6 w-6 text-[hsl(var(--tsg-blue))]" />
                    ) : (
                      <Film className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold" title={m.title}>{m.title}</p>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {TYPE_LABEL[m.type]}
                      </span>
                      {m.featured && <Star className="h-3.5 w-3.5 fill-[hsl(var(--tsg-blue))] text-[hsl(var(--tsg-blue))]" />}
                      {!m.isActive && (
                        <span className="rounded-full border border-[hsl(var(--tsg-red)/0.5)] bg-[hsl(var(--tsg-red)/0.1)] px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--tsg-red))]">
                          Hidden
                        </span>
                      )}
                      {m.albumId && (
                        <span className="flex items-center gap-1 rounded-full border border-border bg-background/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          <FolderOpen className="h-3 w-3" /> In album
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {m.category && <span>{m.category}</span>}
                      {m.team && <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {m.team.name}</span>}
                      {m.tournament && <span className="flex items-center gap-1"><Trophy className="h-3 w-3" /> {m.tournament.name}</span>}
                      {m.uploadDate && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(m.uploadDate)}</span>}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <Select
                      value={m.albumId ? String(m.albumId) : ""}
                      onValueChange={(v) => {
                        const target = v ? Number(v) : null;
                        moveItem.mutate({ id: m.id, albumId: target });
                      }}
                    >
                      <SelectTrigger className="h-8 w-40 text-xs">
                        <SelectValue placeholder="Move to album" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Standalone (no album)</SelectItem>
                        {albums.filter((a) => a.id !== m.albumId).map((a) => (
                          <SelectItem key={a.id} value={String(a.id)}>{a.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs"
                      onClick={() => {
                        setEditingItem(m);
                        setItemFormOpen(true);
                      }}
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <button className="rounded p-1 text-[hsl(var(--tsg-red))] hover:bg-[hsl(var(--tsg-red)/0.08)]" title="Delete item">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      }
                      title={`Delete "${m.title}"?`}
                      description="The uploaded file will be removed from storage. This cannot be undone."
                      onConfirm={() => delItem.mutate({ id: m.id })}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ===== Page Settings tab ===== */}
      {activeTab === "config" && (
        <ConfigPanel
          config={config ?? {}}
          onSaved={() => utils.media.getConfig.invalidate()}
        />
      )}

      {/* Album CRUD form */}
      <AlbumFormDialog
        open={albumFormOpen}
        onOpenChange={setAlbumFormOpen}
        editing={editingAlbum}
        teams={teamOptions}
        tournaments={tournamentOptions}
        onSaved={() => {
          utils.media.albumListAll.invalidate();
          utils.media.albumList.invalidate();
        }}
      />

      {/* Media item CRUD form */}
      <MediaFormDialog
        open={itemFormOpen}
        onOpenChange={setItemFormOpen}
        editing={editingItem}
        teams={teamOptions}
        tournaments={tournamentOptions}
        onSaved={() => {
          utils.media.listAll.invalidate();
          utils.media.albumGet.invalidate();
          utils.media.albumListAll.invalidate();
        }}
      />
    </AdminLayout>
  );
}
