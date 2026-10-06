import { getRouteApi } from "@tanstack/react-router";

import type { SessionUser } from "@/lib/domain";

const rootApi = getRouteApi("__root__");

/**
 * Reads the session resolved during SSR in the root route.
 * The client-side `AuthProvider` keeps this in sync after sign-in/out.
 */
export function useSessionUser(): SessionUser | null {
  const context = rootApi.useRouteContext() as { user?: SessionUser | null };
  return context.user ?? null;
}
