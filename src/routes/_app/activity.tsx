import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Bell,
  CheckCircle2,
  Droplet,
  Heart,
  History,
  MapPin,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/dialogs";
import {
  BloodGroupChip,
  EmptyState,
  ErrorState,
  InfoNote,
  PageHeader,
  Pill,
  ResponseStatusBadge,
  SkeletonCard,
  StatTile,
  UrgencyBadge,
} from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dueLabel, formatDate, formatUnits, relativeTime } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { errorMessage, unwrapAction } from "@/lib/actions";
import { fetchMyActivity, withdrawResponse } from "@/server/api/responses";
import type { DonorResponseView } from "@/lib/domain";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/activity")({
  head: () =>
    pageHead({
      title: "My activity — Heal Connect",
      description: "Offers you sent, their status, and your notification history.",
      noIndex: true,
    }),
  component: ActivityPage,
});

function ActivityPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.myActivity,
    queryFn: async () => unwrapAction(await fetchMyActivity()),
  });

  const withdraw = useMutation({
    mutationFn: async (id: string) => unwrapAction(await withdrawResponse({ data: { id } })),
    onSuccess: () => {
      toast.success("Offer withdrawn", { description: "The coordinator has been notified." });
      void queryClient.invalidateQueries({ queryKey: queryKeys.myActivity });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
    onError: (error) =>
      toast.error("Could not withdraw the offer", { description: errorMessage(error) }),
  });

  const renderOffer = (offer: DonorResponseView, showWithdraw: boolean) => (
    <li key={offer.id} className="surface space-y-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <UrgencyBadge urgency={offer.requestUrgency} />
          <ResponseStatusBadge status={offer.status} />
          <BloodGroupChip group={offer.requestBloodGroup} size="sm" />
        </div>
        <span className="text-xs text-muted-foreground">
          Offered {relativeTime(offer.createdAt)}
        </span>
      </div>

      <div>
        <h3 className="font-display text-base font-bold">
          {offer.requestHospitalName}
          <span className="text-muted-foreground"> · {offer.requestCity}</span>
        </h3>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5" aria-hidden="true" />
            {offer.requestReference}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Droplet className="size-3.5" aria-hidden="true" />
            {offer.requestType.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      {offer.message ? (
        <p className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
          “{offer.message}”
        </p>
      ) : null}

      {offer.status === "accepted" && offer.contact?.phone ? (
        <InfoNote tone="success" title="Coordination details unlocked">
          Speak to {offer.contact.name} on {offer.contact.phone}.{" "}
          {offer.contact.instructions ? `${offer.contact.instructions} ` : ""}
          Never share money, ID documents or bank details.
        </InfoNote>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button asChild size="sm" variant="outline">
          <Link to="/requests/$requestId" params={{ requestId: offer.requestId }}>
            Open request
          </Link>
        </Button>
        {showWithdraw ? (
          <ConfirmDialog
            title="Withdraw this offer?"
            description="The coordinator will be notified that you can no longer help. You can offer again later while the request is open."
            confirmLabel="Withdraw offer"
            destructive
            onConfirm={async () => {
              await withdraw.mutateAsync(offer.id);
            }}
            trigger={
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                <Trash2 className="size-4" aria-hidden="true" />
                Withdraw
              </Button>
            }
          />
        ) : null}
      </div>
    </li>
  );

  return (
    <div className="page-shell space-y-6 py-8">
      <PageHeader
        title="My activity"
        description="Every offer you sent, where it stands, and the notifications tied to it."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/notifications">
                <Bell className="size-4" aria-hidden="true" />
                Notifications
              </Link>
            </Button>
            <Button asChild>
              <Link to="/find-help">
                <Heart className="size-4" aria-hidden="true" />
                Find requests
              </Link>
            </Button>
          </>
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : isError || !data ? (
        <ErrorState description="We could not load your activity." onRetry={() => void refetch()} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Active offers" value={data.stats.active} icon={Heart} tone="blood" />
            <StatTile
              label="Awaiting confirmation"
              value={data.stats.pending}
              icon={Activity}
              tone="warning"
            />
            <StatTile
              label="Accepted"
              value={data.stats.accepted}
              icon={CheckCircle2}
              tone="info"
            />
            <StatTile
              label="Completed"
              value={data.stats.completed}
              hint="Marked done by the coordinator"
              icon={CheckCircle2}
              tone="success"
            />
          </div>

          <Tabs defaultValue="offers">
            <TabsList>
              <TabsTrigger value="offers">Active offers ({data.offers.length})</TabsTrigger>
              <TabsTrigger value="history">History ({data.history.length})</TabsTrigger>
              <TabsTrigger value="notifications">
                Notifications ({data.notifications.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="offers" className="mt-4">
              {data.offers.length === 0 ? (
                <EmptyState
                  icon={Heart}
                  title="No active offers"
                  description="When you offer to help with a request, it appears here so you can follow it up or withdraw it."
                  action={
                    <Button asChild>
                      <Link to="/find-help">Find a request to help with</Link>
                    </Button>
                  }
                />
              ) : (
                <ul className="space-y-4">
                  {data.offers.map((offer) => renderOffer(offer, true))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              {data.history.length === 0 ? (
                <EmptyState
                  icon={History}
                  title="No history yet"
                  description="Completed, declined and withdrawn offers are archived here."
                />
              ) : (
                <ul className="space-y-4">
                  {data.history.map((offer) => renderOffer(offer, false))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="notifications" className="mt-4">
              {data.notifications.length === 0 ? (
                <EmptyState
                  icon={Bell}
                  title="No notifications yet"
                  description="Matches, donor responses and verification updates will appear here."
                />
              ) : (
                <ol className="space-y-3">
                  {data.notifications.map((notification) => (
                    <li key={notification.id} className="surface flex gap-4 p-4">
                      <span
                        className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ${
                          notification.read
                            ? "bg-muted text-muted-foreground"
                            : "bg-primary-soft text-primary"
                        }`}
                      >
                        <Bell className="size-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold">{notification.title}</p>
                          {!notification.read ? <Pill tone="primary">New</Pill> : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{notification.body}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {relativeTime(notification.createdAt)}
                          {notification.link ? (
                            <>
                              {" · "}
                              <Link
                                to={notification.link}
                                className="font-semibold text-primary hover:underline"
                              >
                                Open
                              </Link>
                            </>
                          ) : null}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </TabsContent>
          </Tabs>

          {data.stats.completed > 0 ? (
            <InfoNote tone="success" title={`${formatUnits(data.stats.completed)} contributed`}>
              Thank you. Donation counts are based on what coordinators recorded here — your
              official donation record always lives with the blood bank or hospital.
            </InfoNote>
          ) : null}

          <InfoNote tone="info" title="What withdrawing means">
            Withdrawing an offer removes you from the match and notifies the coordinator. If you are
            unwell or cannot travel, withdrawing early is always better than not showing up.
          </InfoNote>
        </>
      )}
    </div>
  );
}
