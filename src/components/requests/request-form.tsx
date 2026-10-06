import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Clock3,
  Droplet,
  HeartPulse,
  Loader2,
  MapPin,
  PhoneCall,
  Siren,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { InfoNote, Pill } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cityOptions, areasForCity } from "@/lib/cities";
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
import { createRequest, updateRequest } from "@/server/api/requests";

type FormValues = z.input<typeof requestSchema>;

const URGENCY_ICONS: Record<Urgency, LucideIcon> = {
  normal: CalendarClock,
  urgent: Clock3,
  emergency: Siren,
};

export function RequestForm({
  mode = "create",
  requestId,
  defaults,
  onSubmitted,
  onCancel,
}: {
  mode?: "create" | "edit";
  requestId?: string;
  defaults?: Partial<FormValues>;
  onSubmitted: (result: { id: string; reference?: string | undefined }) => void;
  onCancel?: () => void;
}) {
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
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
      ...defaults,
    },
    mode: "onBlur",
  });

  const requestType = form.watch("requestType");
  const urgency = form.watch("urgency");
  const city = form.watch("city");
  const units = form.watch("unitsRequired");
  const areas = areasForCity(city);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        ...values,
        bloodGroup: values.requestType === "medical_assistance" ? null : (values.bloodGroup ?? null),
        area: values.area || "",
        additionalInfo: values.additionalInfo || "",
        contactInstructions: values.contactInstructions || "",
      };

      if (mode === "edit" && requestId) {
        const { consent: _consent, ...rest } = payload;
        void _consent;
        const result = unwrapAction(await updateRequest({ data: { ...rest, id: requestId } }));
        return { id: requestId, reference: undefined, updatedAt: result.updatedAt };
      }

      const result = unwrapAction(await createRequest({ data: payload }));
      return result.reference ? { id: result.id, reference: result.reference } : { id: result.id };
    },
    onSuccess: (result) => {
      const label = result.reference ? `Request ${result.reference}` : "Request";
      toast.success(mode === "edit" ? "Request updated" : `${label} published`, {
        description:
          mode === "edit"
            ? "Any donors who offered help have been notified about the change."
            : "Matching donors nearby have been notified. You can track offers under My requests.",
      });
      for (const key of invalidationGroups.afterRequestChange) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      if (requestId) void queryClient.invalidateQueries({ queryKey: ["request", requestId] });
      onSubmitted(result);
    },
    onError: (error) => {
      const fields = fieldErrors(error);
      let mapped = false;
      for (const [key, message] of Object.entries(fields)) {
        form.setError(key as keyof FormValues, { message });
        mapped = true;
      }
      toast.error("We could not save this request", {
        description: mapped ? "Please check the highlighted fields." : errorMessage(error),
      });
    },
  });

  const submit = form.handleSubmit((values) => mutation.mutate(values));

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {form.formState.errors.root ? (
        <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {form.formState.errors.root.message}
        </div>
      ) : null}

      {/* What is needed */}
      <fieldset className="surface space-y-5 p-5">
        <legend className="px-1 font-display text-base font-bold">What is needed</legend>

        <div className="space-y-3">
          <Label id="request-type-label">Request type *</Label>
          <RadioGroup
            value={requestType}
            onValueChange={(value) => form.setValue("requestType", value as RequestType, { shouldValidate: true })}
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
                  <span className="text-xs text-muted-foreground">
                    {type === "blood"
                      ? "Whole blood units for transfusion."
                      : type === "platelets"
                        ? "Single-donor platelet units."
                        : "Non-blood help: volunteering, transport, coordination."}
                  </span>
                </Label>
              </div>
            ))}
          </RadioGroup>
          {form.formState.errors.requestType ? (
            <p className="text-xs font-medium text-destructive">{form.formState.errors.requestType.message}</p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {requestType !== "medical_assistance" ? (
            <div className="space-y-2">
              <Label htmlFor="bloodGroup">Blood group needed *</Label>
              <Select
                value={(form.watch("bloodGroup") as string) ?? ""}
                onValueChange={(value) =>
                  form.setValue("bloodGroup", value as BloodGroup, { shouldValidate: true })
                }
              >
                <SelectTrigger id="bloodGroup" aria-invalid={Boolean(form.formState.errors.bloodGroup)}>
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
                <p className="text-xs font-medium text-destructive">{form.formState.errors.bloodGroup.message}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  The hospital or blood bank decides the final compatible match.
                </p>
              )}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="unitsRequired">
              {requestType === "medical_assistance" ? "Number of volunteers needed *" : "Units required *"}
            </Label>
            <Input
              id="unitsRequired"
              type="number"
              inputMode="numeric"
              min={1}
              max={20}
              step={1}
              value={Number(units) || ""}
              onChange={(event) =>
                form.setValue("unitsRequired", Number(event.target.value), { shouldValidate: true })
              }
              aria-invalid={Boolean(form.formState.errors.unitsRequired)}
            />
            {form.formState.errors.unitsRequired ? (
              <p className="text-xs font-medium text-destructive">{form.formState.errors.unitsRequired.message}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                For more than 20 units, coordinate directly with the hospital blood bank.
              </p>
            )}
          </div>
        </div>
      </fieldset>

      {/* Where and when */}
      <fieldset className="surface space-y-5 p-5">
        <legend className="px-1 font-display text-base font-bold">Where and when</legend>

        <div className="space-y-2">
          <Label htmlFor="hospitalName">Hospital or blood bank *</Label>
          <Input
            id="hospitalName"
            value={form.watch("hospitalName")}
            onChange={(event) => form.setValue("hospitalName", event.target.value, { shouldValidate: true })}
            placeholder="e.g. Sanjeevani Multispeciality Hospital"
            aria-invalid={Boolean(form.formState.errors.hospitalName)}
          />
          {form.formState.errors.hospitalName ? (
            <p className="text-xs font-medium text-destructive">{form.formState.errors.hospitalName.message}</p>
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
              <p className="text-xs font-medium text-destructive">{form.formState.errors.city.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="area">Area or locality</Label>
            {areas.length > 0 ? (
              <Select value={form.watch("area") ?? ""} onValueChange={(value) => form.setValue("area", value)}>
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

          <div className="space-y-2">
            <Label htmlFor="requiredBy">Date help is needed *</Label>
            <Input
              id="requiredBy"
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              value={form.watch("requiredBy")}
              onChange={(event) => form.setValue("requiredBy", event.target.value, { shouldValidate: true })}
              aria-invalid={Boolean(form.formState.errors.requiredBy)}
            />
            {form.formState.errors.requiredBy ? (
              <p className="text-xs font-medium text-destructive">{form.formState.errors.requiredBy.message}</p>
            ) : null}
          </div>

          <div className="space-y-3 sm:col-span-2">
            <Label id="urgency-label">Urgency *</Label>
            <RadioGroup
              value={urgency}
              onValueChange={(value) => form.setValue("urgency", value as Urgency, { shouldValidate: true })}
              className="grid gap-3 sm:grid-cols-3"
              aria-labelledby="urgency-label"
            >
              {URGENCIES.map((option) => {
                const Icon = URGENCY_ICONS[option];
                return (
                  <div key={option}>
                    <RadioGroupItem value={option} id={`urgency-${option}`} className="peer sr-only" />
                    <Label
                      htmlFor={`urgency-${option}`}
                      className={`flex h-full cursor-pointer flex-col gap-1 rounded-2xl border p-4 transition hover:bg-accent/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary-soft ${
                        option === "emergency" ? "border-destructive/30" : "border-border"
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm font-bold">
                        <Icon
                          className={option === "emergency" ? "size-4 text-destructive" : "size-4 text-primary"}
                          aria-hidden="true"
                        />
                        {URGENCY_LABELS[option]}
                      </span>
                      <span className="text-xs text-muted-foreground">{URGENCY_DESCRIPTIONS[option]}</span>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
            {form.formState.errors.urgency ? (
              <p className="text-xs font-medium text-destructive">{form.formState.errors.urgency.message}</p>
            ) : null}
          </div>
        </div>

        {urgency === "emergency" ? (
          <InfoNote tone="danger" icon={Siren} title="Emergency requests need extra detail">
            {EMERGENCY_DISCLAIMER} Add the ward or coordinating person below so a donor can act quickly, and contact
            the hospital blood bank in parallel.
          </InfoNote>
        ) : null}
      </fieldset>

      {/* Details and coordination */}
      <fieldset className="surface space-y-5 p-5">
        <legend className="px-1 font-display text-base font-bold">Details and coordination</legend>

        <div className="space-y-2">
          <Label htmlFor="additionalInfo">
            Additional information {urgency === "emergency" ? "*" : ""}
          </Label>
          <Textarea
            id="additionalInfo"
            rows={4}
            maxLength={1000}
            value={form.watch("additionalInfo") ?? ""}
            onChange={(event) => form.setValue("additionalInfo", event.target.value, { shouldValidate: true })}
            placeholder="Patient context, ward or department, what the hospital has asked for, timings for donors."
            aria-invalid={Boolean(form.formState.errors.additionalInfo)}
          />
          {form.formState.errors.additionalInfo ? (
            <p className="text-xs font-medium text-destructive">{form.formState.errors.additionalInfo.message}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Do not include ID numbers, medical reports or bank details. {(form.watch("additionalInfo") ?? "").length}/1000
              characters.
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contactName">Coordinating person *</Label>
            <Input
              id="contactName"
              value={form.watch("contactName")}
              onChange={(event) => form.setValue("contactName", event.target.value, { shouldValidate: true })}
              placeholder="Who should a donor ask for?"
              aria-invalid={Boolean(form.formState.errors.contactName)}
            />
            {form.formState.errors.contactName ? (
              <p className="text-xs font-medium text-destructive">{form.formState.errors.contactName.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactPhone">Contact number *</Label>
            <Input
              id="contactPhone"
              type="tel"
              inputMode="tel"
              value={form.watch("contactPhone")}
              onChange={(event) => form.setValue("contactPhone", event.target.value, { shouldValidate: true })}
              placeholder="+91 90000 00000"
              aria-invalid={Boolean(form.formState.errors.contactPhone)}
            />
            {form.formState.errors.contactPhone ? (
              <p className="text-xs font-medium text-destructive">{form.formState.errors.contactPhone.message}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Shared only with donors the requester accepts. Never shown publicly.
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
                form.setValue("consent", (event.target.checked ? true : false) as true, { shouldValidate: true })
              }
              aria-invalid={Boolean(form.formState.errors.consent)}
            />
            <span className="text-muted-foreground">
              I confirm this request is genuine, that I have consent from the patient (or their family) to share these
              details, and that no payment, gift or compensation is being offered or requested. *
            </span>
          </label>
          {form.formState.errors.consent ? (
            <p className="text-xs font-medium text-destructive">{form.formState.errors.consent.message}</p>
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
      </fieldset>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
          Published requests can be edited, cancelled or marked fulfilled at any time.
        </p>
        <div className="flex gap-2">
          {onCancel ? (
            <Button type="button" variant="outline" onClick={onCancel} disabled={mutation.isPending}>
              Cancel
            </Button>
          ) : null}
          <Button type="submit" disabled={mutation.isPending} className="sm:min-w-40">
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="size-4" aria-hidden="true" />
            )}
            {mode === "edit" ? "Save changes" : "Publish request"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Pill tone="primary">
          <PhoneCall className="size-3.5" aria-hidden="true" />
          Contact details stay hidden until you accept a donor
        </Pill>
        <Pill tone="neutral">Free to post</Pill>
      </div>
    </form>
  );
}
