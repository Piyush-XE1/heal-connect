import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        /*
         * Sensible product defaults:
         * - 30s of freshness stops the "refetch on every navigation" storm that
         *   made pages feel like they were reloading as you moved around.
         * - A single retry keeps a flaky mobile connection from stalling for
         *   seconds before showing an error state.
         * - Background refetch on focus is opt-in per query (the notification
         *   bell asks for it explicitly).
         */
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    /*
     * Preload route code + loaders when a link is hovered or touched, and treat
     * that data as fresh for 30s. Previously every preload was immediately
     * stale (`defaultPreloadStaleTime: 0`), so the work was thrown away and
     * users waited again on the real navigation.
     */
    defaultPreload: "intent",
    defaultPreloadStaleTime: 30_000,
    defaultPendingMs: 200,
    defaultPendingMinMs: 300,
  });

  return router;
};
