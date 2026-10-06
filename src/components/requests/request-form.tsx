import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  Droplet,
  Eye,
  FileText,
  HeartPulse,
  Loader2,
  MapPin,
  Pencil,
  PhoneCall,
  Send,
  ShieldCheck,
  Siren,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { InfoNote, Pill, UrgencyBadge } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { areasForCity, cityOptions } from "@/lib/cities";
import {
  BLOOD_GROUPS,
  REQUEST_TYPES,
  URGENCIES,
  type BloodGroup,
  type RequestType,
  type Urgency,
} from "@/lib/domain";
import { EMERGENCY_DISCLAIMER, PAYMENT_PROHIBITION, PRIVACY_PROMISE } from "@/lib/brand";
import { REQUEST_TYPE_LABELS, URGENCY_DESCRIPTIONS, URGENCY_LABELS } from "@/lib/labels";
import { requestSchema } from "@/lib/validation";
import { errorMessage, fieldErrors, unwrapAction } from "@/lib/actions";
import { invalidationGroups } from "@/lib/query-keys";
import {
  createRequest,
  createRequestDraft,
  updateRequest,
  updateRequestStatus,
} from "@/server/api/requests";

type FormValues = z.input<typeof requestSchema>;

/** Locally typed payload so field access stays explicit and type-safe. */
type RequestPayload = {
  requestType: RequestType;
  bloodGroup: BloodGroup | null;
  unitsRequired: number;
  hospitalName: string;
  city: string;
  area: string;
  requiredBy: string;
  urgency: Urgency;
  additionalInfo: string;
  contactName: string;
  contactPhone: string;
  contactInstructions: string;
};

type StepId = "type" | "blood" | "location" | "urgency" | "details" | "review";

type StepDefinition = {
  id: StepId;
  title: string;
  blurb: string;
  icon: LucideIcon;
  fields: (keyof FormValues)[];
};

const STEPS: StepDefinition[] = [
  {
    id: "type",
    title: "What is needed",
    blurb: "Choose the kind of help: blood, platelets or another legitimate medical assistance.",
    icon: HeartPulse,
    fields: ["requestType"],
  },
  {
    id: "blood",
    title: "Blood group & units",
    blurb: "Which group the hospital has asked for, and how many units are needed.",
    icon: Droplet,
    fields: ["bloodGroup", "unitsRequired"],
  },
  {
    id: "location",
    title: "Where",
    blurb: "Hospital or blood bank, city and area. Never a street address or ward number.",
    icon: MapPin,
    fields: ["hospitalName", "city", "area"],
  },
  {
    id: "urgency",
    title: "When & urgency",
    blurb: "The date help is needed and how quickly a donor should act.",
    icon: CalendarClock,
    fields: ["requiredBy", "urgency"],
  },
  {
    id: "details",
    title: "Details & coordination",
    blurb: "Context for donors plus the contact details we share only after you accept an offer.",
    icon: FileText,
    fields: ["additionalInfo", "contactName", "contactPhone", "contactInstructions", "consent"],
  },
  {
    id: "review",
    title: "Review",
    blurb:
      "Check everything once, then publish it to matching donors or keep it as a private draft.",
    icon: ShieldCheck,
    fields: [],
  },
];

const URGENCY_ICONS: Record<Urgency, LucideIcon> = {
  normal: CalendarClock,
  urgent: Clock3,
  emergency: Siren,
};

const REQUEST_TYPE_HELP: Record<RequestType, string> = {
  blood: "Whole blood units for transfusion.",
  platelets: "Single-donor platelet units, usually for dengue, cancer or platelet disorders.",
  medical_assistance: "Non-blood help: volunteering, transport, coordination or supplies.",
};

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm font-semibold">{value}</dd>
    </div>
  );
}

