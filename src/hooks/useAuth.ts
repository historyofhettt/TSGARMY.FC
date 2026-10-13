import { trpc } from "@/providers/trpc";
import { useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { LOGIN_PATH } from "@/const";
import { hasAtLeastRole, hasRole } from "@contracts/constants";
import type { Role } from "@contracts/constants";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = LOGIN_PATH } =
    options ?? {};

  const navigate = useNavigate();

  const utils = trpc.useUtils();

  const {
    data: user,
    isLoading,
    error,
    refetch,
  } = trpc.auth.me.useQuery(undefined, {
    staleTime: 0,
    retry: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      navigate(redirectPath);
    },
  });

  const logout = useCallback(() => logoutMutation.mutate(), [logoutMutation]);

  useEffect(() => {
    if (redirectOnUnauthenticated && !isLoading && !user) {
      const currentPath = window.location.pathname;
      if (currentPath !== redirectPath) {
        navigate(redirectPath);
      }
    }
  }, [redirectOnUnauthenticated, isLoading, user, navigate, redirectPath]);

  return useMemo(() => {
    const role = user?.role ?? null;
    return {
      user: user ?? null,
      isAuthenticated: !!user,
      isLoading: isLoading || logoutMutation.isPending,
      error,
      logout,
      refresh: refetch,
      xp: user?.xp ?? 0,
      // Role helpers — conveniences for UI only. All enforcement is
      // server-side; never rely on these to hide privileged actions from
      // a determined client.
      role,
      hasRole: (...allowed: Role[]) => hasRole(role, ...allowed),
      hasAtLeastRole: (min: Role) => hasAtLeastRole(role, min),
      isAdmin: hasAtLeastRole(role, "admin"),
      isModerator: hasAtLeastRole(role, "moderator"),
    };
  }, [user, isLoading, logoutMutation.isPending, error, logout, refetch]);
}
