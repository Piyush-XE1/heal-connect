import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { AuthProvider } from "../components/providers/auth-provider";
import { PwaProvider } from "../components/providers/pwa-provider";
import { Button } from "../components/ui/button";
import { Toaster } from "../components/ui/sonner";
import { fetchSession } from "@/server/api/auth";

function NotFoundComponent() {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-5">
      <div className="surface max-w-lg p-8 text-center">
        <p className="font-display text-6xl font-extrabold text-primary">404</p>
        <h1 className="mt-4 font-display text-2xl font-bold">We could not find that page</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The link may be broken, or the request you were looking for may have been cancelled or resolved.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link to="/">Go home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/find-help">Browse open requests</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();

  useEffect(() => {
    console.error("[heal-connect] route error", error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center bg-background px-5">
      <div className="surface max-w-lg p-8 text-center" role="alert">
        <h1 className="font-display text-2xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This screen failed to load. Your data is safe — you can retry, or head back home.
        </p>
        {import.meta.env.DEV ? (
          <pre className="mt-4 max-h-40 overflow-auto rounded-xl bg-muted p-3 text-left text-xs text-muted-foreground">
            {error instanceof Error ? error.message : String(error)}
          </pre>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => {
              void router.invalidate();
              reset();
            }}
          >
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Go home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=5",
      },
      { title: "Heal Connect — Give. Receive. Save lives." },
      {
        name: "description",
        content:
          "Heal Connect connects people willing to help with people who need legitimate medical donation assistance.",
      },
      { name: "theme-color", content: "#0E8C86" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Heal Connect" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "mobile-web-app-capable", content: "yes" },
      { property: "og:title", content: "Heal Connect — Give. Receive. Save lives." },
      {
        property: "og:description",
        content:
          "One platform to connect people willing to help with people who need legitimate medical donation assistance.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Heal Connect" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "format-detection",
        content: "telephone=no",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/icons/icon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png", sizes: "180x180" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;450;500;550;600;650;700&family=Manrope:wght@400;500;600;650;700;750;800&display=swap",
      },
    ],
  }),
  beforeLoad: async () => {
    // `getSessionUser` is server-only, so the session is read through the
    // `fetchSession` server function: it executes in-process during SSR and over
    // RPC during client-side navigations.
    try {
      const user = await fetchSession();
      return { user };
    } catch (error) {
      console.error("[heal-connect] session lookup failed", error);
      return { user: null };
    }
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { user } = Route.useRouteContext() as { user: Awaited<ReturnType<typeof fetchSession>> };

  return (
    <QueryClientProvider client={queryClient}>
      <PwaProvider>
        <AuthProvider initialUser={user ?? null}>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
          >
            Skip to content
          </a>
          <div id="main-content">
            <Outlet />
          </div>
          <Toaster position="top-center" richColors closeButton />
        </AuthProvider>
      </PwaProvider>
    </QueryClientProvider>
  );
}
