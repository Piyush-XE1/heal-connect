import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing, CheckCheck, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  EmptyState,
  ErrorState,
  InfoNote,
  PageHeader,
  Pill,
  SkeletonLines,
  StatTile,
} from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NOTIFICATION_LABELS } from "@/lib/labels";
import { formatDateTime, relativeTime } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { errorMessage, unwrapAction } from "@/lib/actions";
import { listNotifications, markNotifications } from "@/server/api/notifications";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/notifications")({
  head: () =>
    pageHead({
      title: "Notifications — Heal Connect",
      description: "Matching requests, donor responses, request updates and verification news.",
      noIndex: true,
    }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.notifications(filter),
    queryFn: async () =>
      unwrapAction(
        await listNotifications({
          data: { limit: 50, ...(filter === "unread" ? { unreadOnly: true } : {}) },
        }),
      ),
  });

  const markAll = useMutation({
    mutationFn: async () => unwrapAction(await markNotifications({ data: { all: true } })),
    onSuccess: (result) => {
      toast.success(
        `${result.changed} notification${result.changed === 1 ? "" : "s"} marked as read`,
      );
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error) =>
      toast.error("Could not update notifications", { description: errorMessage(error) }),
  });

  const markOne = useMutation({
    mutationFn: async (id: string) => unwrapAction(await markNotifications({ data: { id } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error) => toast.error("Could not mark as read", { description: errorMessage(error) }),
  });

  return (
    <div className="page-shell max-w-3xl space-y-6 page-y">
      <PageHeader
        title="Notifications"
        description="Matches, donor responses, request changes and verification decisions — everything that needs your attention."
        actions={
          <Button
            variant="outline"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending || (data?.unread ?? 0) === 0}
          >
            {markAll.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCheck className="size-4" aria-hidden="true" />
            )}
            Mark all read
          </Button>
        }
      >
        {data ? (
          <div className="flex flex-wrap gap-2">
            <Pill tone="primary">{data.total} total</Pill>
            {data.unread > 0 ? (
              <Pill tone="danger">
                <BellRing className="size-3.5" aria-hidden="true" />
                {data.unread} unread
              </Pill>
            ) : (
              <Pill tone="success">All caught up</Pill>
            )}
          </div>
        ) : null}
      </PageHeader>

      {data ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile label="Total" value={data.total} icon={Bell} />
          <StatTile label="Unread" value={data.unread} icon={BellRing} tone="warning" />
          <StatTile
            label="Push notifications"
            value={data.pushEnabled ? "On" : ("Next" as never)}
            hint="In-app alerts are live; web push is scaffolded"
            icon={Sparkles}
            tone="info"
          />
        </div>
      ) : null}

      <Tabs value={filter} onValueChange={(value) => setFilter(value as "all" | "unread")}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-4">
          {isLoading ? (
            <div className="surface p-6">
              <SkeletonLines count={6} />
            </div>
          ) : isError || !data ? (
            <ErrorState
              description="We could not load your notifications."
              onRetry={() => void refetch()}
            />
          ) : data.items.length === 0 ? (
            <EmptyState
              icon={Bell}
              title={filter === "unread" ? "No unread notifications" : "No notifications yet"}
              description="When a compatible request appears near you, a donor offers help, or your verification is reviewed, you will see it here."
              action={
                <Button asChild variant="outline">
                  <Link to="/find-help">Browse open requests</Link>
                </Button>
              }
            />
          ) : (
            <ol className="space-y-3">
              {data.items.map((notification) => (
                <li
                  key={notification.id}
                  className={`surface flex gap-3 p-3.5 sm:gap-4 sm:p-4 ${notification.read ? "" : "border-primary/30 bg-primary-soft/40"}`}
                >
                  <span
                    className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ${
                      notification.read
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    <Bell className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{notification.title}</p>
                      <Pill tone="neutral">{NOTIFICATION_LABELS[notification.type]}</Pill>
                      {!notification.read ? <Pill tone="primary">New</Pill> : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span title={formatDateTime(notification.createdAt)}>
                        {relativeTime(notification.createdAt)}
                      </span>
                      {notification.link ? (
                        <Link
                          to={notification.link}
                          className="tap-link font-semibold text-primary hover:underline"
                          onClick={() => {
                            if (!notification.read) markOne.mutate(notification.id);
                          }}
                        >
                          Open
                        </Link>
                      ) : null}
                      {!notification.read ? (
                        <button
                          type="button"
                          className="tap-link font-semibold hover:underline"
                          onClick={() => markOne.mutate(notification.id)}
                        >
                          Mark as read
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </TabsContent>
      </Tabs>

      <InfoNote tone="info" icon={ShieldCheck} title="About these alerts">
        Notifications are generated by platform events only — matched requests, donor offers,
        request edits, cancellations and verification decisions. We never send marketing messages or
        share your contact details in a notification.
      </InfoNote>
    </div>
  );
}
