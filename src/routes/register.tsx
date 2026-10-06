import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Loader2, ShieldCheck, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AuthShell } from "@/components/auth/auth-shell";
import { InfoNote } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/providers/auth-provider";
import { errorMessage, fieldErrors, unwrapAction } from "@/lib/actions";
import { queryKeys } from "@/lib/query-keys";
import { fetchAuthConfig, signUpWithPassword } from "@/server/api/auth";
import { pageHead } from "@/lib/seo";

const searchSchema = z.object({
  redirect: z.string().optional(),
  error: z.string().optional(),
});

export const Route = createFileRoute("/register")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () =>
    pageHead({
      title: "Create your account — Heal Connect",
      description:
        "Join Heal Connect as a donor, a recipient or both. Free, privacy-first, and moderated for safety.",
      path: "/register",
    }),
  component: RegisterPage,
});

const ERROR_MESSAGES: Record<string, string> = {
  google_not_configured:
    "Google sign-in is not configured on this deployment yet. Create an account with your email below.",
  account_suspended: "This account is suspended. Contact support to appeal.",
};

function RegisterPage() {
  const { redirect, error } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, refresh } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [formError, setFormError] = useState<string | null>(
    error ? (ERROR_MESSAGES[error] ?? null) : null,
  );
  const [fieldErrorState, setFieldErrorState] = useState<Record<string, string>>({});

  const { data: config } = useQuery({
    queryKey: queryKeys.authConfig,
    queryFn: () => fetchAuthConfig(),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (user) {
      void navigate({ to: redirect ?? "/dashboard", replace: true });
    }
  }, [navigate, redirect, user]);

  const signUp = useMutation({
    mutationFn: async () =>
      unwrapAction(await signUpWithPassword({ data: { name, email, password } })),
    onSuccess: async (data) => {
      await refresh();
      await queryClient.invalidateQueries();
      toast.success("Account created", { description: "Next: choose how you want to take part." });
      void navigate({
        to: "/onboarding",
        search: redirect ? { redirect } : {},
        replace: true,
        ...(data ? {} : {}),
      });
    },
    onError: (mutationError) => {
      setFormError(errorMessage(mutationError));
      setFieldErrorState(fieldErrors(mutationError));
    },
  });

  const googleHref = `/api/auth/google/start?redirect=${encodeURIComponent(redirect ?? "/dashboard")}`;

  return (
    <AuthShell
      title="Create your Heal Connect account"
      subtitle="It takes less than a minute. You choose your role next, and you can change it any time."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Sign in
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
            <a href={googleHref}>Continue with Google</a>
          </Button>
        ) : null}

        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            setFormError(null);
            if (!accepted) {
              setFormError("Please accept the terms and privacy policy to continue.");
              return;
            }
            signUp.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              autoComplete="name"
              required
              value={name}
              aria-invalid={Boolean(fieldErrorState["name"])}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
            />
            {fieldErrorState["name"] ? (
              <p className="text-xs font-medium text-destructive">{fieldErrorState["name"]}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              aria-invalid={Boolean(fieldErrorState["email"])}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
            {fieldErrorState["email"] ? (
              <p className="text-xs font-medium text-destructive">{fieldErrorState["email"]}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              aria-invalid={Boolean(fieldErrorState["password"])}
              aria-describedby="password-hint"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
            />
            <p id="password-hint" className="text-xs text-muted-foreground">
              Use at least 8 characters. A passphrase of a few words works well.
            </p>
            {fieldErrorState["password"] ? (
              <p className="text-xs font-medium text-destructive">{fieldErrorState["password"]}</p>
            ) : null}
          </div>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-4 rounded border-input accent-primary"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
            />
            <span className="text-muted-foreground">
              I agree to the{" "}
              <Link to="/terms" className="font-semibold text-primary hover:underline">
                Terms &amp; Conditions
              </Link>{" "}
              and{" "}
              <Link to="/privacy" className="font-semibold text-primary hover:underline">
                Privacy Policy
              </Link>
              , and I understand that Heal Connect does not provide medical care or emergency
              services.
            </span>
          </label>

          <Button type="submit" size="lg" className="h-12 w-full" disabled={signUp.isPending}>
            {signUp.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <UserPlus className="size-4" aria-hidden="true" />
            )}
            Create account
          </Button>
        </form>

        <InfoNote tone="primary" icon={ShieldCheck} title="What we will never ask for">
          We never ask for ID documents, medical reports, bank details or payment. Registration is
          free, and paying for blood or organs is prohibited on the platform.
        </InfoNote>
      </div>
    </AuthShell>
  );
}
