import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Building2,
  Check,
  Clock,
  Info,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  ErrorState,
  InfoNote,
  PageHeader,
  Pill,
  SkeletonCard,
  SkeletonLines,
  VerificationBadge,
} from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/components/providers/auth-provider";
import { ORGANIZATION_TYPE_LABELS } from "@/lib/labels";
import { ORGANIZATION_TYPES, type OrganizationType } from "@/lib/domain";
import { formatDate, relativeTime } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { errorMessage, fieldErrors, unwrapAction } from "@/lib/actions";
import { fetchMyVerification, submitVerification } from "@/server/api/verification";

export const Route = createFileRoute("/_app/verify")({
  head: () => ({
    meta: [
      { title: "Verification — Heal Connect" },
      {
        name: "description",
        content:
          "Request verification for your account. Verified information is clearly separated from self-reported details.",
      },
    ],
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const { user, refresh } = useAuth();
  const queryClient = useQueryClient();
  const [organizationType, setOrganizationType] = useState<OrganizationType>("individual_donor");
  const [organizationName, setOrganizationName] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.myVerification,
    queryFn: async () => unwrapAction(await fetchMyVerification()),
  });

  const mutation = useMutation({
    mutationFn: async () =>
      unwrapAction(
        await submitVerification({
          data: {
            organizationType,
            organizationName: organizationName || "",
            evidenceNote,
            consent: true as true,
          },
        }),
      ),
    onSuccess: async () => {
      setErrors({});
      toast.success("Verification submitted", {
        description: "Our trust & safety team reviews requests manually. You will be notified of the decision.",
      });
      await refresh();
      void queryClient.invalidateQueries({ queryKey: queryKeys.myVerification });
      void queryClient.invalidateQueries({ queryKey: queryKeys.session });
    },
    onError: (error) => {
      setErrors(fieldErrors(error));
      toast.error("Could not submit verification", { description: errorMessage(error) });
    },
  });

  const current = data?.current ?? null;
  const status = current?.status ?? user?.verificationStatus ?? "unverified";

  return (
    <div className="page-shell max-w-3xl space-y-6 py-8">
      <PageHeader
        title="Verification"
        description="Verification distinguishes reviewed information from self-reported details. It is a platform trust signal — never a medical certification."
        actions={
          <Button asChild variant="outline">
            <Link to="/safety">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Safety guidelines
            </Link>
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <VerificationBadge status={status} />
          {current?.organizationName ? <Pill tone="info">{current.organizationName}</Pill> : null}
        </div>
      </PageHeader>

      {isLoading ? (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonLines count={4} />
        </div>
      ) : isError || !data ? (
        <ErrorState description="We could not load your verification details." onRetry={() => void refetch()} />
      ) : (
        <>
          {/* Status */}
          <section className="surface space-y-4 p-6" aria-labelledby="status-heading">
            <h2 id="status-heading" className="font-display text-lg font-extrabold">
              Current status
            </h2>

            {status === "verified" ? (
              <InfoNote tone="success" icon={BadgeCheck} title="Your account is verified">
                Verified on {current?.reviewedAt ? formatDate(current.reviewedAt) : "record"}. Your requests and donor
                offers display a verified badge, and the platform marks verified information separately from
                self-reported details.
              </InfoNote>
            ) : null}

            {status === "pending" ? (
              <InfoNote tone="warning" icon={Clock} title="Verification in review">
                Submitted {current ? relativeTime(current.submittedAt) : "recently"}. Our team checks the information you
                provided and aims to respond within 1–2 working days. You can keep using the platform normally while
                this is pending.
              </InfoNote>
            ) : null}

            {status === "rejected" ? (
              <InfoNote tone="danger" icon={ShieldAlert} title="Verification could not be approved">
                {current?.reviewNote ??
                  "We could not verify the details provided. You can submit again with more specific information."}
              </InfoNote>
            ) : null}

            {status === "unverified" ? (
              <InfoNote tone="info" icon={Info} title="Not verified yet">
                Your profile is visible with a “self-reported” label. Verification is optional, and it does not change
                which requests you can respond to.
              </InfoNote>
            ) : null}

            <ul className="space-y-2">
              {data.requirements.map((requirement) => (
                <li key={requirement.label} className="flex items-center gap-3 text-sm">
                  <span
                    className={`grid size-6 shrink-0 place-items-center rounded-full ${
                      requirement.met ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {requirement.met ? (
                      <Check className="size-3.5" aria-hidden="true" />
                    ) : (
                      <X className="size-3.5" aria-hidden="true" />
                    )}
                  </span>
                  <span className={requirement.met ? "" : "text-muted-foreground"}>{requirement.label}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Submit */}
          {status !== "verified" && status !== "pending" ? (
            <section className="surface space-y-5 p-6" aria-labelledby="submit-heading">
              <h2 id="submit-heading" className="font-display text-lg font-extrabold">
                Submit verification
              </h2>
              <p className="text-sm text-muted-foreground">
                Tell us who you are and how you take part. This MVP uses a manual, admin-controlled review, and
                eventually hospitals, blood banks, NGOs and authorised organisations will hold verified accounts.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="org-type">Account type *</Label>
                  <Select
                    value={organizationType}
                    onValueChange={(value) => setOrganizationType(value as OrganizationType)}
                  >
                    <SelectTrigger id="org-type" aria-invalid={Boolean(errors["organizationType"])}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORGANIZATION_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {ORGANIZATION_TYPE_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors["organizationType"] ? (
                    <p className="text-xs font-medium text-destructive">{errors["organizationType"]}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="org-name">
                    {organizationType === "individual_donor" ? "Display name (optional)" : "Organisation name *"}
                  </Label>
                  <input
                    id="org-name"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                    value={organizationName}
                    onChange={(event) => setOrganizationName(event.target.value)}
                    placeholder={
                      organizationType === "individual_donor"
                        ? "How you would like to appear"
                        : "e.g. Lifeline Blood Centre, Sector 62"
                    }
                  />
                  {errors["organizationName"] ? (
                    <p className="text-xs font-medium text-destructive">{errors["organizationName"]}</p>
                  ) : null}
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="evidence">How can we verify this? *</Label>
                  <Textarea
                    id="evidence"
                    rows={4}
                    maxLength={600}
                    value={evidenceNote}
                    onChange={(event) => setEvidenceNote(event.target.value)}
                    placeholder="Describe your role, the hospital or blood bank you work with, or the organisation you represent. Do not paste ID numbers or medical reports."
                    aria-invalid={Boolean(errors["evidenceNote"])}
                  />
                  {errors["evidenceNote"] ? (
                    <p className="text-xs font-medium text-destructive">{errors["evidenceNote"]}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">{evidenceNote.length}/600 characters</p>
                  )}
                </div>
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-border bg-muted/40 p-4 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 size-4 rounded border-input accent-primary"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                />
                <span>
                  <span className="font-semibold">I confirm the information above is accurate</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    I understand that verification is a platform trust signal, that it is not a medical certification,
                    and that misuse may result in suspension.
                  </span>
                </span>
              </label>

              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    if (!consent) {
                      toast.error("Please confirm the declaration");
                      return;
                    }
                    mutation.mutate();
                  }}
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <ShieldCheck className="size-4" aria-hidden="true" />
                  )}
                  Submit for review
                </Button>
              </div>
            </section>
          ) : null}

          {/* Guidance */}
          <section className="grid gap-3 lg:grid-cols-2">
            {data.guidance.map((item, index) => (
              <InfoNote key={item} tone={index === 0 ? "info" : "neutral"} icon={index === 0 ? Info : Building2} title={`Note ${index + 1}`}>
                {item}
              </InfoNote>
            ))}
            <InfoNote tone="warning" title="What verification is not">
              A verified badge does not certify that someone is medically eligible to donate, and it does not guarantee
              a donor will be available. Every medical decision belongs to the hospital, blood bank and licensed
              clinicians.
            </InfoNote>
          </section>
        </>
      )}
    </div>
  );
}
