import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  Check,
  ClipboardList,
  Droplet,
  FileText,
  MapPin,
  Pencil,
  Plus,
  Send,
  Trash2,
  Undo2,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/dialogs";
import {
  BloodGroupChip,
  EmptyState,
  ErrorState,
  InfoNote,
  PageHeader,
  Pill,
  RequestStatusBadge,
  SkeletonCard,
  StatTile,
  UrgencyBadge,
} from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dueLabel, formatDate, relativeTime } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { errorMessage, unwrapAction } from "@/lib/actions";
import { fetchMyRequests, updateRequestStatus } from "@/server/api/requests";

export const Route = createFileRoute("/_app/my-requests")({
  head: () => ({
    meta: [
      { title: "My requests — Heal Connect" },
      { name: "description", content: "Track, edit and close the requests you raised." },
    ],
  }),
  component: MyRequestsPage,
});

function MyRequestsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("active");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.myRequests,
    queryFn: async () => unwrapAction(await fetchMyRequests()),
  });

  const statusMutation = useMutation({
    mutationFn: async (input: { id: string; status: "fulfilled" | "cancelled" | "open" }) =>
      unwrapAction(await updateRequestStatus({ data: input })),
    onSuccess: (_result, variables) => {
      toast.success(
        variables.status === "fulfilled"
          ? "Request marked as fulfilled"
          : variables.status === "cancelled"
            ? "Request cancelled"
            : "Request reopened",
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.myRequests });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications("all") });
    },
    onError: (error) => toast.error("Could not update the request", { description: errorMessage(error) }),
  });

  const publishMutation = useMutation({
    mutationFn: async (id: string) => unwrapAction(await updateRequestStatus({ data: { id, status: "open" } })),
    onSuccess: (_result, id) => {
      toast.success("Draft published", {
        description: "Matching donors nearby will be notified. You can track offers here.",
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.myRequests });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      void queryClient.invalidateQueries({ queryKey: ["request", id] });
    },
    onError: (error) => toast.error("Could not publish the draft", { description: errorMessage(error) }),
  });

  const renderList = (items: NonNullable<typeof data>["active"]) => (
    <ul className="space-y-4">
      {items.map((request) => (
        <li key={request.id} className="surface space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <UrgencyBadge urgency={request.urgency} />
              <RequestStatusBadge status={request.status} />
              <Pill tone="neutral">{request.reference}</Pill>
            </div>
            <BloodGroupChip group={request.bloodGroup} size="sm" />
          </div>

          <div>
            <h3 className="font-display text-lg font-bold">
              {request.hospitalName}
              <span className="text-muted-foreground"> · {request.city}</span>
            </h3>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" aria-hidden="true" />
                {request.area ?? "Area not specified"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-3.5" aria-hidden="true" />
                {dueLabel(request.requiredBy)} ({formatDate(request.requiredBy)})
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Droplet className="size-3.5" aria-hidden="true" />
                {request.unitsFulfilled}/{request.unitsRequired} units fulfilled
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-3.5" aria-hidden="true" />
                {request.responseCount} offers
              </span>
              <span>Updated {relativeTime(request.updatedAt)}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {request.status === "draft" ? (
              <Pill tone="warning">
                <FileText className="size-3.5" aria-hidden="true" />
                Private draft — not visible to donors yet
              </Pill>
            ) : (
              <>
                <Pill tone={request.pendingResponses > 0 ? "warning" : "neutral"}>
                  {request.pendingResponses} awaiting confirmation
                </Pill>
                <Pill tone="success">{request.acceptedResponses} accepted donors</Pill>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button asChild size="sm" variant="outline">
              <Link to="/requests/$requestId" params={{ requestId: request.id }}>
                Open request
              </Link>
            </Button>
            {request.status !== "cancelled" && request.status !== "removed" ? (
              <Button asChild size="sm" variant="ghost">
                <Link to="/requests/$requestId/edit" params={{ requestId: request.id }}>
                  <Pencil className="size-4" aria-hidden="true" />
                  {request.status === "draft" ? "Continue editing" : "Edit"}
                </Link>
              </Button>
            ) : null}
            {request.status === "draft" ? (
              <ConfirmDialog
                title="Publish this draft?"
                description="Donors whose group, distance and availability match will be notified. You can still edit or cancel the request afterwards."
                confirmLabel="Publish request"
                onConfirm={async () => {
                  await publishMutation.mutateAsync(request.id);
                }}
                trigger={
                  <Button size="sm">
                    <Send className="size-4" aria-hidden="true" />
                    Publish
                  </Button>
                }
              />
            ) : null}
            {request.status === "open" || request.status === "expired" ? (
              <ConfirmDialog
                title="Mark this request as fulfilled?"
                description="Donors who offered help will be notified and their offers closed. You can reopen it later."
                confirmLabel="Mark fulfilled"
                onConfirm={async () => {
                  await statusMutation.mutateAsync({ id: request.id, status: "fulfilled" });
                }}
                trigger={
                  <Button size="sm" variant="outline">
                    <Check className="size-4" aria-hidden="true" />
                    Fulfilled
                  </Button>
                }
              />
            ) : null}
            {request.status === "fulfilled" || request.status === "cancelled" || request.status === "expired" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => statusMutation.mutate({ id: request.id, status: "open" })}
                disabled={statusMutation.isPending}
              >
                <Undo2 className="size-4" aria-hidden="true" />
                Reopen
              </Button>
            ) : null}
            {request.status !== "cancelled" && request.status !== "removed" && request.status !== "draft" ? (
              <ConfirmDialog
                title="Cancel this request?"
                description="Donors who offered help will be notified that no further action is needed."
                confirmLabel="Cancel request"
                destructive
                onConfirm={async () => {
                  await statusMutation.mutateAsync({ id: request.id, status: "cancelled" });
                }}
                trigger={
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                    <Trash2 className="size-4" aria-hidden="true" />
                    Cancel
                  </Button>
                }
              />
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="page-shell space-y-6 py-8">
      <PageHeader
        title="My requests"
        description="Everything you raised, with the offers you have received and the actions available to you."
        actions={
          <Button asChild>
            <Link to="/requests/new">
              <Plus className="size-4" aria-hidden="true" />
              New request
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : isError || !data ? (
        <ErrorState description="We could not load your requests." onRetry={() => void refetch()} />
      ) : data.total === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="You have not raised any requests yet"
          description="When you need blood, platelets or practical medical assistance, a clear request reaches matching donors nearby in minutes."
          action={
            <Button asChild>
              <Link to="/requests/new">Raise your first request</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatTile label="Active" value={data.active.length} icon={ClipboardList} />
            <StatTile
              label="Awaiting confirmation"
              value={data.active.reduce((total, item) => total + item.pendingResponses, 0)}
              icon={Users}
              tone="warning"
            />
            <StatTile
              label="Accepted donors"
              value={data.active.reduce((total, item) => total + item.acceptedResponses, 0)}
              icon={Check}
              tone="success"
            />
            <StatTile label="Closed requests" value={data.past.length} icon={Undo2} tone="neutral" />
            <StatTile label="Drafts" value={data.drafts.length} icon={FileText} tone="warning" />
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="active">Active ({data.active.length})</TabsTrigger>
              <TabsTrigger value="drafts">Drafts ({data.drafts.length})</TabsTrigger>
              <TabsTrigger value="past">Past ({data.past.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="active" className="mt-4 space-y-4">
              {data.active.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title="No active requests"
                  description="Everything you raised is closed. You can reopen a request or raise a new one any time."
                />
              ) : (
                renderList(data.active)
              )}
            </TabsContent>
            <TabsContent value="drafts" className="mt-4 space-y-4">
              {data.drafts.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No drafts"
                  description="Drafts let you save a request before the hospital details are confirmed. Only you can see them until you publish."
                />
              ) : (
                <>
                  <InfoNote tone="info" title="Drafts are private">
                    Nothing is visible to donors until you publish. Publishing notifies matching donors immediately.
                  </InfoNote>
                  {renderList(data.drafts)}
                </>
              )}
            </TabsContent>
            <TabsContent value="past" className="mt-4 space-y-4">
              {data.past.length === 0 ? (
                <EmptyState
                  icon={Undo2}
                  title="No past requests yet"
                  description="Fulfilled, cancelled and expired requests will be listed here for your records."
                />
              ) : (
                renderList(data.past)
              )}
            </TabsContent>
          </Tabs>

          <InfoNote tone="info" title="Keeping requests accurate">
            Close a request as soon as the need is met — it stops donors from travelling unnecessarily. If the
            requirement changes, edit the request so everyone who offered help is updated automatically.
          </InfoNote>
        </>
      )}
    </div>
  );
}
