import { useState } from "react";
import { Search, Filter, Play, Eye, ThumbsUp, Globe, Lock, Shield, ExternalLink, Youtube, FileVideo } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import type { RouterOutputs } from "@contracts/types";

type HighlightRow = RouterOutputs["admin"]["listHighlights"][number];

export default function HighlightsAdmin() {
  const utils = trpc.useContext();

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "hidden">("all");
  const [editing, setEditing] = useState<HighlightRow | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const { data: rawHighlights, isLoading, error } = trpc.admin.listHighlights.useQuery(undefined);

  const highlights = rawHighlights ?? [];
  const filtered = highlights.filter((h) => {
    const matchesSearch =
      !search ||
      h.title?.toLowerCase().includes(search.toLowerCase()) ||
      h.player?.ign?.toLowerCase().includes(search.toLowerCase());
    if (activeFilter === "active") return matchesSearch && h.isActive;
    if (activeFilter === "hidden") return matchesSearch && !h.isActive;
    return matchesSearch;
  });

  const featureMut = trpc.admin.featureHighlight.useMutation({
    onSuccess: () => {
      void utils.admin.listHighlights.invalidate();
      toast.success("Highlight status updated.");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.admin.updateHighlight.useMutation({
    onSuccess: () => {
      void utils.admin.listHighlights.invalidate();
      setEditing(null);
      toast.success("Highlight updated.");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.admin.deleteHighlight.useMutation({
    onSuccess: () => {
      void utils.admin.listHighlights.invalidate();
      toast.success("Highlight deleted.");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleFeature = (h: HighlightRow, featured: boolean) => {
    void featureMut.mutate({ id: h.id, isFeatured: featured });
  };

  const handleEdit = (h: HighlightRow) => {
    setEditing(h);
    setEditTitle(h.title);
    setEditDesc(h.description ?? "");
  };

  const handleSave = () => {
    if (!editing) return;
    void updateMut.mutate({
      id: editing.id,
      title: editTitle.trim(),
      description: editDesc.trim() || undefined,
    });
  };

  const handleDelete = (h: HighlightRow) => {
    if (!confirm(`Delete highlight "${h.title}"? This cannot be undone.`)) return;
    void deleteMut.mutate({ id: h.id });
  };

  if (isLoading) {
    return (
      <AdminLayout title="Highlights">
        <p className="text-muted-foreground">Loading highlights...</p>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout title="Highlights">
        <p className="text-destructive">Error loading highlights: {error.message}</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Player Highlights">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Player Highlights</h1>
            <p className="text-sm text-muted-foreground">
              Manage all player highlight submissions. Feature to make visible, hide to remove from public view.
            </p>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title or player..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
            <Select value={activeFilter} onValueChange={(v: string) => setActiveFilter(v as "all" | "active" | "hidden")}>
              <SelectTrigger className="w-40">
                <Filter className="h-4 w-4 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Visible</SelectItem>
                <SelectItem value="hidden">Hidden</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left">Preview</th>
                <th className="px-4 py-2 text-left">Title</th>
                <th className="px-4 py-2 text-left">Player</th>
                <th className="px-4 py-2 text-left">Uploader</th>
                <th className="px-4 py-2 text-center">Views / Likes</th>
                <th className="px-4 py-2 text-center">Status</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-muted-foreground">
                    No highlights found.
                  </td>
                </tr>
              )}
              {filtered.map((h) => (
                <tr key={h.id} className="border-b last:border-0">
                  <td className="p-2">
                    <div className="flex h-16 w-24 items-center justify-center rounded bg-muted/50">
                      {h.embedUrl ? (
                        <iframe
                          src={h.embedUrl}
                          className="h-full w-full rounded"
                          title={h.title}
                        />
                      ) : h.thumbnailUrl ? (
                        <img
                          src={h.thumbnailUrl}
                          alt={h.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Play className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div>
                      <span className="font-medium">{h.title}</span>
                      <div className="flex items-center gap-1 mt-1">
                        {h.videoType === "youtube" ? (
                          <Badge variant="outline" className="text-xs">
                            <Youtube className="h-3 w-3 mr-1" /> YouTube
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            <FileVideo className="h-3 w-3 mr-1" /> Upload
                          </Badge>
                        )}
                        {h.watchUrl && (
                          <a
                            href={h.watchUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[hsl(var(--tsg-blue))] hover:underline"
                          >
                            <ExternalLink className="h-3 w-3 inline" />
                          </a>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    {h.player?.ign ? (
                      <a
                        href={`/players/${h.player.slug}`}
                        className="font-medium text-[hsl(var(--tsg-blue))] hover:underline"
                      >
                        {h.player.ign}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">Unknown</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {h.user ? (
                      <span className="flex items-center gap-1.5">
                        <Shield className="h-3 w-3 text-muted-foreground" />
                        {h.user.name || h.user.username}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Unknown</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className="flex items-center justify-center gap-1 text-xs">
                      <Eye className="h-3 w-3" /> {h.views ?? 0}
                    </span>
                    <span className="flex items-center justify-center gap-1 text-xs">
                      <ThumbsUp className="h-3 w-3" /> {h.likes ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    {h.isActive ? (
                      <Badge variant="secondary" className="text-xs">
                        <Globe className="h-3 w-3 mr-1" /> Public
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        <Lock className="h-3 w-3 mr-1" /> Hidden
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      {h.isActive ? (
                        <Button
                          size="sm"
                          variant="outline"
                          title="Hide from public"
                          onClick={() => handleFeature(h, false)}
                        >
                          <Lock className="h-3 w-3" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          title="Make public"
                          onClick={() => handleFeature(h, true)}
                        >
                          <Globe className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        title="Edit"
                        onClick={() => handleEdit(h)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        title="Delete"
                        onClick={() => handleDelete(h)}
                        className="text-destructive"
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Highlight</DialogTitle>
            <DialogDescription>
              Update the title and description for this highlight.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Title"
            />
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="Description"
              rows={3}
              className="w-full rounded-md border border-input px-3 py-2 text-sm"
              maxLength={2000}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={updateMut.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
