import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Loader2, LogIn, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AuthShell } from "@/components/auth/auth-shell";
import { InfoNote, Pill } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/providers/auth-provider";
import { errorMessage, fieldErrors, unwrapAction } from "@/lib/actions";
import { queryKeys } from "@/lib/query-keys";
import { fetchAuthConfig, signInAsDemoAccount, signInWithPassword } from "@/server/api/auth";
import { pageHead } from "@/lib/seo";

const searchSchema = z.object({
  redirect: z.string().optional(),
  error: z.string().optional(),
});

const ERROR_MESSAGES: Record<string, string> = {
  google_not_configured:
    "Google sign-in is not configured on this deployment yet. Use an email sign-in or a demo account below.",
  google_missing_code: "Google did not return an authorisation code. Please try again.",
  google_invalid_state: "The sign-in link expired or was tampered with. Please start again.",
  google_state_mismatch: "We could not verify the sign-in request. Please try again.",
  google_exchange_failed: "Google sign-in failed while exchanging credentials. Please try again.",
  account_suspended: "This account is suspended. Contact support to appeal.",
  access_denied: "You cancelled the Google sign-in.",
};

export const Route = createFileRoute("/login")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () =>
    pageHead({
      title: "Sign in — Heal Connect",
      description:
        "Sign in to Heal Connect to raise a medical donation request, offer help as a donor, and track your matches.",
      path: "/login",
    }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect, error } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, refresh } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(
    error ? (ERROR_MESSAGES[error] ?? "Sign-in failed. Please try again.") : null,
  );
  const [fieldErrorState, setFieldErrorState] = useState<Record<string, string>>({});

  const { data: config } = useQuery({
    queryKey: queryKeys.authConfig,
    queryFn: () => fetchAuthConfig(),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (user) {
      void navigate({ to: redirect ?? (user.isAdmin ? "/admin" : "/dashboard"), replace: true });
    }
  }, [navigate, redirect, user]);

  const passwordLogin = useMutation({
    mutationFn: async () => unwrapAction(await signInWithPassword({ data: { email, password } })),
    onSuccess: async (data) => {
      await refresh();
      await queryClient.invalidateQueries();
      toast.success("Welcome back");
      void navigate({ to: redirect ?? data.redirectTo, replace: true });
    },
    onError: (mutationError) => {
      setFormError(errorMessage(mutationError));
      setFieldErrorState(fieldErrors(mutationError));
    },
  });

  const demoLogin = useMutation({
    mutationFn: async (demoEmail: string) =>
      unwrapAction(await signInAsDemoAccount({ data: { email: demoEmail } })),
    onSuccess: async (data) => {
      await refresh();
      await queryClient.invalidateQueries();
      toast.success("Signed in to a demo account", {
        description: "Explore freely — demo records are always marked with a Demo badge.",
      });
      void navigate({ to: data.redirectTo, replace: true });
    },
    onError: (mutationError) => setFormError(errorMessage(mutationError)),
  });

  const googleHref = `/api/auth/google/start?redirect=${encodeURIComponent(redirect ?? "/dashboard")}`;

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to raise a request, offer help, and follow every match in one place."
      footer={
        <>
          New to Heal Connect?{" "}
          <Link to="/register" className="font-semibold text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {formError ? (
        <div
          role="alert"
          className="mb-5 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{formError}</span>
        </div>
      ) : null}

      <div className="space-y-5">
        {config?.googleConfigured ? (
          <Button asChild size="lg" variant="outline" className="h-12 w-full bg-card">
            <a href={googleHref}>
              <GoogleIcon />
              Continue with Google
            </a>
          </Button>
        ) : (
          <InfoNote tone="info" title="Google sign-in is not configured here">
            Add <code className="rounded bg-background/60 px-1">GOOGLE_CLIENT_ID</code> and{" "}
            <code className="rounded bg-background/60 px-1">GOOGLE_CLIENT_SECRET</code> to enable
            it. Until then, use an email sign-in or one of the demo accounts below.
          </InfoNote>
        )}

        <div className="relative">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-background px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              or use email
            </span>
          </div>
        </div>

        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            setFormError(null);
            passwordLogin.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              aria-invalid={Boolean(fieldErrorState["email"])}
              aria-describedby={fieldErrorState["email"] ? "email-error" : undefined}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
            {fieldErrorState["email"] ? (
              <p id="email-error" className="text-xs font-medium text-destructive">
                {fieldErrorState["email"]}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={6}
              value={password}
              aria-invalid={Boolean(fieldErrorState["password"])}
              aria-describedby={fieldErrorState["password"] ? "password-error" : undefined}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />
            {fieldErrorState["password"] ? (
              <p id="password-error" className="text-xs font-medium text-destructive">
                {fieldErrorState["password"]}
              </p>
            ) : null}
          </div>

          <Button
            type="submit"
            size="lg"
            className="h-12 w-full"
            disabled={passwordLogin.isPending}
          >
            {passwordLogin.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <LogIn className="size-4" aria-hidden="true" />
            )}
            Sign in
          </Button>
        </form>

        {config?.demoLoginEnabled && config.demoAccounts.length > 0 ? (
          <section aria-labelledby="demo-heading" className="surface space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 id="demo-heading" className="font-display text-sm font-bold">
                Try a demo account
              </h2>
              <Pill tone="info">
                <Sparkles className="size-3" aria-hidden="true" /> Demo
              </Pill>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Populated accounts for evaluating the product. Passwords:{" "}
              <code className="rounded bg-muted px-1">{config.demoPassword}</code> for members,{" "}
              <code className="rounded bg-muted px-1">{config.demoAdminPassword}</code> for the
              admin.
            </p>
            <ul className="space-y-2">
              {config.demoAccounts.map((account) => (
                <li key={account.email}>
                  <button
                    type="button"
                    disabled={demoLogin.isPending}
                    onClick={() => demoLogin.mutate(account.email)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 text-left transition hover:border-primary/40 hover:bg-accent disabled:opacity-60"
                  >
                    <span>
                      <span className="block text-sm font-semibold">{account.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {account.description}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-bold text-primary">
                      {account.roleLabel}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <InfoNote tone="primary" icon={ShieldCheck} title="Your privacy is the default">
          We only store what you provide, we never ask for ID documents, and contact details stay
          hidden until a request is matched.
        </InfoNote>
      </div>
    </AuthShell>
  );
}

function GoogleIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.9-.1-1.5-.2-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.2 3.8l-.02.13 3.2 2.5.22.02c2.04-1.9 3.2-4.7 3.2-8.35Z"
      />
      <path
        fill="#34A853"
        d="M12 24c2.9 0 5.4-1 7.2-2.7l-3.4-2.6c-.9.6-2.2 1.1-3.8 1.1-2.9 0-5.4-1.9-6.3-4.6l-.12.01-3.3 2.6-.04.12C4.05 21.4 7.7 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.7 15.2A7.4 7.4 0 0 1 5.3 12c0-1.1.2-2.2.5-3.2l-.01-.13L2.44 6.02l-.1.05A12 12 0 0 0 0 12c0 1.9.5 3.7 1.3 5.3l4.4-2.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.7c2 0 3.4.9 4.2 1.6l3.1-3C17.4 1.5 14.9.4 12 .4 7.7.4 4.05 3 2.34 6.07L5.8 8.8C6.6 6.1 9.1 4.7 12 4.7Z"
      />
    </svg>
  );
}
