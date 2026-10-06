import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Bell,
  CalendarClock,
  ClipboardList,
  Droplet,
  Heart,
  HeartHandshake,
  Info,
  MapPin,
  Plus,
  Search,
  Siren,
  Sparkles,
  Stethoscope,
  TrendingUp,
  Users,
} from "lucide-react";
import { useState } from "react";

import { InstallBanner } from "@/components/layout/app-shell";
import {
  BloodGroupChip,
  EmptyState,
  ErrorState,
  InfoNote,
  PageHeader,
  Pill,
  RequestStatusBadge,
  SectionHeading,
  SkeletonCard,
  SkeletonGrid,
  StatTile,
  UrgencyBadge,
  VerificationBadge,
} from "@/components/common/primitives";
import { RequestCard, RequestCardMini } from "@/components/requests/request-card";
import { RespondDialog } from "@/components/requests/respond-dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/components/providers/auth-provider";
import { MEDICAL_DISCLAIMER } from "@/lib/brand";
import { ROLE_LABELS } from "@/lib/labels";
import { formatDate, relativeTime } from "@/lib/format";
import { dueLabel } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { unwrapAction } from "@/lib/actions";
import { fetchDashboard } from "@/server/api/requests";
import type { RequestSearchItem } from "@/server/api/requests";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Heal Connect" },
      { name: "description", content: "Your matches, requests, activity and notifications at a glance." },
    ],
  }),
  component: DashboardPage,
});

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function DashboardPage() {
  const { user } = useAuth();
  const [respondItem, setRespondItem] = useState<RequestSearchItem | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: async () => unwrapAction(await fetchDashboard()),
  });

  const firstName = (data?.name ?? user?.name ?? "there").split(" ")[0];
  const completion = data?.profileCompletion ?? user?.profileCompletion ?? 0;

  const quickActions = [
    {
      label: "Request Help",
      description: "Raise a blood, platelet or assistance request",
      to: "/requests/new",
      icon: Plus,
      accent: "gradient-life text-white",
    },
    {
      label: "Donate Blood",
      description: "Update availability and see matched requests",
      to: "/profile",
      icon: Droplet,
      accent: "bg-blood/10 text-blood",
    },
    {
      label: "Find Requests",
      description: "Search all open requests with filters",
      to: "/find-help",
      icon: Search,
      accent: "bg-primary-soft text-primary",
    },
    {
      label: "My Activity",
      description: "Offers you sent and their status",
      to: "/activity",
      icon: Activity,
      accent: "bg-info/10 text-info",
    },
  ] as const;

  return (
    <div className="page-shell space-y-8 py-8">
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description={
          data?.isDonor && data?.isRecipient
            ? "You are set up as a donor and a recipient. Here is everything that needs your attention."
            : data?.isDonor
              ? "Here are requests that fit your blood group, location and availability."
              : "Track your requests, offers and coordination in one place."
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/find-help">
                <Search className="size-4" aria-hidden="true" />
                Find requests
              </Link>
            </Button>
            <Button asChild>
              <Link to="/requests/new">
                <Plus className="size-4" aria-hidden="true" />
                Request help
              </Link>
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="primary">
            <Sparkles className="size-3.5" aria-hidden="true" />
            {data ? ROLE_LABELS[data.role] : user ? ROLE_LABELS[user.role] : "Member"}
          </Pill>
          <VerificationBadge
            status={data?.verificationStatus ?? user?.verificationStatus ?? "unverified"}
          />
          {user?.profile.city ? (
            <Pill tone="neutral">
              <MapPin className="size-3.5" aria-hidden="true" />
              {user.profile.city}
            </Pill>
          ) : null}
        </div>
      </PageHeader>

      <InstallBanner />

      {isLoading ? (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
          <SkeletonGrid count={3} />
        </div>
      ) : isError || !data ? (
        <ErrorState description="We could not load your dashboard." onRetry={() => void refetch()} />
      ) : (
        <>
          {/* Quick actions + completion */}
          <section aria-labelledby="quick-actions" className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <div className="space-y-4">
              <h2 id="quick-actions" className="sr-only">
                Quick actions
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {quickActions.map((action) => (
                  <Link
                    key={action.label}
                    to={action.to}
                    className="surface surface-hover flex items-center gap-4 p-4"
                  >
                    <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${action.accent}`}>
                      <action.icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-display text-sm font-bold">{action.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{action.description}</span>
                    </span>
                    <ArrowRight className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </Link>
                ))}
              </div>

              {data.isDonor ? (
                <div className="surface space-y-3 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-display text-sm font-bold">Donor readiness</h3>
                    <Pill tone={data.hasBloodGroup ? "success" : "warning"}>
                      {data.hasBloodGroup ? "Blood group set" : "Add blood group"}
                    </Pill>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Pill tone={data.hasLocation ? "success" : "warning"}>
                      <MapPin className="size-3.5" aria-hidden="true" />
                      {data.hasLocation ? "Location set" : "Location missing"}
                    </Pill>
                    <Pill tone={user?.donorProfile?.availability === "available" ? "success" : "neutral"}>
                      Availability: {user?.donorProfile?.availability?.replace(/_/g, " ") ?? "not set"}
                    </Pill>
                    <Pill tone="neutral">
                      Last donation: {user?.donorProfile?.lastDonationDate ? formatDate(user.donorProfile.lastDonationDate) : "not recorded"}
                    </Pill>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Keep availability accurate so families are not waiting on donors who cannot travel. You can pause
                    at any time from your donor profile.
                  </p>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/profile">Update donor profile</Link>
                  </Button>
                </div>
              ) : null}
            </div>

            <aside className="space-y-4">
              <div className="surface space-y-3 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-display text-sm font-bold">Profile completion</h3>
                  <span className="font-display text-lg font-extrabold">{completion}%</span>
                </div>
                <Progress value={completion} aria-label={`Profile ${completion}% complete`} />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {completion === 100
                    ? "Your profile is complete. Thank you for keeping details accurate."
                    : "Complete profiles get better matches and make coordination faster for families."}
                </p>
                {completion < 100 ? (
                  <Button asChild size="sm">
                    <Link to="/settings">Complete profile</Link>
                  </Button>
                ) : null}
              </div>

              <div className="surface space-y-3 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-display text-sm font-bold">Notifications</h3>
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/notifications">View all</Link>
                  </Button>
                </div>
                {data.notifications.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nothing yet. You will be notified about matches, offers and request updates.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {data.notifications.slice(0, 4).map((notification) => (
                      <li key={notification.id}>
                        <Link
                          to={notification.link ?? "/notifications"}
                          className="flex items-start gap-3 rounded-xl border border-border/70 p-3 transition hover:bg-accent/60"
                        >
                          <Bell
                            className={`mt-0.5 size-4 shrink-0 ${notification.read ? "text-muted-foreground" : "text-primary"}`}
                            aria-hidden="true"
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-semibold">{notification.title}</span>
                            <span className="block text-[11px] text-muted-foreground">
                              {relativeTime(notification.createdAt)}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </aside>
          </section>

          {/* Stats */}
          <section aria-label="Your numbers" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {data.isRecipient ? (
              <>
                <StatTile
                  label="Active requests"
                  value={data.stats.activeRequests}
                  hint={`${data.stats.totalRequests} raised in total`}
                  icon={ClipboardList}
                />
                <StatTile
                  label="Offers received"
                  value={data.activeRequests.reduce((total, item) => total + item.responseCount, 0)}
                  hint="Donors who responded to your requests"
                  icon={Users}
                  tone="info"
                />
              </>
            ) : null}
            {data.isDonor ? (
              <>
                <StatTile
                  label="Matched requests"
                  value={data.stats.matchedRequests}
                  hint={data.stats.emergencyNearby > 0 ? `${data.stats.emergencyNearby} emergency nearby` : "Ranked by compatibility and distance"}
                  icon={Heart}
                  tone="blood"
                />
                <StatTile
                  label="Offers you sent"
                  value={data.stats.donationsOffered}
                  hint={`${data.stats.donationsCompleted} marked completed`}
                  icon={HeartHandshake}
                  tone="success"
                />
              </>
            ) : null}
            {!data.isRecipient && !data.isDonor ? (
              <StatTile label="Open requests" value={data.stats.matchedRequests} icon={Search} />
            ) : null}
            <StatTile
              label="Unread alerts"
              value={data.stats.unreadNotifications}
              hint="Matches, offers and verification updates"
              icon={Bell}
              tone="warning"
            />
          </section>

          {/* Matched requests */}
          {data.isDonor ? (
            <section className="space-y-4" aria-labelledby="matched-heading">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 id="matched-heading" className="font-display text-xl font-extrabold">
                    Matched for you
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Ranked by blood group, distance, your availability and urgency.
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link to="/find-help">
                    See all matches
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>

              {!data.hasBloodGroup || !data.hasLocation ? (
                <InfoNote tone="warning" title="Improve your matches">
                  {!data.hasBloodGroup
                    ? "Add your blood group to see compatible requests. "
                    : ""}
                  {!data.hasLocation
                    ? "Add your city or share your coarse location so we can rank requests by distance."
                    : ""}
                </InfoNote>
              ) : null}

              {data.matchedRequests.length === 0 ? (
                <EmptyState
                  icon={Droplet}
                  title="No matching requests right now"
                  description="That is good news for the community. We will notify you the moment a compatible request is posted nearby."
                  action={
                    <Button asChild variant="outline">
                      <Link to="/find-help">Browse all open requests</Link>
                    </Button>
                  }
                />
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {data.matchedRequests.map((item) => (
                    <RequestCard key={item.id} item={item} onRespond={setRespondItem} />
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {/* My active requests */}
          {data.isRecipient ? (
            <section className="space-y-4" aria-labelledby="requests-heading">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 id="requests-heading" className="font-display text-xl font-extrabold">
                    Your active requests
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Track offers, confirm donors and close the loop when the need is met.
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link to="/my-requests">
                    Manage requests
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>

              {data.activeRequests.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title="No active requests"
                  description="When you raise a request it appears here with every donor offer, so you always know where things stand."
                  action={
                    <Button asChild>
                      <Link to="/requests/new">Raise a request</Link>
                    </Button>
                  }
                />
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {data.activeRequests.map((request) => (
                    <article key={request.id} className="surface space-y-3 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <UrgencyBadge urgency={request.urgency} />
                          <RequestStatusBadge status={request.status} />
                        </div>
                        <BloodGroupChip group={request.bloodGroup} size="sm" />
                      </div>
                      <h3 className="font-display text-base font-bold">
                        {request.hospitalName}, {request.city}
                      </h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarClock className="size-3.5" aria-hidden="true" />
                          {dueLabel(request.requiredBy)}
                        </span>
                        <span>{request.reference}</span>
                        <span>
                          {request.unitsFulfilled}/{request.unitsRequired} units fulfilled
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Pill tone={request.pendingResponses > 0 ? "warning" : "neutral"}>
                          {request.pendingResponses} awaiting your confirmation
                        </Pill>
                        <Pill tone="success">{request.acceptedResponses} accepted</Pill>
                      </div>
                      <Button asChild size="sm" variant="outline">
                        <Link to="/requests/$requestId" params={{ requestId: request.id }}>
                          Open request
                        </Link>
                      </Button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {/* Activity + emergencies */}
          <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <div className="space-y-4">
              <SectionHeading title="Recent activity" description="Everything you did lately, newest first." />
              {data.recentActivity.length === 0 ? (
                <EmptyState
                  icon={Activity}
                  title="No activity yet"
                  description="Offers you send and requests you raise will show up here."
                />
              ) : (
                <ol className="space-y-3">
                  {data.recentActivity.map((entry) => (
                    <li key={entry.id} className="surface flex gap-4 p-4">
                      <span
                        className={`grid size-9 shrink-0 place-items-center rounded-xl ${
                          entry.kind === "offer"
                            ? "bg-blood/10 text-blood"
                            : entry.kind === "request"
                              ? "bg-primary-soft text-primary"
                              : "bg-info/10 text-info"
                        }`}
                      >
                        {entry.kind === "offer" ? (
                          <Heart className="size-4" aria-hidden="true" />
                        ) : entry.kind === "request" ? (
                          <ClipboardList className="size-4" aria-hidden="true" />
                        ) : (
                          <Bell className="size-4" aria-hidden="true" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link to={entry.link} className="block text-sm font-semibold hover:text-primary">
                          {entry.title}
                        </Link>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{entry.description}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">{relativeTime(entry.at)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="space-y-4">
              <EmergencyPeek />
              <InfoNote tone="primary" icon={Stethoscope} title="Our role, and yours">
                {MEDICAL_DISCLAIMER} Confirm everything with the hospital blood bank before travelling, and report
                anything that feels unsafe or asks for money.
              </InfoNote>
              <div className="surface space-y-3 p-5">
                <h3 className="flex items-center gap-2 font-display text-sm font-bold">
                  <TrendingUp className="size-4 text-primary" aria-hidden="true" />
                  Get verified
                </h3>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Verified accounts stand out in donor offers and request lists. Verification is reviewed manually by
                  our team.
                </p>
                <Button asChild size="sm" variant="outline">
                  <Link to="/verify">
                    <BadgeCheck className="size-4" aria-hidden="true" />
                    {data.verificationStatus === "verified" ? "View verification" : "Start verification"}
                  </Link>
                </Button>
              </div>
            </div>
          </section>
        </>
      )}

      <RespondDialog item={respondItem} open={Boolean(respondItem)} onOpenChange={(open) => !open && setRespondItem(null)} />
    </div>
  );
}

function EmergencyPeek() {
  const { data } = useQuery({
    queryKey: queryKeys.emergencyRequests,
    queryFn: async () => {
      const { fetchEmergencyRequests } = await import("@/server/api/requests");
      return unwrapAction(await fetchEmergencyRequests({ data: { limit: 3 } }));
    },
    staleTime: 60_000,
  });

  return (
    <div className="surface space-y-3 border-destructive/30 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display text-sm font-bold">
          <Siren className="size-4 text-destructive" aria-hidden="true" />
          Emergency requests
        </h3>
        {data && data.total > 0 ? <Pill tone="danger">{data.total} open</Pill> : null}
      </div>
      {data && data.items.length > 0 ? (
        <ul className="space-y-2">
          {data.items.map((item) => (
            <li key={item.id}>
              <RequestCardMini item={item} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          No open emergency requests right now. In an emergency, always contact emergency services and the hospital
          blood bank first.
        </p>
      )}
      <Button asChild size="sm" variant="outline" className="w-full">
        <Link to="/emergency">
          <Info className="size-4" aria-hidden="true" />
          Emergency guidance
        </Link>
      </Button>
    </div>
  );
}
