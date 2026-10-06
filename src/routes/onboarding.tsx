import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Droplet,
  HeartHandshake,
  Loader2,
  MapPin,
  Phone,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { LogoMark } from "@/components/common/logo";
import { InfoNote, Pill, SuccessNote } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/components/providers/auth-provider";
import { errorMessage, fieldErrors, unwrapAction } from "@/lib/actions";
import { AVAILABILITY_LABELS, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/labels";
import { BLOOD_GROUPS, type BloodGroup, type UserRole } from "@/lib/domain";
import { areasForCity, cityOptions } from "@/lib/cities";
import { queryKeys } from "@/lib/query-keys";
import { completeOnboarding, fetchAuthConfig } from "@/server/api/auth";
import { pageHead } from "@/lib/seo";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/onboarding")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () =>
    pageHead({
      title: "Choose your role — Heal Connect",
      description: "Tell Heal Connect how you want to take part: donor, recipient, or both.",
      noIndex: true,
    }),
  component: OnboardingPage,
});

const ROLE_ICONS: Record<UserRole, typeof Droplet> = {
  donor: Droplet,
  recipient: HeartHandshake,
  both: Users,
};

const STEPS = ["Your role", "Your location", "Donor details"] as const;

function OnboardingPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, refresh } = useAuth();

  const [step, setStep] = useState(0);
  const [role, setRole] = useState<UserRole>(user?.role ?? "recipient");
  const [city, setCity] = useState(user?.profile.city ?? "");
  const [area, setArea] = useState(user?.profile.area ?? "");
  const [phone, setPhone] = useState(user?.profile.phone ?? "");
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | "">(
    user?.donorProfile?.bloodGroup ?? "",
  );
  const [availability, setAvailability] = useState<"available" | "on_hold" | "unavailable">(
    user?.donorProfile?.availability ?? "available",
  );
  const [sharePhone, setSharePhone] = useState(user?.profile.sharePhoneWithMatches ?? true);
  const [bio, setBio] = useState(user?.profile.bio ?? "");
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrorState, setFieldErrorState] = useState<Record<string, string>>({});

  const cites = useMemo(() => cityOptions(), []);
  const areas = useMemo(() => areasForCity(city), [city]);
  const isDonorRole = role === "donor" || role === "both";
  const lastStep = isDonorRole ? STEPS.length - 1 : 1;

  useEffect(() => {
    if (!user) {
      void navigate({ to: "/login", replace: true });
    }
  }, [navigate, user]);

  const mutation = useMutation({
    mutationFn: async () =>
      unwrapAction(
        await completeOnboarding({
          data: {
            role,
            city,
            area: area || undefined,
            phone: phone || undefined,
            ...(isDonorRole && bloodGroup ? { bloodGroup } : {}),
            ...(isDonorRole ? { availability } : {}),
            sharePhoneWithMatches: sharePhone,
          },
        }),
      ),
    onSuccess: async () => {
      await refresh();
      await queryClient.invalidateQueries({ queryKey: queryKeys.session });
      void queryClient.invalidateQueries();
      toast.success("You are all set", { description: "Your dashboard is ready." });
      void navigate({ to: redirect ?? "/dashboard", replace: true });
    },
    onError: (error) => {
      setFormError(errorMessage(error));
      setFieldErrorState(fieldErrors(error));
    },
  });

  const validateStep = () => {
    setFormError(null);
    if (step === 0) return true;
    if (step === 1 && city.trim().length < 2) {
      setFormError("Please choose or type your city so we can show nearby requests.");
      return false;
    }
    if (step === lastStep && isDonorRole && !bloodGroup) {
      setFormError("Select your blood group — it is used only to match relevant requests.");
      return false;
    }
    return true;
  };

  return (
    <div className="min-h-screen grid-mesh">
      <div className="page-shell max-w-3xl py-10">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <LogoMark className="size-10" />
            <div>
              <p className="font-display text-lg font-extrabold">Set up your profile</p>
              <p className="text-xs text-muted-foreground">
                Step {step + 1} of {lastStep + 1} · {STEPS[step]}
              </p>
            </div>
          </div>
          <Pill tone="primary">Takes about a minute</Pill>
        </header>

        <ol className="mt-6 flex items-center gap-2" aria-label="Progress">
          {STEPS.slice(0, lastStep + 1).map((label, index) => (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                  index <= step
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {index < step ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}
              </span>
              <span
                className={`hidden text-xs font-semibold sm:block ${
                  index <= step ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
              {index < lastStep ? (
                <span className="h-px flex-1 bg-border" aria-hidden="true" />
              ) : null}
            </li>
          ))}
        </ol>

        <div className="surface mt-6 space-y-6 p-6 sm:p-8">
          {formError ? (
            <div
              role="alert"
              className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
            >
              {formError}
            </div>
          ) : null}

          {step === 0 ? (
            <section className="space-y-4" aria-labelledby="role-heading">
              <h1 id="role-heading" className="font-display text-xl font-extrabold">
                How do you want to take part?
              </h1>
              <p className="text-sm text-muted-foreground">
                You can switch or combine roles later from Settings. Nothing is permanent.
              </p>
              <div className="grid gap-3">
                {(Object.keys(ROLE_LABELS) as UserRole[]).map((option) => {
                  const Icon = ROLE_ICONS[option];
                  const active = role === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setRole(option)}
                      aria-pressed={active}
                      className={`flex items-start gap-4 rounded-2xl border p-4 text-left transition ${
                        active
                          ? "border-primary bg-primary-soft shadow-sm"
                          : "border-border bg-card hover:border-primary/40 hover:bg-accent/60"
                      }`}
                    >
                      <span
                        className={`grid size-11 shrink-0 place-items-center rounded-2xl ${
                          active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                        }`}
                      >
                        <Icon className="size-5" aria-hidden="true" />
                      </span>
                      <span>
                        <span className="flex items-center gap-2 font-display text-base font-bold">
                          {ROLE_LABELS[option]}
                          {active ? (
                            <Check className="size-4 text-primary" aria-hidden="true" />
                          ) : null}
                        </span>
                        <span className="mt-1 block text-sm text-muted-foreground">
                          {ROLE_DESCRIPTIONS[option]}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {step === 1 ? (
            <section className="space-y-4" aria-labelledby="location-heading">
              <h1 id="location-heading" className="font-display text-xl font-extrabold">
                Where are you based?
              </h1>
              <p className="text-sm text-muted-foreground">
                We only ever publish your city and area on a request — never your street address.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    list="city-options"
                    value={city}
                    required
                    aria-invalid={Boolean(fieldErrorState["city"])}
                    onChange={(event) => {
                      setCity(event.target.value);
                      setArea("");
                    }}
                    placeholder="Start typing your city"
                  />
                  <datalist id="city-options">
                    {cites.map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                  {fieldErrorState["city"] ? (
                    <p className="text-xs font-medium text-destructive">
                      {fieldErrorState["city"]}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="area">Area or locality</Label>
                  {areas.length > 0 ? (
                    <Select value={area} onValueChange={setArea}>
                      <SelectTrigger id="area">
                        <SelectValue placeholder="Select your area" />
                      </SelectTrigger>
                      <SelectContent>
                        {areas.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="area"
                      value={area}
                      onChange={(event) => setArea(event.target.value)}
                      placeholder="e.g. Indirapuram"
                    />
                  )}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="phone">Contact number (private)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+91 90000 00000"
                    aria-describedby="phone-hint"
                  />
                  <p id="phone-hint" className="text-xs text-muted-foreground">
                    Used only to coordinate a confirmed match. It is never shown publicly.
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <label className="flex items-start gap-3 rounded-2xl border border-border bg-muted/40 p-4 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 rounded border-input accent-primary"
                      checked={sharePhone}
                      onChange={(event) => setSharePhone(event.target.checked)}
                    />
                    <span>
                      <span className="flex items-center gap-2 font-semibold">
                        <Phone className="size-4 text-primary" aria-hidden="true" />
                        Share my number when I am matched
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        If you turn this off, coordinators can still reach you through the platform,
                        but your number stays hidden. Recommended for most members.
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="space-y-4" aria-labelledby="donor-heading">
              <h1 id="donor-heading" className="font-display text-xl font-extrabold">
                Donor details
              </h1>
              <p className="text-sm text-muted-foreground">
                These details decide which requests we show you. They are not a medical screening —
                the blood bank always confirms eligibility.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bloodGroup">Blood group *</Label>
                  <Select
                    value={bloodGroup}
                    onValueChange={(value) => setBloodGroup(value as BloodGroup)}
                  >
                    <SelectTrigger
                      id="bloodGroup"
                      aria-invalid={Boolean(fieldErrorState["bloodGroup"])}
                    >
                      <SelectValue placeholder="Select group" />
                    </SelectTrigger>
                    <SelectContent>
                      {BLOOD_GROUPS.map((group) => (
                        <SelectItem key={group} value={group}>
                          {group}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="availability">Availability</Label>
                  <Select
                    value={availability}
                    onValueChange={(value) => setAvailability(value as typeof availability)}
                  >
                    <SelectTrigger id="availability">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        Object.keys(AVAILABILITY_LABELS) as (keyof typeof AVAILABILITY_LABELS)[]
                      ).map((option) => (
                        <SelectItem key={option} value={option}>
                          {AVAILABILITY_LABELS[option]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="bio">A short introduction (optional)</Label>
                  <Textarea
                    id="bio"
                    rows={3}
                    value={bio}
                    maxLength={500}
                    onChange={(event) => setBio(event.target.value)}
                    placeholder="e.g. Regular donor in Indirapuram, available on weekends, can travel across the city."
                  />
                </div>
              </div>
              <SuccessNote>
                You can refine donation preferences, last donation date and travel distance later in
                your donor profile.
              </SuccessNote>
            </section>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              className="sm:w-auto"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              disabled={step === 0}
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back
            </Button>
            {step < lastStep ? (
              <Button
                type="button"
                className="sm:w-auto"
                onClick={() => {
                  if (validateStep()) setStep((current) => current + 1);
                }}
              >
                Continue
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            ) : (
              <Button
                type="button"
                className="sm:w-auto"
                disabled={mutation.isPending}
                onClick={() => {
                  if (validateStep()) mutation.mutate();
                }}
              >
                {mutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="size-4" aria-hidden="true" />
                )}
                Finish setup
              </Button>
            )}
          </div>

          <InfoNote tone="info" icon={MapPin} title="Not sure about your role?">
            You can start as a recipient and add donor details later, or pick “Donor and Recipient”
            to see both sides of the platform.
          </InfoNote>
        </div>
      </div>
    </div>
  );
}
