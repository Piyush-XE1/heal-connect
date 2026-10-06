import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarClock,
  Check,
  Droplet,
  Eye,
  MapPin,
  Pencil,
  PhoneCall,
  RefreshCw,
  ShieldCheck,
  Siren,
  Trash2,
  Undo2,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { BlockUserButton, ConfirmDialog, ReportButton } from "@/components/common/dialogs";
import {
  BloodGroupChip,
  DemoBadge,
  EmptyState,
  ErrorState,
  InfoNote,
  Pill,
  RequestStatusBadge,
  ResponseStatusBadge,
  SkeletonCard,
  SkeletonLines,
  UrgencyBadge,
  VerificationBadge,
} from "@/components/common/primitives";
import { MatchDisclosure } from "@/components/requests/request-card";
import { RespondDialog } from "@/components/requests/respond-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/components/providers/auth-provider";
import {
    EMERGENCY_DISCLAIMER,
  MEDICAL_DISCLAIMER,
  PAYMENT_PROHIBITION,
  SAFETY_RULES,
} from "@/lib/brand";
import { COMPATIBILITY_DISCLAIMER } from "@/lib/blood";
import { dueLabel, formatDate, formatDateTime, maskPhone, relativeTime } from "@/lib/format";
import { distanceBand } from "@/lib/geo";
import { REQUEST_STATUS_LABELS, REQUEST_TYPE_LABELS } from "@/lib/labels";
import { invalidationGroups, queryKeys } from "@/lib/query-keys";
import { errorMessage, unwrapAction } from "@/lib/actions";
import {
  fetchRequest,
  updateRequestStatus,
  type RequestSearchItem,
} from "@/server/api/requests";
import { updateResponseStatus, withdrawResponse } from "@/server/api/responses";

export const Route = createFileRoute("/_app/requests/$requestId/")({
  head: () => ({
    meta: [
      { title: "Request details — Heal Connect" },
      { name: "description", content: "Coordination details, donor offers and status for a Heal Connect request." },
    ],
  }),
  component: RequestDetailPage,
});

