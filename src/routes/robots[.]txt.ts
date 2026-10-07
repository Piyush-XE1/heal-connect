import { createFileRoute } from "@tanstack/react-router";

import { absoluteUrl } from "@/lib/seo";

/**
 * Served from the app (not a static file) so the sitemap URL always matches the
 * canonical origin: the same `SITE_URL` drives both.
 */
const DISALLOW = [
  "/admin",
  "/dashboard",
  "/activity",
  "/settings",
  "/notifications",
  "/my-requests",
  "/profile",
  "/verify",
  "/requests/",
  "/onboarding",
  "/healthz",
  "/api/",
];

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () => {
        const lines = [
          "User-agent: *",
          "Allow: /",
          ...DISALLOW.map((path) => `Disallow: ${path}`),
          "",
          `Sitemap: ${absoluteUrl("/sitemap.xml")}`,
          "",
        ];
        return new Response(lines.join("\n"), {
          status: 200,
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
