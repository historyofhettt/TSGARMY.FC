import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";
import type { ReactNode } from "react";

export const trpc = createTRPCReact<AppRouter>();

// tRPC error codes that represent expected client-side failures.
// These should NOT be logged to console — they are handled in the UI via toasts.
const EXPECTED_ERROR_CODES = new Set([
  "BAD_REQUEST",
  "NOT_FOUND",
  "CONFLICT",
  "FORBIDDEN",
  "UNAUTHORIZED",
]);

function isExpectedError(error: unknown): boolean {
  if (error instanceof TRPCClientError) {
    return EXPECTED_ERROR_CODES.has(error.data?.code);
  }
  const anyErr = error as { data?: { code?: string } } | undefined;
  if (anyErr?.data?.code) {
    return EXPECTED_ERROR_CODES.has(anyErr.data.code);
  }
  return false;
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    // React Query v5 logs all query errors to console.error by default.
    // We suppress the automatic log for expected errors (validation, not-found,
    // forbidden, etc.) which are shown to users via toast notifications.
    // Unexpected errors are still logged for debugging.
    onError: (error) => {
      if (!isExpectedError(error)) {
        console.error("[Unexpected Query Error]", error);
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      if (!isExpectedError(error)) {
        console.error("[Unexpected Mutation Error]", error);
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 60_000,
    },
  },
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

export function TRPCProvider({ children }: { children: ReactNode }) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
