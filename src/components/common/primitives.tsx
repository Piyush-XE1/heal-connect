import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  Clock,
  HeartPulse,
  Info,
  Loader2,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import type {
  Availability,
  BloodGroup,
  RequestStatus,
  RequestType,
  ResponseStatus,
  Urgency,
  VerificationStatus,
} from "@/lib/domain";
import {
  AVAILABILITY_LABELS,
  AVAILABILITY_TONES,
  BLOOD_GROUP_TONES,
  REQUEST_STATUS_LABELS,
  RESPONSE_STATUS_LABELS,
  URGENCY_LABELS,
  VERIFICATION_LABELS,
  type Tone,
} from "@/lib/labels";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  primary: "border-primary/25 bg-primary/10 text-primary",
  success: "border-success/25 bg-success/10 text-success",
  warning: "border-warning/35 bg-warning/15 text-warning-foreground",
  danger: "border-destructive/25 bg-destructive/10 text-destructive",
  info: "border-info/25 bg-info/10 text-info",
  blood: "border-blood/25 bg-blood/10 text-blood",
};

export function Pill({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Domain badges                                                       */
/* ------------------------------------------------------------------ */

export function BloodGroupChip({
  group,
  size = "md",
  className,
}: {
  group: BloodGroup | null | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  if (!group) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full border border-dashed border-border px-3 py-1 text-xs font-semibold text-muted-foreground",
          className,
        )}
      >
        Group not set
      </span>
    );
  }
  const sizes = {
    sm: "h-7 min-w-9 px-2 text-xs",
    md: "h-9 min-w-11 px-2.5 text-sm",
    lg: "h-12 min-w-14 px-3 text-lg",
  } as const;

  return (
    <span
      aria-label={`Blood group ${group}`}
      className={cn(
        "inline-flex items-center justify-center rounded-xl border font-display font-extrabold tracking-tight",
        BLOOD_GROUP_TONES[group],
        sizes[size],
        className,
      )}
    >
      {group}
    </span>
  );
}

export function UrgencyBadge({ urgency, className }: { urgency: Urgency; className?: string }) {
  const tone: Tone =
    urgency === "emergency" ? "danger" : urgency === "urgent" ? "warning" : "neutral";
  const Icon = urgency === "emergency" ? ShieldAlert : urgency === "urgent" ? Clock : CalendarClock;
  return (
    <Pill tone={tone} className={cn(urgency === "emergency" && "pulse-ring", className)}>
      <Icon className="size-3.5" aria-hidden="true" />
      {URGENCY_LABELS[urgency]}
    </Pill>
  );
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const tone: Tone =
    status === "fulfilled"
      ? "success"
      : status === "open"
        ? "primary"
        : status === "in_progress"
          ? "info"
          : status === "removed"
            ? "danger"
            : "neutral";
  return <Pill tone={tone}>{REQUEST_STATUS_LABELS[status]}</Pill>;
}

export function ResponseStatusBadge({ status }: { status: ResponseStatus }) {
  const tone: Tone =
    status === "accepted" || status === "completed"
      ? "success"
      : status === "pending"
        ? "warning"
        : "neutral";
  return <Pill tone={tone}>{RESPONSE_STATUS_LABELS[status]}</Pill>;
}

export function AvailabilityBadge({ availability }: { availability: Availability | null }) {
  if (!availability) return <Pill tone="neutral">Availability not set</Pill>;
  return <Pill tone={AVAILABILITY_TONES[availability]}>{AVAILABILITY_LABELS[availability]}</Pill>;
}

export function VerificationBadge({
  status,
  label,
  compact = false,
}: {
  status: VerificationStatus;
  label?: string | null;
  compact?: boolean;
}) {
  const Icon =
    status === "verified"
      ? BadgeCheck
      : status === "pending"
        ? Clock
        : status === "rejected"
          ? AlertTriangle
          : ShieldCheck;
  return (
    <Pill tone={VERIFICATION_TONES_SAFE(status)}>
      <Icon className="size-3.5" aria-hidden="true" />
      {compact ? VERIFICATION_LABELS[status] : (label ?? VERIFICATION_LABELS[status])}
    </Pill>
  );
}

function VERIFICATION_TONES_SAFE(status: VerificationStatus): Tone {
  switch (status) {
    case "verified":
      return "success";
    case "pending":
      return "warning";
    case "rejected":
      return "danger";
    default:
      return "neutral";
  }
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <Pill tone="info" className={cn("uppercase", className)}>
      <Sparkles className="size-3" aria-hidden="true" />
      Demo data
    </Pill>
  );
}