export function RequestForm({
  mode = "create",
  requestId,
  defaults,
  isDraft = false,
  onSubmitted,
  onCancel,
}: {
  mode?: "create" | "edit";
  requestId?: string;
  defaults?: Partial<FormValues>;
  /** True when the request being edited is currently a private draft. */
  isDraft?: boolean;
  onSubmitted?: (result: { id: string; reference?: string | undefined; draft: boolean }) => void;
  onCancel?: () => void;
}) {
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [outcome, setOutcome] = useState<{ id: string; reference: string; draft: boolean } | null>(
    null,
  );

  const initialValues: FormValues = {
    requestType: "blood",
    bloodGroup: null,
    unitsRequired: 1,
    hospitalName: "",
    city: "",
    area: "",
    requiredBy: new Date().toISOString().slice(0, 10),
    urgency: "normal",
    additionalInfo: "",
    contactName: "",
    contactPhone: "",
    contactInstructions: "",
    consent: false as unknown as true,
    ...defaults,
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: initialValues,
    mode: "onBlur",
  });

  const requestType = form.watch("requestType");
  const urgency = form.watch("urgency");
  const city = form.watch("city");
  const units = form.watch("unitsRequired");
  const areas = areasForCity(city);

  // Blood-group step is meaningless for non-blood assistance requests.
  const steps = STEPS.filter((step) => step.id !== "blood" || requestType !== "medical_assistance");
  const activeIndex = Math.min(stepIndex, steps.length - 1);
  const step = steps[activeIndex] as StepDefinition;
  const isLastStep = activeIndex === steps.length - 1;

  const reset = () => {
    form.reset(initialValues);
    setOutcome(null);
    setStepIndex(0);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const invalidate = () => {
    for (const key of invalidationGroups.afterRequestChange) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
    if (requestId) void queryClient.invalidateQueries({ queryKey: ["request", requestId] });
  };

  const sanitizeDraft = (values: FormValues): Partial<RequestPayload> => {
    const draft: Partial<RequestPayload> = { requestType: values["requestType"] as RequestType };
    const bloodGroup = values["bloodGroup"] as BloodGroup | null | undefined;
    if (draft.requestType !== "medical_assistance" && bloodGroup) draft.bloodGroup = bloodGroup;
    const parsedUnits = Number(values["unitsRequired"]);
    if (Number.isFinite(parsedUnits) && parsedUnits >= 1) draft.unitsRequired = parsedUnits;
    const hospitalName = String(values["hospitalName"] ?? "").trim();
    if (hospitalName) draft.hospitalName = hospitalName;
    const cityValue = String(values["city"] ?? "").trim();
    if (cityValue) draft.city = cityValue;
    const areaValue = String(values["area"] ?? "").trim();
    if (areaValue) draft.area = areaValue;
    const requiredBy = String(values["requiredBy"] ?? "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(requiredBy)) draft.requiredBy = requiredBy;
    const urgencyValue = values["urgency"] as Urgency | undefined;
    if (urgencyValue) draft.urgency = urgencyValue;
    const additionalInfo = String(values["additionalInfo"] ?? "").trim();
    if (additionalInfo) draft.additionalInfo = additionalInfo;
    const contactName = String(values["contactName"] ?? "").trim();
    if (contactName) draft.contactName = contactName;
    const contactPhone = String(values["contactPhone"] ?? "").trim();
    if (contactPhone) draft.contactPhone = contactPhone;
    const contactInstructions = String(values["contactInstructions"] ?? "").trim();
    if (contactInstructions) draft.contactInstructions = contactInstructions;
    return draft;
  };

  const toPayload = (values: FormValues): RequestPayload => ({
    requestType: values["requestType"] as RequestType,
    bloodGroup:
      (values["requestType"] as RequestType) === "medical_assistance"
        ? null
        : ((values["bloodGroup"] as BloodGroup | null | undefined) ?? null),
    unitsRequired: Number(values["unitsRequired"]),
    hospitalName: String(values["hospitalName"] ?? ""),
    city: String(values["city"] ?? ""),
    area: String(values["area"] ?? ""),
    requiredBy: String(values["requiredBy"] ?? ""),
    urgency: values["urgency"] as Urgency,
    additionalInfo: String(values["additionalInfo"] ?? ""),
    contactName: String(values["contactName"] ?? ""),
    contactPhone: String(values["contactPhone"] ?? ""),
    contactInstructions: String(values["contactInstructions"] ?? ""),
  });

  const publishMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = toPayload(values);

      if (mode === "edit" && requestId) {
        unwrapAction(await updateRequest({ data: { ...payload, id: requestId } }));
        if (isDraft) {
          unwrapAction(await updateRequestStatus({ data: { id: requestId, status: "open" } }));
        }
        return { id: requestId, reference: undefined as string | undefined, draft: false };
      }

      const result = unwrapAction(await createRequest({ data: { ...payload, consent: true } }));
      return { id: result.id, reference: result.reference, draft: false };
    },
    onSuccess: (result) => {
      invalidate();
      toast.success(
        result.reference ? `Request ${result.reference} published` : "Request published",
        {
          description:
            mode === "edit"
              ? "Any donors who offered help have been notified about the change."
              : "Matching donors nearby have been notified. You can track offers under My requests.",
        },
      );
      setOutcome({ id: result.id, reference: result.reference ?? "", draft: false });
      onSubmitted?.(result);
    },
    onError: (error) => {
      const fields = fieldErrors(error);
      let mapped = false;
      for (const [key, message] of Object.entries(fields)) {
        form.setError(key as keyof FormValues, { message });
        mapped = true;
      }
      if (mapped) {
        // Jump back to the first step that owns an invalid field.
        const firstInvalid = steps.findIndex((item) =>
          item.fields.some((field) => Boolean(fields[field as string])),
        );
        if (firstInvalid >= 0) setStepIndex(firstInvalid);
      }
      toast.error("We could not save this request", {
        description: mapped ? "Please check the highlighted fields." : errorMessage(error),
      });
    },
  });

  const draftMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (mode === "edit" && requestId) {
        unwrapAction(await updateRequest({ data: { ...sanitizeDraft(values), id: requestId } }));
        return { id: requestId, reference: "", draft: true };
      }
      const result = unwrapAction(await createRequestDraft({ data: sanitizeDraft(values) }));
      return { id: result.id, reference: result.reference, draft: true };
    },
    onSuccess: (result) => {
      invalidate();
      toast.success("Draft saved", {
        description: "Only you can see this draft. Publish it when the details are confirmed.",
      });
      setOutcome({ id: result.id, reference: result.reference, draft: true });
      onSubmitted?.(result);
    },
    onError: (error) => {
      toast.error("We could not save this draft", { description: errorMessage(error) });
    },
  });

  const publishDraftMutation = useMutation({
    mutationFn: async (id: string) => {
      unwrapAction(await updateRequestStatus({ data: { id, status: "open" } }));
      return id;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Draft published", {
        description: "Matching donors nearby have been notified.",
      });
      setOutcome((current) => (current ? { ...current, draft: false } : current));
    },
    onError: (error) => {
      toast.error("We could not publish this draft", { description: errorMessage(error) });
    },
  });

  const focusFormTop = () => {
    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const goNext = async () => {
    if (step.fields.length > 0) {
      const valid = await form.trigger(step.fields as never, { shouldFocus: true });
      if (!valid) return;
    }
    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
    focusFormTop();
  };

  const goBack = () => {
    setStepIndex((current) => Math.max(current - 1, 0));
    focusFormTop();
  };

  const goTo = async (target: number) => {
    if (target <= activeIndex) {
      setStepIndex(target);
      focusFormTop();
      return;
    }
    // Only allow jumping ahead through steps that already validate.
    for (let index = activeIndex; index < target; index += 1) {
      const current = steps[index] as StepDefinition;
      if (current.fields.length === 0) continue;
      const valid = await form.trigger(current.fields as never, { shouldFocus: true });
      if (!valid) {
        setStepIndex(index);
        return;
      }
    }
    setStepIndex(target);
    focusFormTop();
  };

  const submit = form.handleSubmit((values) => publishMutation.mutate(values));
  const busy = publishMutation.isPending || draftMutation.isPending;
  const reference = outcome?.reference || (mode === "edit" ? "this request" : "your request");

  /* ------------------------------------------------------------------ */
  /* Success / saved summary screen                                      */
  /* ------------------------------------------------------------------ */
  if (outcome) {
    const published = !outcome.draft;
    const summary = form.getValues();
    const summaryBloodGroup = summary["bloodGroup"] as BloodGroup | null | undefined;
    const summaryType = summary["requestType"] as RequestType;
    const summaryUnits = summary["unitsRequired"] as number;
    const summaryUrgency = summary["urgency"] as Urgency;
    const summaryHospital = String(summary["hospitalName"] ?? "");
    const summaryCity = String(summary["city"] ?? "");
    const summaryRequiredBy = String(summary["requiredBy"] ?? "");
    return (
      <section className="surface animate-fade-up space-y-6 p-6" aria-live="polite">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <span
            className={`grid size-12 shrink-0 place-items-center rounded-2xl ${
              published ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
            }`}
          >
            {published ? (
              <CheckCircle2 className="size-6" aria-hidden="true" />
            ) : (
              <FileText className="size-6" aria-hidden="true" />
            )}
          </span>
          <div className="space-y-1">
            <h2 className="font-display text-xl font-bold">
              {published ? "Request published" : "Draft saved"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {published ? (
                <>
                  <span className="font-semibold text-foreground">{reference}</span> is live for
                  matching donors nearby. We notified donors whose group, distance and availability
                  fit.
                </>
              ) : (
                <>
                  <span className="font-semibold text-foreground">{reference}</span> is a private
                  draft. Nobody else can see it until you publish.
                </>
              )}
            </p>
          </div>
        </div>

        <dl className="grid gap-4 rounded-2xl border border-border bg-muted/40 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryRow label="Type" value={REQUEST_TYPE_LABELS[summaryType]} />
          <SummaryRow
            label={summaryType === "medical_assistance" ? "People needed" : "Blood group"}
            value={
              summaryType === "medical_assistance"
                ? `${summaryUnits}`
                : (summaryBloodGroup ?? "Not set")
            }
          />
          <SummaryRow
            label={summaryType === "medical_assistance" ? "Volunteers needed" : "Units needed"}
            value={summaryUnits}
          />
          <SummaryRow label="Urgency" value={<UrgencyBadge urgency={summaryUrgency} />} />
          <SummaryRow
            label="Hospital / city"
            value={`${summaryHospital || "Not set"}${summaryCity ? `, ${summaryCity}` : ""}`}
          />
          <SummaryRow label="Needed by" value={summaryRequiredBy || "Not set"} />
        </dl>

        <div className="flex flex-wrap gap-2">
          {published ? (
            <Button asChild>
              <Link to="/requests/$requestId" params={{ requestId: outcome.id }}>
                <Eye className="size-4" aria-hidden="true" />
                View request details
              </Link>
            </Button>
          ) : (
            <Button
              onClick={() => publishDraftMutation.mutate(outcome.id)}
              disabled={publishDraftMutation.isPending}
            >
              {publishDraftMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="size-4" aria-hidden="true" />
              )}
              Publish now
            </Button>
          )}
          <Button asChild variant="outline">
            <Link to="/my-requests">
              <FileText className="size-4" aria-hidden="true" />
              My requests
            </Link>
          </Button>
          {onCancel ? (
            <Button variant="ghost" onClick={onCancel}>
              Back to dashboard
            </Button>
          ) : null}
          <Button variant="ghost" onClick={reset}>
            <Sparkles className="size-4" aria-hidden="true" />
            Create another
          </Button>
        </div>

        <InfoNote tone="primary" icon={PhoneCall} title="What happens next">
          Donors who can help will offer through the platform. You accept an offer to unlock their
          contact details, then the hospital or blood bank confirms final compatibility and
          eligibility.
        </InfoNote>
      </section>
    );
  }

  /* ------------------------------------------------------------------ */
  /* Wizard                                                             */
  /* ------------------------------------------------------------------ */
  return (
    <form
      ref={formRef}
      className="space-y-5 scroll-mt-20"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!isLastStep) {
          void goNext();
          return;
        }
        void submit();
      }}
    >
      {/* Progress + stepper */}
      <div className="surface space-y-4 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Step {activeIndex + 1} of {steps.length}
          </p>
          {mode === "create" || isDraft ? (
            <button
              type="button"
              className="text-xs font-semibold text-primary underline-offset-4 hover:underline disabled:opacity-60"
              onClick={() => draftMutation.mutate(form.getValues())}
              disabled={busy}
            >
              Save as draft
            </button>
          ) : null}
        </div>

        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={activeIndex + 1}
          aria-label="Request progress"
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${((activeIndex + 1) / steps.length) * 100}%` }}
          />
        </div>

        <ol className="flex flex-wrap gap-2">
          {steps.map((item, index) => {
            const Icon = item.icon;
            const state =
              index === activeIndex ? "current" : index < activeIndex ? "done" : "upcoming";
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => void goTo(index)}
                  aria-current={state === "current" ? "step" : undefined}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    state === "current"
                      ? "border-primary bg-primary-soft text-primary"
                      : state === "done"
                        ? "border-success/30 bg-success/10 text-success hover:bg-success/15"
                        : "border-border text-muted-foreground hover:bg-accent/50"
                  }`}
                >
                  {state === "done" ? (
                    <Check className="size-3.5" aria-hidden="true" />
                  ) : (
                    <Icon className="size-3.5" aria-hidden="true" />
                  )}
                  <span className="hidden sm:inline">{item.title}</span>
                  <span className="sm:hidden">{index + 1}</span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="border-t border-border pt-3">
          <h2 className="font-display text-base font-bold">{step.title}</h2>
          <p className="text-xs text-muted-foreground">{step.blurb}</p>
        </div>
      </div>

      {form.formState.errors.root ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {form.formState.errors.root.message}
        </div>
      ) : null}

      <div className="surface space-y-5 p-5">
        {step.id === "type" ? (
          <div className="space-y-3">
            <Label id="request-type-label">Request type *</Label>
            <RadioGroup
              value={requestType}
              onValueChange={(value) =>
                form.setValue("requestType", value as RequestType, { shouldValidate: true })
              }
              className="grid gap-3 sm:grid-cols-3"
              aria-labelledby="request-type-label"
            >
              {REQUEST_TYPES.map((type) => (
                <div key={type}>
                  <RadioGroupItem value={type} id={`type-${type}`} className="peer sr-only" />
                  <Label
                    htmlFor={`type-${type}`}
                    className="flex h-full cursor-pointer flex-col gap-1 rounded-2xl border border-border bg-card p-4 transition hover:bg-accent/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary-soft"
                  >
                    <span className="flex items-center gap-2 text-sm font-bold">
                      {type === "medical_assistance" ? (
                        <HeartPulse className="size-4 text-primary" aria-hidden="true" />
                      ) : (
                        <Droplet className="size-4 text-blood" aria-hidden="true" />
                      )}
                      {REQUEST_TYPE_LABELS[type]}
                    </span>
                    <span className="text-xs text-muted-foreground">{REQUEST_TYPE_HELP[type]}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
            {form.formState.errors.requestType ? (
              <p className="text-xs font-medium text-destructive">
                {form.formState.errors.requestType.message}
              </p>
            ) : null}
            {requestType === "medical_assistance" ? (
              <InfoNote tone="primary" icon={HeartPulse} title="Non-blood assistance">
                Blood-group matching does not apply here. Describe what is needed in the next steps
                and keep everything free of charge.
              </InfoNote>
            ) : null}
          </div>
        ) : null}

        {step.id === "blood" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bloodGroup">Blood group needed *</Label>
              <Select
                value={(form.watch("bloodGroup") as string) ?? ""}
                onValueChange={(value) =>
                  form.setValue("bloodGroup", value as BloodGroup, { shouldValidate: true })
                }
              >
                <SelectTrigger
                  id="bloodGroup"
                  aria-invalid={Boolean(form.formState.errors.bloodGroup)}
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
              {form.formState.errors.bloodGroup ? (
                <p className="text-xs font-medium text-destructive">
                  {form.formState.errors.bloodGroup.message}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  The hospital or blood bank decides the final compatible match. We use red-cell
                  compatibility only as a guide for matching.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="unitsRequired">Units required *</Label>
              <Input
                id="unitsRequired"
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                step={1}
                value={Number(units) || ""}
                onChange={(event) =>
                  form.setValue("unitsRequired", Number(event.target.value), {
                    shouldValidate: true,
                  })
                }
                aria-invalid={Boolean(form.formState.errors.unitsRequired)}
              />
              {form.formState.errors.unitsRequired ? (
                <p className="text-xs font-medium text-destructive">
                  {form.formState.errors.unitsRequired.message}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  For more than 20 units, coordinate directly with the hospital blood bank.
                </p>
              )}
            </div>

            <div className="sm:col-span-2">
              <InfoNote
                tone="warning"
                icon={AlertTriangle}
                title="Medical decisions are not ours to make"
              >
                {EMERGENCY_DISCLAIMER}
              </InfoNote>
            </div>
          </div>
        ) : null}

        {step.id === "location" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hospitalName">Hospital or blood bank *</Label>
              <Input
                id="hospitalName"
                value={form.watch("hospitalName")}
                onChange={(event) =>
                  form.setValue("hospitalName", event.target.value, { shouldValidate: true })
                }
                placeholder="e.g. Sanjeevani Multispeciality Hospital"
                aria-invalid={Boolean(form.formState.errors.hospitalName)}
              />
              {form.formState.errors.hospitalName ? (
                <p className="text-xs font-medium text-destructive">
                  {form.formState.errors.hospitalName.message}
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  list="request-city-options"
                  value={city}
                  onChange={(event) => {
                    form.setValue("city", event.target.value, { shouldValidate: true });
                    form.setValue("area", "");
                  }}
                  placeholder="e.g. Ghaziabad"
                  aria-invalid={Boolean(form.formState.errors.city)}
                />
                <datalist id="request-city-options">
                  {cityOptions().map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
                {form.formState.errors.city ? (
                  <p className="text-xs font-medium text-destructive">
                    {form.formState.errors.city.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="area">Area or locality</Label>
                {areas.length > 0 ? (
                  <Select
                    value={form.watch("area") ?? ""}
                    onValueChange={(value) => form.setValue("area", value)}
                  >
                    <SelectTrigger id="area">
                      <SelectValue placeholder="Select area" />
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
                    value={form.watch("area") ?? ""}
                    onChange={(event) => form.setValue("area", event.target.value)}
                    placeholder="e.g. Indirapuram"
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  Do not enter a street address or ward number. City and area are enough.
                </p>
              </div>
            </div>

            <InfoNote tone="primary" icon={MapPin} title="Location privacy">
              {PRIVACY_PROMISE}
            </InfoNote>
          </div>
        ) : null}

        {step.id === "urgency" ? (
          <div className="space-y-4">
            <div className="space-y-2 sm:max-w-xs">
              <Label htmlFor="requiredBy">Date help is needed *</Label>
              <Input
                id="requiredBy"
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={form.watch("requiredBy")}
                onChange={(event) =>
                  form.setValue("requiredBy", event.target.value, { shouldValidate: true })
                }
                aria-invalid={Boolean(form.formState.errors.requiredBy)}
              />
              {form.formState.errors.requiredBy ? (
                <p className="text-xs font-medium text-destructive">
                  {form.formState.errors.requiredBy.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-3">
              <Label id="urgency-label">Urgency *</Label>
              <RadioGroup
                value={urgency}
                onValueChange={(value) =>
                  form.setValue("urgency", value as Urgency, { shouldValidate: true })
                }
                className="grid gap-3 sm:grid-cols-3"
                aria-labelledby="urgency-label"
              >
                {URGENCIES.map((option) => {
                  const Icon = URGENCY_ICONS[option];
                  return (
                    <div key={option}>
                      <RadioGroupItem
                        value={option}
                        id={`urgency-${option}`}
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor={`urgency-${option}`}
                        className={`flex h-full cursor-pointer flex-col gap-1 rounded-2xl border p-4 transition hover:bg-accent/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary-soft ${
                          option === "emergency" ? "border-destructive/30" : "border-border"
                        }`}
                      >
                        <span className="flex items-center gap-2 text-sm font-bold">
                          <Icon
                            className={
                              option === "emergency"
                                ? "size-4 text-destructive"
                                : "size-4 text-primary"
                            }
                            aria-hidden="true"
                          />
                          {URGENCY_LABELS[option]}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {URGENCY_DESCRIPTIONS[option]}
                        </span>
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
              {form.formState.errors.urgency ? (
                <p className="text-xs font-medium text-destructive">
                  {form.formState.errors.urgency.message}
                </p>
              ) : null}
            </div>

            {urgency === "emergency" ? (
              <InfoNote tone="danger" icon={Siren} title="Emergency requests need extra detail">
                {EMERGENCY_DISCLAIMER} Add the ward or coordinating person in the next step so a
                donor can act quickly, and contact the hospital blood bank in parallel.
              </InfoNote>
            ) : null}
          </div>
        ) : null}

        {step.id === "details" ? (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="additionalInfo">
                Additional information {urgency === "emergency" ? "*" : ""}
              </Label>
              <Textarea
                id="additionalInfo"
                rows={4}
                maxLength={1000}
                value={form.watch("additionalInfo") ?? ""}
                onChange={(event) =>
                  form.setValue("additionalInfo", event.target.value, { shouldValidate: true })
                }
                placeholder="Patient context, ward or department, what the hospital has asked for, timings for donors."
                aria-invalid={Boolean(form.formState.errors.additionalInfo)}
              />
              {form.formState.errors.additionalInfo ? (
                <p className="text-xs font-medium text-destructive">
                  {form.formState.errors.additionalInfo.message}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Do not include ID numbers, medical reports or bank details.{" "}
                  {(form.watch("additionalInfo") ?? "").length}/1000 characters.
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contactName">Coordinating person *</Label>
                <Input
                  id="contactName"
                  value={form.watch("contactName")}
                  onChange={(event) =>
                    form.setValue("contactName", event.target.value, { shouldValidate: true })
                  }
                  placeholder="Who should a donor ask for?"
                  aria-invalid={Boolean(form.formState.errors.contactName)}
                />
                {form.formState.errors.contactName ? (
                  <p className="text-xs font-medium text-destructive">
                    {form.formState.errors.contactName.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Contact number *</Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  inputMode="tel"
                  value={form.watch("contactPhone")}
                  onChange={(event) =>
                    form.setValue("contactPhone", event.target.value, { shouldValidate: true })
                  }
                  placeholder="+91 90000 00000"
                  aria-invalid={Boolean(form.formState.errors.contactPhone)}
                />
                {form.formState.errors.contactPhone ? (
                  <p className="text-xs font-medium text-destructive">
                    {form.formState.errors.contactPhone.message}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Shared only with donors you accept. Never shown publicly.
                  </p>
                )}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="contactInstructions">Coordination notes (optional)</Label>
                <Input
                  id="contactInstructions"
                  value={form.watch("contactInstructions") ?? ""}
                  onChange={(event) => form.setValue("contactInstructions", event.target.value)}
                  placeholder="e.g. Call between 8 AM and 9 PM. Ask for the transfusion desk."
                />
              </div>
            </div>

            <div className="space-y-3 border-t border-border pt-4">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 size-4 rounded border-input accent-primary"
                  checked={Boolean(form.watch("consent"))}
                  onChange={(event) =>
                    form.setValue("consent", (event.target.checked ? true : false) as true, {
                      shouldValidate: true,
                    })
                  }
                  aria-invalid={Boolean(form.formState.errors.consent)}
                />
                <span className="text-muted-foreground">
                  I confirm this request is genuine, that I have consent from the patient (or their
                  family) to share these details, and that no payment, gift or compensation is being
                  offered or requested. *
                </span>
              </label>
              {form.formState.errors.consent ? (
                <p className="text-xs font-medium text-destructive">
                  {form.formState.errors.consent.message}
                </p>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <InfoNote tone="warning" icon={AlertTriangle} title="Prohibited content">
                {PAYMENT_PROHIBITION}
              </InfoNote>
              <InfoNote tone="primary" icon={MapPin} title="Privacy at the request level">
                {PRIVACY_PROMISE}
              </InfoNote>
            </div>
          </div>
        ) : null}

        {step.id === "review" ? (
          <div className="space-y-5">
            <dl className="grid gap-4 rounded-2xl border border-border bg-muted/40 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <SummaryRow label="Type" value={REQUEST_TYPE_LABELS[requestType]} />
              <SummaryRow
                label={requestType === "medical_assistance" ? "Volunteers needed" : "Blood group"}
                value={
                  requestType === "medical_assistance"
                    ? `${form.watch("unitsRequired")}`
                    : (form.watch("bloodGroup") ?? "Not set")
                }
              />
              <SummaryRow
                label={requestType === "medical_assistance" ? "People required" : "Units required"}
                value={form.watch("unitsRequired")}
              />
              <SummaryRow label="Urgency" value={<UrgencyBadge urgency={urgency} />} />
              <SummaryRow
                label="Hospital / city"
                value={`${form.watch("hospitalName") || "Not set"}${
                  form.watch("city") ? `, ${form.watch("city")}` : ""
                }`}
              />
              <SummaryRow label="Needed by" value={form.watch("requiredBy") || "Not set"} />
              <SummaryRow
                label="Coordinating person"
                value={form.watch("contactName") || "Not set"}
              />
              <SummaryRow
                label="Contact number"
                value={form.watch("contactPhone") || "Not set"}
                /* Only revealed after an offer is accepted. */
              />
              <SummaryRow
                label="Additional information"
                value={
                  <span className="font-normal text-muted-foreground">
                    {form.watch("additionalInfo")?.trim() || "None added"}
                  </span>
                }
              />
            </dl>

            {urgency === "emergency" ? (
              <InfoNote tone="danger" icon={Siren} title="Emergency request">
                {EMERGENCY_DISCLAIMER}
              </InfoNote>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Check className="size-3.5 text-success" aria-hidden="true" />
              Genuine request confirmed. Contact details stay hidden until you accept a donor.
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void goTo(0)}
                className="sm:hidden"
              >
                <Pencil className="size-3.5" aria-hidden="true" />
                Edit details
              </Button>
              <Pill tone="primary">
                <PhoneCall className="size-3.5" aria-hidden="true" />
                Contact details protected
              </Pill>
              <Pill tone="neutral">Free to post</Pill>
            </div>
          </div>
        ) : null}
      </div>

      {/* Navigation */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
          {isLastStep
            ? "Published requests can be edited, cancelled or marked fulfilled at any time."
            : "You can move between steps freely — nothing is published until the final review."}
        </p>
        <div className="flex flex-wrap gap-2">
          {activeIndex > 0 ? (
            <Button type="button" variant="outline" onClick={goBack} disabled={busy}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back
            </Button>
          ) : onCancel ? (
            <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
          ) : null}

          {isLastStep ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => draftMutation.mutate(form.getValues())}
                disabled={busy}
              >
                {draftMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <FileText className="size-4" aria-hidden="true" />
                )}
                Save as draft
              </Button>
              <Button type="submit" disabled={busy} className="sm:min-w-40">
                {publishMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="size-4" aria-hidden="true" />
                )}
                {mode === "edit"
                  ? isDraft
                    ? "Publish request"
                    : "Save changes"
                  : "Publish request"}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              onClick={() => void goNext()}
              disabled={busy}
              className="sm:min-w-32"
            >
              Continue
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
