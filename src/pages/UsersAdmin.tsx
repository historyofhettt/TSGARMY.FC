import { Ban, ShieldCheck, Trophy, Plus, Minus, Search, ExternalLink, Trash2, Instagram } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { trpc } from "@/providers/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../api/router";

type User = inferRouterOutputs<AppRouter>["admin"]["listUsers"][number];
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/UserAvatar";
import { allRoles } from "@contracts/constants";
import type { Role } from "@contracts/constants";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useState } from "react";

const ROLE_STYLES: Record<Role, string> = {
  admin: "border-[hsl(var(--tsg-red)/0.5)] text-[hsl(var(--tsg-red))]",
  moderator:
    "border-[hsl(var(--tsg-blue)/0.5)] text-[hsl(var(--tsg-blue))]",
  player:
    "border-emerald-500/50 text-emerald-400",
  fan: "border-border text-muted-foreground",
};

export default function UsersAdmin() {
  const utils = trpc.useUtils();
  const { user: me } = useAuth();
  const [search, setSearch] = useState("");
  const { data: list, isLoading } = trpc.admin.listUsers.useQuery({ q: search || undefined });
  const { data: availableRoles } = trpc.admin.availableRoles.useQuery();
  const setBanned = trpc.admin.setUserBanned.useMutation({
    onSuccess: () => {
      toast.success("User updated.");
      utils.admin.listUsers.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const setUserRole = trpc.admin.setUserRole.useMutation({
    onSuccess: () => {
      toast.success("Role updated.");
      utils.admin.listUsers.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const [editDialogOpen, setEditDialogOpen] = useState<User | null>(null);
  const [editInstagram, setEditInstagram] = useState("");
  const updateUserInstagram = trpc.admin.updateUserInstagram.useMutation({
    onSuccess: () => {
      toast.success("Instagram updated.");
      utils.admin.listUsers.invalidate();
      setEditDialogOpen(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const openEditDialog = (user: User) => {
    setEditDialogOpen(user);
    setEditInstagram(user.instagram ?? "");
  };
  const saveEditInstagram = () => {
    updateUserInstagram.mutate({ id: editDialogOpen!.id, instagram: editInstagram || null });
  };

  const deleteUser = trpc.admin.deleteUser.useMutation({
    onSuccess: () => {
      toast.success("User deleted.");
      utils.admin.listUsers.invalidate();
      setDeleteDialogOpen(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState<User | null>(null);

  const [xpDialogOpen, setXpDialogOpen] = useState<{ user: User } | null>(null);
  const adjustXp = trpc.admin.adjustUserXp.useMutation({
    onSuccess: (data) => {
      toast.success(`XP updated: ${data.previousXp} → ${data.newXp} (${data.amount > 0 ? "+" : ""}${data.amount})`);
      utils.admin.listUsers.invalidate();
      setXpDialogOpen(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const openXpDialog = (user: User) => {
    setXpDialogOpen({ user });
    setXpAmount(50);
    setXpReason("");
    setXpAction("add");
  };
  const closeXpDialog = () => setXpDialogOpen(null);
  const [xpAmount, setXpAmount] = useState(50);
  const [xpReason, setXpReason] = useState("");
  const [xpAction, setXpAction] = useState<"add" | "remove">("add");

  return (
    <AdminLayout title="Users">
      {isLoading ? (
        <p className="text-muted-foreground">Loading users...</p>
      ) : (
        <>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by username or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 pl-9 max-w-sm"
              />
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="p-3">User</th>
                <th className="p-3">Role</th>
                <th className="p-3">Permissions</th>
                <th className="p-3">XP</th>
                <th className="p-3">Joined</th>
                <th className="p-3">Last Sign-in</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(list ?? []).map((u) => {
                const isSelf = u.id === me?.id;
                return (
                  <tr key={u.id} className="border-b border-border/50 last:border-0">
                    <td className="p-3">
                      <span className="flex items-center gap-2.5 font-semibold">
                        <UserAvatar src={u.avatarUrl} name={u.name} username={u.username ?? undefined} />
                        {u.username ?? u.name ?? "User"}
                        {isSelf && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            (you)
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="p-3">
                      {isSelf ? (
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-xs font-semibold uppercase",
                            ROLE_STYLES[u.role as Role] ?? "border-border text-muted-foreground",
                          )}
                        >
                          {u.role}
                        </span>
                      ) : (
                        <Select
                          value={u.role}
                          onValueChange={(role) => setUserRole.mutate({ id: u.id, role })}
                        >
                          <SelectTrigger className="h-8 w-32 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {availableRoles?.map((role) => (
                              <SelectItem key={role.slug} value={role.slug} className="text-xs">
                                {role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      </td>
                      <td className="p-3">
                        {u.roleInfo ? (
                          <div className="flex flex-wrap gap-1">
                            {u.roleInfo.permissions.slice(0, 3).map((p: string) => (
                              <Badge key={p} variant="secondary" className="text-xs">
                                {p}
                              </Badge>
                            ))}
                            {u.roleInfo.permissions.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{u.roleInfo.permissions.length - 3}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {allRoles.includes(u.role as Role)
                              ? "Built-in role"
                              : "No custom permissions"}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-xs">
                        <span className="flex items-center gap-1">
                          <Trophy className="h-3 w-3 text-[hsl(var(--tsg-blue))]" />
                        {(u.xp ?? 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">{formatDate(u.createdAt)}</td>
                    <td className="p-3 text-muted-foreground">{formatDate(u.lastSignInAt)}</td>
                    <td className="p-3">
                      {u.banned ? (
                        <span className="text-xs font-bold uppercase text-[hsl(var(--tsg-red))]">Banned</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Active</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {!isSelf && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs"
                            onClick={() => setBanned.mutate({ id: u.id, banned: !u.banned })}
                          >
                            {u.banned ? <ShieldCheck className="h-3 w-3" /> : <Ban className="h-3 w-3 text-[hsl(var(--tsg-red))]" />}
                            {u.banned ? "Unban" : "Ban"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs ml-1"
                            onClick={() => openXpDialog(u)}
                          >
                            <Trophy className="h-3 w-3 text-[hsl(var(--tsg-blue))]" />
                            XP
                          </Button>
                          {u.username && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-xs ml-1"
                              onClick={() => window.open(`/fans/${u.username}`, "_blank")}
                            >
                              <ExternalLink className="h-3 w-3" />
                              Profile
                            </Button>
                          )}
                           <Button
                             size="sm"
                             variant="outline"
                             className="gap-1 text-xs ml-1"
                             onClick={() => openEditDialog(u)}
                           >
                             <Instagram className="h-3 w-3" />
                             Edit
                           </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-xs ml-1 text-[hsl(var(--tsg-red))] hover:bg-[hsl(var(--tsg-red)/0.1)]"
                              onClick={() => setDeleteDialogOpen(u)}
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </Button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
           </table>
          </div>
        </>
      )}

      <Dialog open={!!xpDialogOpen} onOpenChange={(open) => !open && closeXpDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust XP for {xpDialogOpen?.user?.username ?? xpDialogOpen?.user?.name ?? "User"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Action</Label>
              <RadioGroup value={xpAction} onValueChange={(v) => {
                  setXpAction(v as "add" | "remove");
                  setXpAmount((prev) => (v === "add" ? Math.abs(prev) : -Math.abs(prev)));
                }}>
                <div className="flex items-center space-x-4">
                  <RadioGroupItem value="add" className="flex items-center space-x-2">
                    <Plus className="h-4 w-4" />
                    <span>Add XP</span>
                  </RadioGroupItem>
                  <RadioGroupItem value="remove" className="flex items-center space-x-2">
                    <Minus className="h-4 w-4" />
                    <span>Remove XP</span>
                  </RadioGroupItem>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label>XP Amount</Label>
              <Input
                type="number"
                min="1"
                value={Math.abs(xpAmount)}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setXpAmount(xpAmount < 0 ? -val : val);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Input placeholder="e.g., Tournament win, rule violation" maxLength={255} value={xpReason} onChange={(e) => setXpReason(e.target.value)} />
            </div>
            <div className="text-xs text-muted-foreground">
              Current XP: <strong>{(xpDialogOpen?.user?.xp ?? 0).toLocaleString()}</strong> → <strong>{Math.max(0, (xpDialogOpen?.user?.xp ?? 0) + xpAmount).toLocaleString()}</strong>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeXpDialog} disabled={adjustXp.isPending}>
              Cancel
            </Button>
            <Button onClick={() => adjustXp.mutate({ userId: xpDialogOpen!.user.id, amount: xpAmount, reason: xpReason || null })} disabled={adjustXp.isPending || xpAmount === 0}>
              {adjustXp.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
       </Dialog>

      <Dialog open={!!editDialogOpen} onOpenChange={(open) => !open && setEditDialogOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User: {editDialogOpen?.username ?? editDialogOpen?.name ?? "User"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-instagram">Instagram</Label>
              <Input
                id="edit-instagram"
                type="text"
                placeholder="e.g. username (leave blank to clear)"
                maxLength={512}
                value={editInstagram}
                onChange={(e) => setEditInstagram(e.target.value)}
                disabled={updateUserInstagram.isPending}
              />
              <p className="text-xs text-muted-foreground">
                {editInstagram
                  ? `instagram.com/${editInstagram}`
                  : "No Instagram set — enter a username to add one."}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(null)} disabled={updateUserInstagram.isPending}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={saveEditInstagram}
              disabled={updateUserInstagram.isPending}
            >
              {updateUserInstagram.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteDialogOpen} onOpenChange={(open) => !open && setDeleteDialogOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[hsl(var(--tsg-red))]">
              <Trash2 className="h-5 w-5" />
              Delete User
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm">
              Are you sure you want to delete <strong>{deleteDialogOpen?.name ?? deleteDialogOpen?.username ?? "this user"}</strong>?
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              This action cannot be undone. All user-owned data (cards, achievements, XP history, comments, etc.) will be permanently removed.
            </p>
            {deleteDialogOpen?.role === "admin" && (
              <p className="mt-2 text-xs text-[hsl(var(--tsg-red))]">
                Warning: This user is an admin. The last remaining admin cannot be deleted.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteDialogOpen(null)} disabled={deleteUser.isPending}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => deleteUser.mutate({ id: deleteDialogOpen!.id })}
              disabled={deleteUser.isPending}
            >
              {deleteUser.isPending ? "Deleting..." : "Delete User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