export function RequestTypeBadge({ type }: { type: RequestType }) {
  const label =
    type === "blood" ? "Blood" : type === "platelets" ? "Platelets" : "Medical assistance";
  const Icon = type === "medical_assistance" ? HeartPulse : undefined;
  return (
    <Pill tone={type === "platelets" ? "info" : "primary"}>
      {Icon ? <Icon className="size-3.5" aria-hidden="true" /> : null}
      {label}
    </Pill>
  );
}

export function LocationLine({
  city,
  area,
  distance,
  className,
}: {
  city: string;
  area?: string | null;
  distance?: string | null;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-sm text-muted-foreground", className)}
    >
      <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
      <span className="truncate">
        {[area, city].filter(Boolean).join(", ")}
        {distance ? ` · ${distance}` : ""}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Layout helpers                                                      */
/* ------------------------------------------------------------------ */

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow ? (
        <p className="mb-3 text-xs font-bold tracking-[0.16em] text-primary uppercase">{eyebrow}</p>
      ) : null}
      <h2 className="font-display text-[1.6rem] leading-tight font-extrabold text-balance sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-base leading-relaxed text-muted-foreground text-pretty">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4",
        className,
      )}
    >
      <div className="space-y-2">
        <h1 className="font-display text-[1.4rem] leading-tight font-extrabold sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      {children}
    </header>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: LucideIcon;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={cn("surface surface-hover h-full p-3.5 sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase sm:text-xs">
          {label}
        </p>
        {Icon ? (
          <span
            className={cn("grid size-9 place-items-center rounded-xl border", TONE_CLASSES[tone])}
          >
            <Icon className="size-4" aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 font-display text-xl font-extrabold sm:mt-2 sm:text-3xl">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function InfoNote({
  title,
  children,
  tone = "info",
  icon: Icon,
  className,
}: {
  title?: ReactNode;
  children: ReactNode;
  tone?: Tone;
  icon?: LucideIcon;
  className?: string;
}) {
  const FallbackIcon =
    tone === "danger" || tone === "blood" ? ShieldAlert : tone === "warning" ? AlertTriangle : Info;
  const ResolvedIcon = Icon ?? FallbackIcon;
  return (
    <div
      role="note"
      className={cn(
        "flex gap-3 rounded-2xl border p-4 text-sm leading-relaxed",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <ResolvedIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className="text-pretty opacity-95">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon = HeartPulse,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "surface flex flex-col items-center justify-center gap-3 px-5 py-9 text-center sm:px-6 sm:py-14",
        className,
      )}
    >
      <span className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <h3 className="font-display text-lg font-bold">{title}</h3>
      {description ? (
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "We could not load this",
  description,
  onRetry,
  className,
}: {
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn("surface border-destructive/30 bg-destructive/5 p-6 text-center", className)}
      role="alert"
    >
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-5" aria-hidden="true" />
      </span>
      <h3 className="mt-3 font-display text-lg font-bold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {description ?? "Something went wrong while fetching data. Please try again."}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover"
        >
          <Loader2 className="size-4" aria-hidden="true" />
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("surface space-y-4 p-4 sm:p-5", className)} aria-hidden="true">
      <div className="flex items-center justify-between gap-3">
        <div className="skeleton-shimmer h-6 w-32 rounded-full" />
        <div className="skeleton-shimmer h-9 w-11 rounded-xl" />
      </div>
      <div className="skeleton-shimmer h-5 w-3/4 rounded-full" />
      <div className="skeleton-shimmer h-4 w-1/2 rounded-full" />
      <div className="skeleton-shimmer h-10 w-full rounded-xl" />
    </div>
  );
}

export function SkeletonGrid({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div
      className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-3", className)}
      aria-busy="true"
      aria-live="polite"
    >
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
      <span className="sr-only">Loading requests…</span>
    </div>
  );
}

export function SkeletonLines({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)} aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="skeleton-shimmer h-4 rounded-full"
          style={{ width: `${90 - index * 8}%` }}
        />
      ))}
    </div>
  );
}

export function InlineSpinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin", className)} aria-hidden="true" />;
}

export function SuccessNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 p-3 text-sm text-success",
        className,
      )}
    >
      <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Motion                                                             */
/* ------------------------------------------------------------------ */

export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "article" | "li";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -60px 0px", threshold: 0.05 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={cn(
        "transition-[opacity,transform] duration-700 ease-out",
        // `will-change` is only useful while the element is still waiting to
        // animate; keeping it afterwards pins a compositor layer for nothing.
        visible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0 will-change-transform",
        className,
      )}
      style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }}
    >
      {children}
    </Tag>
  );
}

export { TONE_CLASSES };
