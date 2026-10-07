// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  /**
   * Pre-compress and serve `.gz`/`.br` variants of the built assets. The
   * Lovable config's `nitro` type only declares the keys it needs, so the
   * option is passed through with a narrow cast.
   */
  nitro: {
    compressPublicAssets: { gzip: true, brotli: true },
  } as never,
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    importProtection: {
      // The Lovable defaults deny every client import that resolves inside `src/server/**`.
      // Server functions are the supported RPC boundary, and the Start plugin replaces their
      // module body with a client stub, so the declaration modules in `src/server/api/**` are
      // excluded here. Their own imports of server internals are ignored for the same reason:
      // the split transform removes those statements from the client bundle. Everything else
      // under `src/server/**` (db, auth, services) stays server-only — importing it from
      // client code is still a build error.
      client: {
        excludeFiles: ["**/server/api/**"],
      },
      ignoreImporters: ["**/server/api/**"],
    },
  },
  vite: {
    server: {
      // The hosted preview (and any reverse proxy) reaches the dev server through a
      // proxied hostname, so host checking must not reject it.
      allowedHosts: true,
    },
    preview: {
      allowedHosts: true,
    },
  },
});
