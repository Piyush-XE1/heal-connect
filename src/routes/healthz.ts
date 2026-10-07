import { createFileRoute } from "@tanstack/react-router";

import { activeStore } from "@/server/db/store";

/**
 * Liveness/readiness probe for hosting and uptime checks.
 *
 * Deliberately shallow: it reports that the server rendered a response, which
 * driver backs the store and the schema version — never row counts, member data
 * or anything else that would widen the public surface. Server-rendered so the
 * check exercises the real process, not just the CDN.
 */
export const Route = createFileRoute("/healthz")({
  server: {
    handlers: {
      GET: async () => {
        const payload = {
          status: "ok",
          service: "heal-connect",
          store: activeStore(),
          time: new Date().toISOString(),
        };
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
