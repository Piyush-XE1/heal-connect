import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { Loader2, LockKeyhole } from "lucide-react";
import { useEffect } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/components/providers/auth-provider";

/**
 * Authenticated layout. Every child route inherits the app shell (desktop nav,
 * mobile bottom bar, notifications) and the sign-in guard.
 */
export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      void navigate({
        to: "/login",
        search: { redirect: location.href },
        replace: true,
      });
    }
  }, [isLoading, location.href, navigate, user]);

  if (!user) {
    return (
      <div className="grid min-h-screen place-items-center px-5">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" aria-hidden="true" />
            <p className="text-sm">Checking your session…</p>
          </div>
        ) : (
          <EmptyState
            icon={LockKeyhole}
            title="Please sign in to continue"
            description="This area is only available to signed-in members. Signing in takes a moment."
            action={
              <>
                <Button asChild>
                  <Link to="/login" search={{ redirect: location.href }}>
                    Sign in
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/">Back to home</Link>
                </Button>
              </>
            }
          />
        )}
      </div>
    );
  }

  return (
    <AppShell showFooter>
      <Outlet />
    </AppShell>
  );
}
