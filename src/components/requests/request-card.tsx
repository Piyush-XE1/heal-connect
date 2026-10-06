import { Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  Building2,
  CalendarClock,
  ChevronDown,
  Droplet,
  Heart,
  Info,
  MapPin,
  MessageCircle,
  Users,
} from "lucide-react";

import { ReportDialog } from "@/components/common/dialogs";
import {
  BloodGroupChip,
  DemoBadge,
  Pill,
  RequestStatusBadge,
  RequestTypeBadge,
  UrgencyBadge,
} from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import type { RequestSearchItem } from "@/server/api/requests";
import { dueLabel, formatDate, pluralize, relativeTime } from "@/lib/format";
import { distanceBand, formatDistance } from "@/lib/geo";
import { REQUEST_TYPE_SHORT_LABELS, URGENCY_LABELS } from "@/lib/labels";
import type { MatchResult } from "@/lib/matching";
import { cn } from "@/lib/utils";

export function matchHeadline(item: RequestSearchItem): string {
  const type = REQUEST_TYPE_SHORT_LABELS[item.requestType];
  if (item.requestType === "medical_assistance") {
    return `${URGENCY_LABELS[item.urgency]} medical assistance needed`;
  }
  const group = item.bloodGroup ?? "compatible";
  return `${URGENCY_LABELS[item.urgency]} ${group} ${type.toLowerCase()} required`;
}

export function RequestCard({
  item,
  onRespond,
  showMatch = true,
  compact = false,
  className,
}: {
  item: RequestSearchItem;
  onRespond?: (item: RequestSearchItem) => void;
  showMatch?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const isEmergency = item.urgency === "emergency";
  const hasResponded = Boolean(item.myResponseStatus);
  const canRespond = item.status === "open" && !item.isOwn && !hasResponded;
  const detailHref = { to: "/requests/$requestId", params: { requestId: item.id } } as const;

  return (
    <article
      className={cn(
        "surface surface-hover flex h-full flex-col gap-4 p-5",
        isEmergency &&
          "border-destructive/40 shadow-[0_0_0_1px_color-mix(in_oklab,var(--destructive)_18%,transparent)]",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <UrgencyBadge urgency={item.urgency} />
          <RequestTypeBadge type={item.requestType} />
          {item.status !== "open" ? <RequestStatusBadge status={item.status} /> : null}
        </div>
        <BloodGroupChip group={item.bloodGroup} />
      </header>

      <div className="space-y-2">
        <h3 className="font-display text-lg leading-snug font-bold text-balance">
          {matchHeadline(item)}
        </h3>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate">{item.hospitalName}</span>
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
            {[item.area, item.city].filter(Boolean).join(", ")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Droplet className="size-4 shrink-0 text-blood" aria-hidden="true" />
            {item.unitsRequired} {pluralize(item.unitsRequired, "unit")}
            {item.unitsFulfilled > 0 ? ` · ${item.unitsFulfilled} fulfilled` : ""}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="size-4 shrink-0 text-primary" aria-hidden="true" />
            {dueLabel(item.requiredBy)}
          </span>
          {item.distanceKm != null ? (
            <span className="inline-flex items-center gap-1.5 text-xs">
              {formatDistance(item.distanceKm)}
            </span>
          ) : null}
        </div>
      </div>

      {!compact ? (
        <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {item.additionalInfo ??
            "No additional notes were provided. Coordinate through the hospital blood bank."}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Pill tone={item.requesterVerified ? "success" : "neutral"}>
          <BadgeCheck className="size-3.5" aria-hidden="true" />
          {item.requesterVerified ? "Verified requester" : "Self-reported"}
        </Pill>
        <Pill tone="neutral">
          <Users className="size-3.5" aria-hidden="true" />
          {item.responseCount} {pluralize(item.responseCount, "offer")}
        </Pill>
        <Pill tone="neutral">{item.reference}</Pill>
        {item.isDemo ? <DemoBadge /> : null}
      </div>

      {showMatch &&
      item.match &&
      (item.match.cautions.length > 0 || item.match.breakdown.length > 0) ? (
        <MatchDisclosure match={item.match} />
      ) : null}

      <footer className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-4">
        {canRespond ? (
          <Button
            className={cn(
              "flex-1 sm:flex-none",
              isEmergency && "gradient-life text-white hover:opacity-95",
            )}
            onClick={() => onRespond?.(item)}
            disabled={!onRespond}
          >
            <Heart className="size-4" aria-hidden="true" />I can help
          </Button>
        ) : null}

        {hasResponded ? (
          <Pill tone="info" className="px-3 py-2">
            You offered to help · {item.myResponseStatus?.replace(/_/g, " ")}
          </Pill>
        ) : null}

        {item.isOwn ? (
          <Pill tone="primary" className="px-3 py-2">
            Your request
          </Pill>
        ) : null}

        <Button asChild variant="ghost" className="rounded-full">
          <Link {...detailHref}>View details</Link>
        </Button>

        {!item.isOwn ? (
          <ReportDialog
            targetType="request"
            targetId={item.id}
            label="Report"
            trigger={
              <Button variant="ghost" size="icon" aria-label={`Report request ${item.reference}`}>
                <Info className="size-4" aria-hidden="true" />
              </Button>
            }
          />
        ) : null}

        <span className="ml-auto text-[11px] text-muted-foreground">
          Posted {relativeTime(item.createdAt)}
        </span>
      </footer>
    </article>
  );
}

export function MatchDisclosure({ match }: { match: MatchResult }) {
  return (
    <details className="group rounded-2xl border border-border bg-muted/40 p-3 text-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold">
        <span className="inline-flex items-center gap-2">
          <MessageCircle className="size-4 text-primary" aria-hidden="true" />
          Why this is shown to you
          <span className="text-xs font-normal text-muted-foreground">
            ({match.score}/100 match score)
          </span>
        </span>
        <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden="true" />
      </summary>
      <ul className="mt-3 space-y-1.5">
        {match.breakdown.map((entry) => (
          <li key={entry.label} className="flex items-start justify-between gap-3 text-xs">
            <span className="text-muted-foreground">
              <span className="font-semibold text-foreground">{entry.label}:</span> {entry.detail}
            </span>
            <span className="shrink-0 font-bold text-muted-foreground">
              {entry.points}/{entry.max}
            </span>
          </li>
        ))}
      </ul>
      {match.cautions.length > 0 ? (
        <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
          {match.cautions.map((caution) => (
            <li key={caution} className="flex items-start gap-2 text-xs text-warning-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {caution}
            </li>
          ))}
        </ul>
      ) : null}
      {match.blockers.length > 0 ? (
        <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
          {match.blockers.map((blocker) => (
            <li key={blocker} className="text-xs text-destructive">
              {blocker}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-3 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
        Match score is a relevance ranking only — it is not a medical decision. Compatibility,
        screening and eligibility are confirmed by qualified medical professionals and the blood
        bank.
      </p>
    </details>
  );
}

export function RequestCardMini({ item }: { item: RequestSearchItem }) {
  return (
    <Link
      {...{ to: "/requests/$requestId", params: { requestId: item.id } }}
      className="surface surface-hover flex items-center gap-3 p-3"
    >
      <BloodGroupChip group={item.bloodGroup} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{matchHeadline(item)}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {item.hospitalName} · {item.city} · {dueLabel(item.requiredBy)}
        </span>
      </span>
      <UrgencyBadge urgency={item.urgency} className="shrink-0" />
    </Link>
  );
}

export { formatDate, distanceBand };
