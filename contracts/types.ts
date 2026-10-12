import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../api/router";

export type * from "../db/schema";
export * from "./errors";

/** Inference helpers for tRPC procedure outputs (type-only, erased at build). */
export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;