function RequestDetailPage() {
  const { requestId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [respondOpen, setRespondOpen] = useState(false);
  const [declineNote, setDeclineNote] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.request(requestId),
    queryFn: async () => unwrapAction(await fetchRequest({ data: { id: requestId } })),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.request(requestId) });
    for (const key of invalidationGroups.afterResponseChange) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  };

  const respondMutation = useMutation({
    mutationFn: async (id: string) =>
      unwrapAction(await withdrawResponse({ data: { id } })),
    onSuccess: () => {
      toast.success("Offer withdrawn", {
        description: "The coordinator has been notified. Thank you for letting them know.",
      });
      invalidate();
    },
    onError: (error) => toast.error("Could not withdraw", { description: errorMessage(error) }),
  });

  const responseStatus = useMutation({
    mutationFn: async (input: { id: string; status: "accepted" | "declined" | "completed"; note?: string }) =>
      unwrapAction(await updateResponseStatus({ data: input })),
    onSuccess: (_result, variables) => {
      const messages: Record<string, string> = {
        accepted: "Donor confirmed. Coordination details are now visible to them.",
        declined: "Offer closed. The donor has been notified politely.",
        completed: "Donation recorded. Thank you for closing the loop.",
      };
      toast.success(messages[variables.status] ?? "Offer updated");
      invalidate();
    },
    onError: (error) => toast.error("Could not update the offer", { description: errorMessage(error) }),
  });

  const statusMutation = useMutation({
    mutationFn: async (status: "in_progress" | "fulfilled" | "cancelled" | "open") =>
      unwrapAction(await updateRequestStatus({ data: { id: requestId, status } })),
    onSuccess: (_result, status) => {
      toast.success(
        status === "cancelled"
          ? "Request cancelled"
          : status === "fulfilled"
            ? "Request marked as fulfilled"
            : status === "open"
              ? "Request reopened"
              : "Request marked in progress",
      );
      invalidate();
      void queryClient.invalidateQueries({ queryKey: queryKeys.myRequests });
    },
    onError: (error) => toast.error("Could not update the request", { description: errorMessage(error) }),
  });

  if (isLoading) {
    return (
      <div className="page-shell max-w-4xl space-y-4 py-8">
        <SkeletonCard />
        <SkeletonLines count={6} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="page-shell max-w-3xl py-10">
        <ErrorState
          title="This request is not available"
          description="It may have been cancelled, resolved, or removed by moderators."
          onRetry={() => void refetch()}
        />
        <div className="mt-4 flex justify-center">
          <Button asChild variant="outline">
            <Link to="/find-help">Browse open requests</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { request, responses, match, isOwner, isAdmin, canRespond } = data;
  const isEmergency = request.urgency === "emergency";
  const matchItem: RequestSearchItem = { ...request, match, isOwn: isOwner };

  return (
    <div className="page-shell max-w-4xl space-y-6 py-8">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/find-help">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to requests
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="neutral">{request.reference}</Pill>
          {request.isDemo ? <DemoBadge /> : null}
        </div>
      </div>

      {request.status === "removed" ? (
        <InfoNote tone="danger" icon={ShieldCheck} title="Removed by moderators">
          This request was removed and is only visible to the requester and moderators.
        </InfoNote>
      ) : null}

      {/* Header card */}
      <section
        className={`surface space-y-5 p-6 ${isEmergency ? "border-destructive/40" : ""}`}
        aria-labelledby="request-title"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <UrgencyBadge urgency={request.urgency} />
              <RequestStatusBadge status={request.status} />
              <Pill tone="info">{REQUEST_TYPE_LABELS[request.requestType]}</Pill>
            </div>
            <h1 id="request-title" className="font-display text-2xl leading-tight font-extrabold text-balance">
              {isEmergency ? "Emergency: " : ""}
              {request.bloodGroup
                ? `${request.bloodGroup} ${request.requestType} required`
                : REQUEST_TYPE_LABELS[request.requestType]}
            </h1>
            <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <span className="inline-flex items-center gap-2">
                <Building2 className="size-4 text-primary" aria-hidden="true" />
                {request.hospitalName}
              </span>
              <span className="inline-flex items-center gap-2">
                <MapPin className="size-4 text-primary" aria-hidden="true" />
                {[request.area, request.city].filter(Boolean).join(", ")}
                {request.distanceKm != null ? ` · ${distanceBand(request.distanceKm)}` : ""}
              </span>
              <span className="inline-flex items-center gap-2">
                <Droplet className="size-4 text-blood" aria-hidden="true" />
                {request.unitsFulfilled}/{request.unitsRequired} units fulfilled
              </span>
              <span className="inline-flex items-center gap-2">
                <CalendarClock className="size-4 text-primary" aria-hidden="true" />
                {dueLabel(request.requiredBy)} · {formatDate(request.requiredBy)}
              </span>
              <span className="inline-flex items-center gap-2">
                <Users className="size-4 text-primary" aria-hidden="true" />
                {request.responseCount} donor offer{request.responseCount === 1 ? "" : "s"}
              </span>
              <span className="inline-flex items-center gap-2">
                <RefreshCw className="size-4 text-primary" aria-hidden="true" />
                Posted {relativeTime(request.createdAt)}
              </span>
            </div>
          </div>
          <BloodGroupChip group={request.bloodGroup} size="lg" />
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Pill tone={request.requesterVerified ? "success" : "neutral"}>
            <BadgeCheck className="size-3.5" aria-hidden="true" />
            {request.requesterVerified ? "Verified requester" : "Self-reported information"}
          </Pill>
          <Pill tone="neutral">Requester: {request.requesterName}</Pill>
          {user?.id && !isOwner ? (
            <BlockUserButton userId={request.requesterId} name={request.requesterName} blocked={false} />
          ) : null}
          {!isOwner ? <ReportButton targetType="request" targetId={request.id} /> : null}
        </div>

        {request.additionalInfo ? (
          <div className="space-y-2 rounded-2xl bg-muted/50 p-4">
            <h2 className="font-display text-sm font-bold">Additional information</h2>
            <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
              {request.additionalInfo}
            </p>
          </div>
        ) : null}

        {request.status === "fulfilled" && request.resolvedAt ? (
          <InfoNote tone="success" icon={Check} title="This request is fulfilled">
            Marked fulfilled on {formatDate(request.resolvedAt)}. Thank you to everyone who offered help.
          </InfoNote>
        ) : null}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          {canRespond ? (
            <>
              <Button
                className={isEmergency ? "gradient-life text-white hover:opacity-95" : undefined}
                onClick={() => setRespondOpen(true)}
              >
                <Droplet className="size-4" aria-hidden="true" />
                I can help
              </Button>
              <p className="w-full text-xs text-muted-foreground">
                Offering help does not confirm a medical match — the hospital blood bank confirms compatibility and
                eligibility.
              </p>
            </>
          ) : null}

          {request.myResponseStatus ? (
            <Pill tone="info" className="px-3 py-2">
              Your offer: {request.myResponseStatus.replace(/_/g, " ")}
            </Pill>
          ) : null}

          {isOwner ? (
            <>
              <Button asChild variant="outline">
                <Link to="/requests/$requestId/edit" params={{ requestId: request.id }}>
                  <Pencil className="size-4" aria-hidden="true" />
                  Edit request
                </Link>
              </Button>
              {request.status === "open" || request.status === "expired" ? (
                <Button
                  variant="outline"
                  onClick={() => statusMutation.mutate("in_progress")}
                  disabled={statusMutation.isPending}
                >
                  Mark in progress
                </Button>
              ) : null}
              {request.status !== "fulfilled" ? (
                <ConfirmDialog
                  title="Mark this request as fulfilled?"
                  description="Donors who offered help will be notified and their offers will be closed. You can reopen it later if needed."
                  confirmLabel="Mark fulfilled"
                  onConfirm={async () => {
                    await statusMutation.mutateAsync("fulfilled");
                  }}
                  trigger={
                    <Button variant="outline">
                      <Check className="size-4" aria-hidden="true" />
                      Mark fulfilled
                    </Button>
                  }
                />
              ) : (
                <Button variant="outline" onClick={() => statusMutation.mutate("open")}>
                  <Undo2 className="size-4" aria-hidden="true" />
                  Reopen request
                </Button>
              )}
              {request.status !== "cancelled" ? (
                <ConfirmDialog
                  title="Cancel this request?"
                  description="Donors who offered help will be notified that no further action is needed. This cannot be undone, but you can raise a new request any time."
                  confirmLabel="Cancel request"
                  destructive
                  onConfirm={async () => {
                    await statusMutation.mutateAsync("cancelled");
                  }}
                  trigger={
                    <Button variant="ghost" className="text-destructive hover:text-destructive">
                      <Trash2 className="size-4" aria-hidden="true" />
                      Cancel request
                    </Button>
                  }
                />
              ) : null}
            </>
          ) : null}
        </div>
      </section>

      {/* Contact / coordination */}
      <section className="space-y-3" aria-labelledby="coordination-heading">
        <h2 id="coordination-heading" className="font-display text-lg font-extrabold">
          Coordination
        </h2>
        {request.contact ? (
          <div className="surface space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 font-semibold">
                <PhoneCall className="size-4 text-primary" aria-hidden="true" />
                {request.contact.name}
              </p>
              <Pill tone="success"><Eye className="size-3.5" aria-hidden="true" /> Visible to you</Pill>
            </div>
            <p className="text-sm text-muted-foreground">
              {request.contact.phone || "Phone number not shared"}
            </p>
            {request.contact.instructions ? (
              <p className="text-sm text-muted-foreground">{request.contact.instructions}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Unlocked because: {request.contact.unlockedBy.replace(/_/g, " ")}. Never share money, ID documents or
              bank details with anyone you met here.
            </p>
          </div>
        ) : (
          <InfoNote tone="primary" icon={ShieldCheck} title="Contact details are protected">
            The requester's name and number are shared only with the requester themselves, a moderator, or a donor
            whose offer has been accepted. Until then, coordination happens through the platform.
          </InfoNote>
        )}
      </section>

      {/* Donor offers (owner/admin) */}
      {isOwner || isAdmin ? (
        <section className="space-y-3" aria-labelledby="offers-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="offers-heading" className="font-display text-lg font-extrabold">
              Donor offers
            </h2>
            <Pill tone={responses.some((r) => r.status === "pending") ? "warning" : "neutral"}>
              {responses.filter((r) => r.status === "pending").length} awaiting your confirmation
            </Pill>
          </div>

          {responses.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No offers yet"
              description="We notify matching donors as soon as your request is published. You can also share the reference with people you trust."
            />
          ) : (
            <ul className="space-y-3">
              {responses.map((offer) => (
                <li key={offer.id} className="surface space-y-3 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <BloodGroupChip group={offer.donorBloodGroup ?? null} size="sm" />
                      <p className="font-semibold">{offer.donorName}</p>
                      {offer.donorVerified ? (
                        <Pill tone="success">
                          <BadgeCheck className="size-3.5" aria-hidden="true" />
                          Verified
                        </Pill>
                      ) : null}
                      <ResponseStatusBadge status={offer.status} />
                    </div>
                    <span className="text-xs text-muted-foreground">{relativeTime(offer.createdAt)}</span>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {offer.donorCity ? `${offer.donorCity} · ` : ""}
                    {offer.donorBloodGroup ?? "Group not provided"} · phone {maskPhone(offer.contact?.phone)}
                  </p>

                  {offer.message ? (
                    <p className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">“{offer.message}”</p>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    {offer.status === "pending" ? (
                      <>
                        <Button
                          size="sm"
                          disabled={responseStatus.isPending}
                          onClick={() => responseStatus.mutate({ id: offer.id, status: "accepted" })}
                        >
                          <Check className="size-4" aria-hidden="true" />
                          Accept offer
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={responseStatus.isPending}
                          onClick={() =>
                            responseStatus.mutate({
                              id: offer.id,
                              status: "declined",
                              ...(declineNote.trim() ? { note: declineNote.trim() } : {}),
                            })
                          }
                        >
                          Not needed
                        </Button>
                      </>
                    ) : null}
                    {offer.status === "accepted" ? (
                      <Button
                        size="sm"
                        disabled={responseStatus.isPending}
                        onClick={() => responseStatus.mutate({ id: offer.id, status: "completed" })}
                      >
                        <Check className="size-4" aria-hidden="true" />
                        Mark donation completed
                      </Button>
                    ) : null}
                    {offer.contact?.phone ? (
                      <Button asChild size="sm" variant="outline">
                        <a href={`tel:${offer.contact.phone.replace(/\s/g, "")}`}>
                          <PhoneCall className="size-4" aria-hidden="true" />
                          Call {maskPhone(offer.contact.phone)}
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {responses.some((offer) => offer.status === "pending") ? (
            <div className="surface space-y-2 p-4">
              <label htmlFor="decline-note" className="text-sm font-semibold">
                Optional note when declining an offer
              </label>
              <Textarea
                id="decline-note"
                rows={2}
                maxLength={300}
                value={declineNote}
                onChange={(event) => setDeclineNote(event.target.value)}
                placeholder="e.g. Another donor is already booked by the blood bank — thank you."
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Match reasoning for donors */}
      {!isOwner && match ? (
        <section className="space-y-3" aria-labelledby="match-heading">
          <h2 id="match-heading" className="font-display text-lg font-extrabold">
            Why this request was shown to you
          </h2>
          <MatchDisclosure match={match} />
          {match.blockers.length > 0 ? (
            <InfoNote tone="warning" icon={ShieldCheck} title="This request is not a fit for your profile">
              {match.blockers.join(" ")}
            </InfoNote>
          ) : null}
        </section>
      ) : null}

      {/* Donor's own offer controls */}
      {request.myResponseStatus === "pending" || request.myResponseStatus === "accepted" ? (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-extrabold">Your offer</h2>
          <div className="surface space-y-3 p-5">
            <p className="text-sm text-muted-foreground">
              Your offer is {request.myResponseStatus === "accepted" ? "accepted — please coordinate with the contact above." : "waiting for the coordinator to confirm."}
            </p>
            {responses
              .filter((offer) => offer.donorId === user?.id)
              .map((mine) => (
                <ConfirmDialog
                  key={mine.id}
                  title="Withdraw your offer?"
                  description="The coordinator will be notified that you can no longer help. You can offer again later if the request is still open."
                  confirmLabel="Withdraw offer"
                  destructive
                  onConfirm={async () => {
                    await respondMutation.mutateAsync(mine.id);
                  }}
                  trigger={
                    <Button variant="outline" className="text-destructive hover:text-destructive">
                      <Trash2 className="size-4" aria-hidden="true" />
                      Withdraw my offer
                    </Button>
                  }
                />
              ))}
          </div>
        </section>
      ) : null}

      {/* Status timeline */}
      <section className="space-y-3" aria-labelledby="status-heading">
        <h2 id="status-heading" className="font-display text-lg font-extrabold">
          Status timeline
        </h2>
        <ol className="surface divide-y divide-border">
          {[
            { label: `Request published (${REQUEST_STATUS_LABELS["open"]})`, at: request.createdAt },
            ...(request.status === "in_progress"
              ? [{ label: "Donor accepted — coordination in progress", at: request.updatedAt }]
              : []),
            ...(request.resolvedAt
              ? [{ label: `Marked ${REQUEST_STATUS_LABELS[request.status]}`, at: request.resolvedAt }]
              : []),
            { label: "Last updated", at: request.updatedAt },
          ].map((entry, index) => (
            <li key={`${entry.label}-${index}`} className="flex items-center justify-between gap-4 p-4 text-sm">
              <span>{entry.label}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(entry.at)}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Safety */}
      <section className="grid gap-3 lg:grid-cols-2">
        <InfoNote tone="danger" icon={Siren} title="Emergency guidance">
          {EMERGENCY_DISCLAIMER}
        </InfoNote>
        <InfoNote tone="info" icon={ShieldCheck} title="Safety checklist">
          <ul className="list-disc space-y-1 pl-4">
            {SAFETY_RULES.slice(0, 4).map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </InfoNote>
        <InfoNote tone="warning" title="Compatibility is general information">
          {COMPATIBILITY_DISCLAIMER}
        </InfoNote>
        <InfoNote tone="neutral" title="What we do not do">
          {MEDICAL_DISCLAIMER} {PAYMENT_PROHIBITION}
        </InfoNote>
      </section>

      <RespondDialog item={matchItem} open={respondOpen} onOpenChange={setRespondOpen} />
      <div className="flex justify-center pb-4">
        <Button asChild variant="ghost">
          <Link to="/find-help">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to all requests
          </Link>
        </Button>
      </div>
    </div>
  );
}
