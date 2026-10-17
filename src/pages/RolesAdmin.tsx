import { useState } from "react";
import { Plus, Save, Trash2, Shield, ShieldOff } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserAvatar } from "@/components/UserAvatar";
import { PERMISSION_GROUPS, ADMIN_ONLY_PERMISSIONS } from "@contracts/constants";
import type { Permission } from "@contracts/constants";

const ALL_ASSIGNABLE_PERMISSIONS: Permission[] = [];
for (const group of PERMISSION_GROUPS) {
  if (group.category === "Admin-Only") continue;
  for (const p of group.permissions) {
    ALL_ASSIGNABLE_PERMISSIONS.push(p.key);
  }
}

type RoleRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  isBuiltIn: boolean;
  createdAt: Date;
  updatedAt: Date;
  userCount: number;
  permissions: string[];
};

export default function RolesAdmin() {
  const utilsRoles = trpc.useContext();
  const { data: roles, isLoading, error } = trpc.admin.listRoles.useQuery();

  const [editingRole, setEditingRole] = useState<RoleRow | null>(null);
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPermissions, setFormPermissions] = useState<Set<string>>(new Set());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewingRole, setViewingRole] = useState<RoleRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoleRow | null>(null);

  const upsertRole = trpc.admin.upsertRole.useMutation({
    onSuccess: () => {
      void utilsRoles.admin.listRoles.invalidate();
      setIsDialogOpen(false);
      toast.success(editingRole ? "Role updated" : "Role created");
    },
    onError: (e) => {
      toast.error(e.message);
    },
  });

  const toggleActive = trpc.admin.toggleRoleActive.useMutation({
    onSuccess: () => {
      void utilsRoles.admin.listRoles.invalidate();
    },
  });

  const deleteRole = trpc.admin.deleteRole.useMutation({
    onSuccess: () => {
      void utilsRoles.admin.listRoles.invalidate();
      toast.success("Role deleted");
    },
  });

  if (isLoading) {
    return (
      <AdminLayout title="Roles">
        <p className="text-muted-foreground">Loading roles...</p>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout title="Roles">
        <p className="text-destructive">Error loading roles: {error.message}</p>
      </AdminLayout>
    );
  }

  const handleEdit = (role: RoleRow | null) => {
    if (role) {
      setEditingRole(role);
      setFormName(role.name);
      setFormSlug(role.slug);
      setFormDescription(role.description ?? "");
      setFormPermissions(new Set(role.permissions));
    } else {
      setEditingRole(null);
      setFormName("");
      setFormSlug("");
      setFormDescription("");
      setFormPermissions(new Set());
    }
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!formName.trim() || !formSlug.trim()) {
      toast.error("Name and slug are required");
      return;
    }
    void upsertRole.mutate({
      id: editingRole?.id,
      name: formName.trim(),
      slug: formSlug.trim(),
      description: formDescription.trim() || undefined,
      isActive: editingRole?.isActive ?? true,
      permissions: Array.from(formPermissions),
    });
  };

  const handleDelete = (role: RoleRow) => {
    setDeleteTarget(role);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    void deleteRole.mutate(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          setDeleteTarget(null);
        },
        onError: () => {
          setDeleteTarget(null);
        },
      },
    );
  };

  const handleToggle = (role: RoleRow) => {
    if (role.isBuiltIn) return;
    void toggleActive.mutate({ id: role.id, isActive: !role.isActive });
  };

  const handlePermissionChange = (perm: string, checked: boolean) => {
    const next = new Set(formPermissions);
    if (checked) {
      next.add(perm);
    } else {
      next.delete(perm);
    }
    setFormPermissions(next);
  };

  return (
    <AdminLayout title="Roles">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Roles & Permissions</h1>
            <p className="text-sm text-muted-foreground">
              Built-in roles cannot be modified. Custom roles can be created with non-admin-only permissions.
            </p>
          </div>
          <Button onClick={() => handleEdit(null)}>
            <Plus className="mr-2 h-4 w-4" />
            New Role
          </Button>
        </div>

        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Admin-only permissions ({ADMIN_ONLY_PERMISSIONS.length}) are reserved for the built-in Administrator role and cannot be assigned to custom roles.
          </AlertDescription>
        </Alert>

        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left">Role</th>
                <th className="px-4 py-2 text-left">Slug</th>
                <th className="px-4 py-2 text-left">Permissions</th>
                <th className="px-4 py-2 text-center">Users</th>
                <th className="px-4 py-2 text-center">Status</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles?.map((r) => {
                const row: RoleRow = r;
                const isBuiltIn = row.isBuiltIn;
                return (
                  <tr key={row.id} className="border-b">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{row.name}</span>
                        {isBuiltIn && <Badge variant="secondary">Built-in</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{row.slug}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {row.permissions.slice(0, 4).map((p) => (
                          <Badge key={p} variant="outline" className="text-xs">
                            {p}
                          </Badge>
                        ))}
                        {row.permissions.length > 4 && (
                          <Badge variant="outline" className="text-xs">
                            +{row.permissions.length - 4} more
                          </Badge>
                        )}
                        {row.permissions.length === 0 && (
                          <span className="text-xs text-muted-foreground">No extra permissions</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center">
                      {row.userCount > 0 ? (
                        <button
                          onClick={() => setViewingRole(row)}
                          className="text-xs font-medium text-[hsl(var(--tsg-blue))] hover:underline"
                        >
                          {row.userCount} user{row.userCount !== 1 ? "s" : ""}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">0 users</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggle(row)}
                        disabled={isBuiltIn}
                      >
                        {row.isActive ? (
                          <Shield className="h-4 w-4 text-green-500" />
                        ) : (
                          <ShieldOff className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {!isBuiltIn && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(row)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(row)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
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
      </div>

      {/* Role Editor Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w3xl">
          <DialogHeader>
            <DialogTitle>{editingRole ? "Edit Role" : "New Role"}</DialogTitle>
            <DialogDescription>
              {editingRole ? "Update this role's details and permissions." : "Create a new custom role with granular permissions."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="role-name">Name</Label>
              <Input
                id="role-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Content Manager"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role-slug">Slug</Label>
              <Input
                id="role-slug"
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                placeholder="e.g. content-manager"
              />
              {editingRole ? null : (
                <p className="text-xs text-muted-foreground">
                  Cannot use built-in role names (admin, moderator, player, fan).
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role-description">Description</Label>
              <Textarea
                id="role-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="What can users with this role do?"
                rows={3}
              />
            </div>

            <div>
              <Label className="mb-2 block">Permissions</Label>
              <div className="space-y-3 max-h-72 overflow-y-auto border rounded p-3">
                {PERMISSION_GROUPS.map((group) => {
                  if (group.category === "Admin-Only") return null;
                  return (
                    <div key={group.category}>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {group.category}
                      </p>
                      <div className="mt-1 space-y-1">
                        {group.permissions.map((p) => (
                          <label
                            key={p.key}
                            className="flex items-start gap-2 cursor-pointer"
                          >
                            <Checkbox
                              checked={formPermissions.has(p.key)}
                              onCheckedChange={(checked) =>
                                handlePermissionChange(p.key, checked === true)
                              }
                            />
                            <div className="flex flex-col">
                              <span className="text-sm">{p.label}</span>
                              <span className="text-xs text-muted-foreground">
                                {p.description}
                              </span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

           <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={upsertRole.isPending}>
              <Save className="mr-2 h-4 w-4" />
              Save Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {viewingRole && (
        <AssignedUsersDialog
          role={viewingRole}
          open={!!viewingRole}
          onClose={() => setViewingRole(null)}
        />
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[hsl(var(--tsg-red))]">
              <Trash2 className="h-5 w-5" />
              Delete Role
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm">
              Are you sure you want to delete the role{" "}
              <strong>{deleteTarget?.name}</strong> (
              <span className="font-mono">{deleteTarget?.slug}</span>)?
            </p>
            {(deleteTarget?.userCount ?? 0) > 0 && (
              <Alert className="mt-3">
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  {deleteTarget?.userCount} user{deleteTarget?.userCount !== 1 ? "s" : ""} currently
                  have this role. They will be reassigned to the built-in{" "}
                  <strong>fan</strong> role.
                </AlertDescription>
              </Alert>
            )}
            {deleteTarget?.userCount === 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                No users are currently assigned to this role.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteRole.isPending}
            >
              {deleteRole.isPending ? "Deleting..." : "Delete Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

function AssignedUsersDialog({
  role,
  open,
  onClose,
}: {
  role: RoleRow;
  open: boolean;
  onClose: () => void;
}) {
  const { data: users, isLoading } = trpc.admin.roleUsers.useQuery(
    { roleSlug: role.slug },
    { enabled: open },
  );

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assigned Users — {role.name}</DialogTitle>
          <DialogDescription>
            {role.userCount} user{role.userCount !== 1 ? "s" : ""} have the <b>{role.slug}</b> role.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          {isLoading && <p className="text-sm text-muted-foreground">Loading users...</p>}
          {!isLoading && users && users.length === 0 && (
            <p className="text-sm text-muted-foreground">No users with this role.</p>
          )}
          {!isLoading && users && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {users.map((u) => (
                 <div key={u.id} className="flex items-center gap-3 rounded-md border p-3">
                   <UserAvatar src={u.avatarUrl} name={u.name} username={u.username ?? undefined} className="h-8 w-8" />
                  <div className="flex-1">
                    <span className="font-medium">{u.name ?? u.username ?? "Unknown"}</span>
                    {u.email && <span className="text-xs text-muted-foreground"> — {u.email}</span>}
                    {u.banned && <Badge variant="destructive" className="ml-2 text-xs">Banned</Badge>}
                  </div>
                </div>
              ))}
            </div>
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
