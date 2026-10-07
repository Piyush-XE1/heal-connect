import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  Droplet,
  Flag,
  FlaskConical,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { ConfirmDialog } from "@/components/common/dialogs";
import { SimplePagination } from "@/components/common/pagination";
import {
  BloodGroupChip,
  DemoBadge,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/components/providers/auth-provider";
import { REQUEST_TYPE_SHORT_LABELS, ROLE_LABELS, URGENCY_LABELS } from "@/lib/labels";
import {
  USER_ROLES,
  VERIFICATION_STATUSES,
  type UserRole,
  type VerificationStatus,
} from "@/lib/domain";
import { formatDate, relativeTime } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { errorMessage, unwrapAction } from "@/lib/actions";
import { pageHead } from "@/lib/seo";
import {
  adminReportAction,
  adminRequestAction,
  adminResetDemoData,
  adminUserAction,
  adminVerificationAction,
  fetchAdminOverview,
  listAdminReports,
  listAdminRequests,
  listAdminUsers,
  listAdminVerifications,
} from "@/server/api/admin";

export const Route = createFileRoute("/_app/admin")({
  validateSearch: (search) =>
    z
      .object({
        tab: z.enum(["overview", "users", "requests", "reports", "verifications"]).optional(),
      })
      .parse(search),
  head: () =>
    pageHead({
      title: "Admin dashboard — Heal Connect",
      description: "Moderation workspace for users, requests, reports and verifications.",
      noIndex: true,
    }),
  component: AdminPage,
});

const PAGE_SIZE = 10;

function AdminPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [tab, setTab] = useState(search.tab ?? "overview");
  const [note, setNote] = useState("");

  const [userQuery, setUserQuery] = useState("");
  const [userRole, setUserRole] = useState<UserRole | "">("");
  const [userStatus, setUserStatus] = useState<"active" | "suspended" | "">("");
  const [userVerification, setUserVerification] = useState<VerificationStatus | "">("");
  const [userDemo, setUserDemo] = useState<"all" | "demo" | "real">("all");

  const [requestQuery, setRequestQuery] = useState("");
  const [requestStatus, setRequestStatus] = useState("");
  const [requestUrgency, setRequestUrgency] = useState<"" | "normal" | "urgent" | "emergency">("");
  const [requestDemo, setRequestDemo] = useState<"all" | "demo" | "real">("all");

  const [reportStatus, setReportStatus] = useState<
    "all" | "open" | "reviewing" | "resolved" | "dismissed"
  >("open");
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | "">("pending");
  const [page, setPage] = useState(1);

  const overview = useQuery({
    queryKey: queryKeys.admin("overview", {}),
    queryFn: async () => unwrapAction(await fetchAdminOverview()),
  });

  const usersQuery = useQuery({
    queryKey: queryKeys.admin("users", {
      userQuery,
      userRole,
      userStatus,
      userVerification,
      userDemo,
    }),
    queryFn: async () =>
      unwrapAction(
        await listAdminUsers({
          data: {
            ...(userQuery ? { q: userQuery } : {}),
            ...(userRole ? { role: userRole } : {}),
            ...(userStatus ? { status: userStatus } : {}),
            ...(userVerification ? { verification: userVerification } : {}),
            demo: userDemo,
          },
        }),
      ),
    enabled: tab === "users",
    placeholderData: keepPreviousData,
  });

  const requestsQuery = useQuery({
    queryKey: queryKeys.admin("requests", {
      requestQuery,
      requestStatus,
      requestUrgency,
      requestDemo,
    }),
    queryFn: async () =>
      unwrapAction(
        await listAdminRequests({
          data: {
            ...(requestQuery ? { q: requestQuery } : {}),
            ...(requestStatus ? { status: requestStatus } : {}),
            ...(requestUrgency ? { urgency: requestUrgency } : {}),
            demo: requestDemo,
          },
        }),
      ),
    enabled: tab === "requests",
    placeholderData: keepPreviousData,
  });

  const reportsQuery = useQuery({
    queryKey: queryKeys.admin("reports", { reportStatus }),
    queryFn: async () => unwrapAction(await listAdminReports({ data: { status: reportStatus } })),
    enabled: tab === "reports",
    placeholderData: keepPreviousData,
  });

  const verificationsQuery = useQuery({
    queryKey: queryKeys.admin("verifications", { verificationStatus }),
    queryFn: async () =>
      unwrapAction(
        await listAdminVerifications({
          data: verificationStatus ? { status: verificationStatus } : {},
        }),
      ),
    enabled: tab === "verifications",
    placeholderData: keepPreviousData,
  });

  const invalidateAdmin = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin"] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
  };

  const userAction = useMutation({
    mutationFn: async (input: {
      userId: string;
      action: "suspend" | "reactivate" | "grant_admin" | "revoke_admin" | "clear_verification";
      note?: string;
    }) => unwrapAction(await adminUserAction({ data: input })),
    onSuccess: (_result, variables) => {
      toast.success(`User ${variables.action.replace(/_/g, " ")} applied`);
      invalidateAdmin();
      setNote("");
    },
    onError: (error) =>
      toast.error("Could not update the user", { description: errorMessage(error) }),
  });

  const requestAction = useMutation({
    mutationFn: async (input: {
      id: string;
      action: "resolve_request" | "mark_in_progress" | "remove_request" | "restore_request";
      note?: string;
    }) => unwrapAction(await adminRequestAction({ data: input })),
    onSuccess: (_result, variables) => {
      toast.success(`Request ${variables.action.replace(/_/g, " ")} applied`);
      invalidateAdmin();
      void queryClient.invalidateQueries({ queryKey: queryKeys.myRequests });
      setNote("");
    },
    onError: (error) =>
      toast.error("Could not update the request", { description: errorMessage(error) }),
  });

  const reportAction = useMutation({
    mutationFn: async (input: {
      id: string;
      action: "review" | "resolve" | "dismiss";
      note?: string;
    }) => unwrapAction(await adminReportAction({ data: input })),
    onSuccess: (_result, variables) => {
      toast.success(`Report ${variables.action} applied`);
      invalidateAdmin();
      setNote("");
    },
    onError: (error) =>
      toast.error("Could not update the report", { description: errorMessage(error) }),
  });

  const verificationAction = useMutation({
    mutationFn: async (input: { id: string; action: "approve" | "reject"; note?: string }) =>
      unwrapAction(await adminVerificationAction({ data: input })),
    onSuccess: (_result, variables) => {
      toast.success(variables.action === "approve" ? "Account verified" : "Verification rejected");
      invalidateAdmin();
      setNote("");
    },
    onError: (error) =>
      toast.error("Could not update the verification", { description: errorMessage(error) }),
  });

  const resetDemo = useMutation({
    mutationFn: async () => unwrapAction(await adminResetDemoData()),
    onSuccess: (result) => {
      toast.success("Demo data restored", { description: result.note });
      invalidateAdmin();
    },
    onError: (error) =>
      toast.error("Could not reset demo data", { description: errorMessage(error) }),
  });

  const stats = overview.data?.stats;

  const pagedUsers = useMemo(() => {
    const items = usersQuery.data?.items ?? [];
    return items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [page, usersQuery.data]);

  const pagedRequests = useMemo(() => {
    const items = requestsQuery.data?.items ?? [];
    return items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [page, requestsQuery.data]);

  if (!user?.isAdmin) {
    return (
      <div className="page-shell max-w-3xl page-y">
        <EmptyState
          icon={ShieldAlert}
          title="Administrator access required"
          description="This workspace is limited to platform moderators. If you believe you should have access, contact the team."
          action={
            <Button asChild variant="outline">
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="page-shell space-y-6 page-y">
      <PageHeader
        title="Admin dashboard"
        description="Moderate members and requests, act on reports, review verification requests and monitor platform health."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => resetDemo.mutate()}
              disabled={resetDemo.isPending || !overview.data?.environment.demoLoginEnabled}
              title={
                overview.data?.environment.demoLoginEnabled
                  ? "Restore the sample dataset"
                  : "Demo data can only be reset in demo environments"
              }
            >
              {resetDemo.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="size-4" aria-hidden="true" />
              )}
              Reset demo data
            </Button>
            <Button asChild variant="ghost">
              <Link to="/dashboard">Exit to dashboard</Link>
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="info">
            <UserCog className="size-3.5" aria-hidden="true" />
            Signed in as {user.name}
          </Pill>
          {overview.data ? (
            <Pill tone="neutral">
              {overview.data.environment.demoRecords} demo records ·{" "}
              {overview.data.environment.realRecords} real records
            </Pill>
          ) : null}
          {overview.data && !overview.data.environment.googleConfigured ? (
            <Pill tone="warning">Google sign-in not configured</Pill>
          ) : null}
        </div>
      </PageHeader>

      <InfoNote tone="info" icon={ShieldCheck} title="Moderation principles">
        Act on safety first: remove payment-for-blood and organ-brokerage content immediately,
        verify organisations carefully, and document every action with a note so decisions can be
        reviewed. Never ask members for medical documents.
      </InfoNote>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value as typeof tab);
          setPage(1);
          void navigate({
            to: "/admin",
            search: {
              tab: value as "overview" | "users" | "requests" | "reports" | "verifications",
            },
            replace: true,
          });
        }}
      >
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="verifications">Verifications</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4 space-y-6">
          {overview.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <SkeletonCard key={index} />
              ))}
            </div>
          ) : overview.isError || !stats ? (
            <ErrorState
              description="We could not load platform statistics."
              onRetry={() => void overview.refetch()}
            />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile
                  label="Members"
                  value={stats.totalUsers}
                  hint={`${stats.donors} donors · ${stats.recipients} recipients · ${stats.both} both`}
                  icon={Users}
                />
                <StatTile
                  label="Open requests"
                  value={stats.openRequests}
                  hint={`${stats.emergencyRequests} emergency`}
                  icon={Droplet}
                  tone="blood"
                />
                <StatTile
                  label="Donor offers"
                  value={stats.donorResponses}
                  hint={`${stats.fulfilledRequests} requests fulfilled`}
                  icon={Check}
                  tone="success"
                />
                <StatTile
                  label="Open reports"
                  value={stats.openReports}
                  hint={`${stats.suspendedUsers} suspended accounts`}
                  icon={Flag}
                  tone="danger"
                />
                <StatTile
                  label="Verified members"
                  value={stats.verifiedUsers}
                  icon={BadgeCheck}
                  tone="info"
                />
                <StatTile
                  label="Pending verifications"
                  value={stats.pendingVerifications}
                  icon={ShieldAlert}
                  tone="warning"
                />
                <StatTile
                  label="Total requests"
                  value={stats.totalRequests}
                  icon={Siren}
                  tone="primary"
                />
                <StatTile
                  label="Demo records"
                  value={stats.demoRecords}
                  hint={`${stats.realRecords} real records`}
                  icon={FlaskConical}
                  tone="neutral"
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <section className="surface space-y-3 p-4 sm:p-5" aria-labelledby="chart-day">
                  <h2 id="chart-day" className="font-display text-sm font-bold">
                    Requests created (last 14 days)
                  </h2>
                  <ul className="space-y-2">
                    {stats.requestsByDay.map((entry) => {
                      const max = Math.max(1, ...stats.requestsByDay.map((item) => item.value));
                      return (
                        <li key={entry.label} className="flex items-center gap-3 text-xs">
                          <span className="w-14 shrink-0 text-muted-foreground">{entry.label}</span>
                          <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <span
                              className="block h-full rounded-full gradient-brand"
                              style={{ width: `${(entry.value / max) * 100}%` }}
                            />
                          </span>
                          <span className="w-6 text-right font-bold">{entry.value}</span>
                        </li>
                      );
                    })}
                  </ul>
                </section>

                <section className="surface space-y-3 p-4 sm:p-5" aria-labelledby="chart-demand">
                  <h2 id="chart-demand" className="font-display text-sm font-bold">
                    Open demand by blood group
                  </h2>
                  {stats.bloodGroupDemand.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No open requests with a blood group right now.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {stats.bloodGroupDemand.map((entry) => {
                        const max = Math.max(
                          1,
                          ...stats.bloodGroupDemand.map((item) => item.value),
                        );
                        return (
                          <li key={entry.label} className="flex items-center gap-3 text-xs">
                            <span className="w-8 shrink-0 font-bold">{entry.label}</span>
                            <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                              <span
                                className="block h-full rounded-full bg-blood"
                                style={{ width: `${(entry.value / max) * 100}%` }}
                              />
                            </span>
                            <span className="w-6 text-right font-bold">{entry.value}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <div className="flex flex-wrap gap-2 pt-2">
                    {stats.requestsByType.map((entry) => (
                      <Pill key={entry.label} tone="neutral">
                        {entry.label}: {entry.value}
                      </Pill>
                    ))}
                  </div>
                </section>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <section className="surface space-y-3 p-4 sm:p-5" aria-labelledby="emergency-watch">
                  <h2
                    id="emergency-watch"
                    className="flex items-center gap-2 font-display text-sm font-bold"
                  >
                    <Siren className="size-4 text-destructive" aria-hidden="true" />
                    Emergency watchlist
                  </h2>
                  {overview.data?.emergencyRequests.length ? (
                    <ul className="space-y-2">
                      {overview.data.emergencyRequests.map((item) => (
                        <li key={item.id} className="flex flex-wrap items-center gap-2 text-xs">
                          <UrgencyBadge urgency="emergency" />
                          <BloodGroupChip group={item.bloodGroup as never} size="sm" />
                          <Link
                            to="/requests/$requestId"
                            params={{ requestId: item.id }}
                            className="font-semibold hover:text-primary"
                          >
                            {item.reference}
                          </Link>
                          <span className="text-muted-foreground">
                            {item.hospitalName}, {item.city} · {item.unitsRequired} units · by{" "}
                            {formatDate(item.requiredBy)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">No open emergency requests.</p>
                  )}
                </section>

                <section className="surface space-y-3 p-4 sm:p-5" aria-labelledby="audit-trail">
                  <h2 id="audit-trail" className="font-display text-sm font-bold">
                    Recent moderation actions
                  </h2>
                  {overview.data?.auditTrail.length ? (
                    <ul className="space-y-2">
                      {overview.data.auditTrail.map((entry) => (
                        <li key={entry.id} className="rounded-xl border border-border p-3 text-xs">
                          <p className="font-semibold">
                            {entry.action} · {entry.targetType}
                          </p>
                          <p className="mt-0.5 text-muted-foreground">
                            {entry.actorName} · {relativeTime(entry.at)}
                            {entry.note ? ` · ${entry.note}` : ""}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No moderation actions recorded yet.
                    </p>
                  )}
                </section>
              </div>
            </>
          )}
        </TabsContent>

        {/* Users */}
        <TabsContent value="users" className="mt-4 space-y-4">
          <div className="surface grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="admin-user-q">Search</Label>
              <Input
                id="admin-user-q"
                value={userQuery}
                onChange={(event) => {
                  setUserQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Name, email or city"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-user-role">Role</Label>
              <Select
                value={userRole || "any"}
                onValueChange={(value) => setUserRole(value === "any" ? "" : (value as UserRole))}
              >
                <SelectTrigger id="admin-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any role</SelectItem>
                  {USER_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-user-status">Account status</Label>
              <Select
                value={userStatus || "any"}
                onValueChange={(value) =>
                  setUserStatus(value === "any" ? "" : (value as "active" | "suspended"))
                }
              >
                <SelectTrigger id="admin-user-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-user-verification">Verification</Label>
              <Select
                value={userVerification || "any"}
                onValueChange={(value) =>
                  setUserVerification(value === "any" ? "" : (value as VerificationStatus))
                }
              >
                <SelectTrigger id="admin-user-verification">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any verification</SelectItem>
                  {VERIFICATION_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-user-demo">Data source</Label>
              <Select
                value={userDemo}
                onValueChange={(value) => setUserDemo(value as typeof userDemo)}
              >
                <SelectTrigger id="admin-user-demo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Demo and real</SelectItem>
                  <SelectItem value="demo">Demo only</SelectItem>
                  <SelectItem value="real">Real members only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-note">Moderation note (used by actions)</Label>
              <Textarea
                id="admin-note"
                rows={2}
                maxLength={300}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Reason recorded in the audit trail"
              />
            </div>
          </div>

          {usersQuery.isLoading ? (
            <SkeletonCard />
          ) : usersQuery.isError ? (
            <ErrorState
              description="We could not load members."
              onRetry={() => void usersQuery.refetch()}
            />
          ) : pagedUsers.length === 0 ? (
            <EmptyState icon={Users} title="No members match these filters" />
          ) : (
            <>
              <ul className="space-y-3">
                {pagedUsers.map((row) => (
                  <li key={row.id} className="surface space-y-3 p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="flex flex-wrap items-center gap-2 font-display text-base font-bold">
                          {row.name}
                          {row.isAdmin ? <Pill tone="info">Admin</Pill> : null}
                          {row.isDemo ? <DemoBadge /> : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {row.email} · {ROLE_LABELS[row.role]} · {row.city ?? "no city"} · joined{" "}
                          {formatDate(row.createdAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Pill tone={row.accountStatus === "active" ? "success" : "danger"}>
                          {row.accountStatus}
                        </Pill>
                        <Pill
                          tone={
                            row.verificationStatus === "verified"
                              ? "success"
                              : row.verificationStatus === "pending"
                                ? "warning"
                                : row.verificationStatus === "rejected"
                                  ? "danger"
                                  : "neutral"
                          }
                        >
                          {row.verificationStatus}
                        </Pill>
                        <Pill tone="neutral">{row.requests} requests</Pill>
                        <Pill tone="neutral">{row.responses} offers</Pill>
                        {row.reports > 0 ? <Pill tone="danger">{row.reports} reports</Pill> : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {row.accountStatus === "active" ? (
                        <ConfirmDialog
                          title={`Suspend ${row.name}?`}
                          description="Their sessions are ended immediately and they cannot publish requests or offers until reactivated."
                          confirmLabel="Suspend account"
                          destructive
                          onConfirm={async () => {
                            await userAction.mutateAsync({
                              userId: row.id,
                              action: "suspend",
                              ...(note ? { note } : {}),
                            });
                          }}
                          trigger={
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive hover:text-destructive"
                            >
                              <ShieldAlert className="size-4" aria-hidden="true" />
                              Suspend
                            </Button>
                          }
                        />
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            userAction.mutate({
                              userId: row.id,
                              action: "reactivate",
                              ...(note ? { note } : {}),
                            })
                          }
                          disabled={userAction.isPending}
                        >
                          <ShieldCheck className="size-4" aria-hidden="true" />
                          Reactivate
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          userAction.mutate({
                            userId: row.id,
                            action: row.isAdmin ? "revoke_admin" : "grant_admin",
                            ...(note ? { note } : {}),
                          })
                        }
                        disabled={userAction.isPending}
                      >
                        <UserCog className="size-4" aria-hidden="true" />
                        {row.isAdmin ? "Revoke admin" : "Grant admin"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          userAction.mutate({
                            userId: row.id,
                            action: "clear_verification",
                            ...(note ? { note } : {}),
                          })
                        }
                        disabled={userAction.isPending || row.verificationStatus === "unverified"}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                        Reset verification
                      </Button>
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/donors/$userId" params={{ userId: row.id }}>
                          View public profile
                        </Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              <SimplePagination
                currentPage={page}
                totalPages={Math.max(
                  1,
                  Math.ceil((usersQuery.data?.items.length ?? 0) / PAGE_SIZE),
                )}
                onPageChange={setPage}
              />
            </>
          )}
        </TabsContent>

        {/* Requests */}
        <TabsContent value="requests" className="mt-4 space-y-4">
          <div className="surface grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="admin-request-q">Search</Label>
              <Input
                id="admin-request-q"
                value={requestQuery}
                onChange={(event) => {
                  setRequestQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Reference, hospital, city or requester"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-request-status">Status</Label>
              <Select
                value={requestStatus || "any"}
                onValueChange={(value) => setRequestStatus(value === "any" ? "" : value)}
              >
                <SelectTrigger id="admin-request-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any status</SelectItem>
                  {["open", "in_progress", "fulfilled", "cancelled", "expired", "removed"].map(
                    (status) => (
                      <SelectItem key={status} value={status}>
                        {status.replace(/_/g, " ")}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-request-urgency">Urgency</Label>
              <Select
                value={requestUrgency || "any"}
                onValueChange={(value) =>
                  setRequestUrgency(
                    value === "any" ? "" : (value as "normal" | "urgent" | "emergency"),
                  )
                }
              >
                <SelectTrigger id="admin-request-urgency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any urgency</SelectItem>
                  <SelectItem value="emergency">{URGENCY_LABELS.emergency}</SelectItem>
                  <SelectItem value="urgent">{URGENCY_LABELS.urgent}</SelectItem>
                  <SelectItem value="normal">{URGENCY_LABELS.normal}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-request-demo">Data source</Label>
              <Select
                value={requestDemo}
                onValueChange={(value) => setRequestDemo(value as typeof requestDemo)}
              >
                <SelectTrigger id="admin-request-demo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Demo and real</SelectItem>
                  <SelectItem value="demo">Demo only</SelectItem>
                  <SelectItem value="real">Real requests only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {requestsQuery.isLoading ? (
            <SkeletonCard />
          ) : pagedRequests.length === 0 ? (
            <EmptyState icon={Droplet} title="No requests match these filters" />
          ) : (
            <>
              <ul className="space-y-3">
                {pagedRequests.map((row) => (
                  <li key={row.id} className="surface space-y-3 p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="flex flex-wrap items-center gap-2 font-display text-base font-bold">
                          {row.reference}
                          <RequestStatusBadge status={row.status} />
                          <UrgencyBadge urgency={row.urgency} />
                          {row.isDemo ? <DemoBadge /> : null}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {REQUEST_TYPE_SHORT_LABELS[row.requestType]} ·{" "}
                          {row.bloodGroup ?? "no group"} · {row.unitsFulfilled}/{row.unitsRequired}{" "}
                          units · {row.hospitalName}, {row.city} · by {formatDate(row.requiredBy)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Raised by {row.requesterName} ({row.requesterEmail}) · {row.responseCount}{" "}
                          offers · {row.reportCount} reports
                        </p>
                        {row.moderationNote ? (
                          <p className="mt-1 text-xs text-warning-foreground">
                            Note: {row.moderationNote}
                          </p>
                        ) : null}
                      </div>
                      <BloodGroupChip group={row.bloodGroup as never} size="sm" />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/requests/$requestId" params={{ requestId: row.id }}>
                          Open
                        </Link>
                      </Button>
                      {row.status !== "fulfilled" ? (
                        <ConfirmDialog
                          title={`Mark ${row.reference} as fulfilled?`}
                          description="The requester and every donor who offered help will be notified."
                          confirmLabel="Mark fulfilled"
                          onConfirm={async () => {
                            await requestAction.mutateAsync({
                              id: row.id,
                              action: "resolve_request",
                              ...(note ? { note } : {}),
                            });
                          }}
                          trigger={
                            <Button size="sm" variant="outline">
                              <Check className="size-4" aria-hidden="true" />
                              Mark fulfilled
                            </Button>
                          }
                        />
                      ) : null}
                      {row.status === "open" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            requestAction.mutate({
                              id: row.id,
                              action: "mark_in_progress",
                              ...(note ? { note } : {}),
                            })
                          }
                          disabled={requestAction.isPending}
                        >
                          Mark in progress
                        </Button>
                      ) : null}
                      {row.status !== "removed" ? (
                        <ConfirmDialog
                          title={`Remove ${row.reference}?`}
                          description="Use this for policy violations such as payment requests, organ brokerage or false information. Pending donor offers are withdrawn and the requester is notified."
                          confirmLabel="Remove request"
                          destructive
                          onConfirm={async () => {
                            await requestAction.mutateAsync({
                              id: row.id,
                              action: "remove_request",
                              ...(note ? { note } : {}),
                            });
                          }}
                          trigger={
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="size-4" aria-hidden="true" />
                              Remove
                            </Button>
                          }
                        />
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            requestAction.mutate({
                              id: row.id,
                              action: "restore_request",
                              ...(note ? { note } : {}),
                            })
                          }
                          disabled={requestAction.isPending}
                        >
                          Restore request
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <SimplePagination
                currentPage={page}
                totalPages={Math.max(
                  1,
                  Math.ceil((requestsQuery.data?.items.length ?? 0) / PAGE_SIZE),
                )}
                onPageChange={setPage}
              />
            </>
          )}
        </TabsContent>

        {/* Reports */}
        <TabsContent value="reports" className="mt-4 space-y-4">
          <div className="surface flex flex-wrap items-end gap-4 p-5">
            <div className="space-y-2">
              <Label htmlFor="admin-report-status">Report status</Label>
              <Select
                value={reportStatus}
                onValueChange={(value) => setReportStatus(value as typeof reportStatus)}
              >
                <SelectTrigger id="admin-report-status" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All reports</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="reviewing">Reviewing</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="dismissed">Dismissed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Reporter identities are visible to moderators only and are never shown to the reported
              member.
            </p>
          </div>

          {reportsQuery.isLoading ? (
            <SkeletonCard />
          ) : reportsQuery.data?.items.length ? (
            <ul className="space-y-3">
              {reportsQuery.data.items.map((report) => (
                <li key={report.id} className="surface space-y-3 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="flex flex-wrap items-center gap-2 font-display text-base font-bold">
                        <AlertTriangle className="size-4 text-destructive" aria-hidden="true" />
                        {report.reason.replace(/_/g, " ")}
                        <Pill
                          tone={
                            report.status === "resolved"
                              ? "success"
                              : report.status === "dismissed"
                                ? "neutral"
                                : "warning"
                          }
                        >
                          {report.status}
                        </Pill>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Target: {report.targetLabel} · reported by {report.reporterName} ·{" "}
                        {relativeTime(report.createdAt)}
                      </p>
                      {report.details ? (
                        <p className="mt-2 rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
                          “{report.details}”
                        </p>
                      ) : null}
                      {report.resolutionNote ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Resolution: {report.resolutionNote}
                        </p>
                      ) : null}
                    </div>
                    {report.targetType === "request" ? (
                      <Button asChild size="sm" variant="outline">
                        <Link to="/requests/$requestId" params={{ requestId: report.targetId }}>
                          Open request
                        </Link>
                      </Button>
                    ) : (
                      <Button asChild size="sm" variant="outline">
                        <Link to="/donors/$userId" params={{ userId: report.targetId }}>
                          Open profile
                        </Link>
                      </Button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        reportAction.mutate({
                          id: report.id,
                          action: "review",
                          ...(note ? { note } : {}),
                        })
                      }
                      disabled={reportAction.isPending}
                    >
                      Mark reviewing
                    </Button>
                    <ConfirmDialog
                      title="Resolve this report?"
                      description="Use this when the reported content was removed or the case is closed. The reporter is notified."
                      confirmLabel="Resolve"
                      onConfirm={async () => {
                        await reportAction.mutateAsync({
                          id: report.id,
                          action: "resolve",
                          ...(note ? { note } : {}),
                        });
                      }}
                      trigger={
                        <Button size="sm" variant="outline">
                          <Check className="size-4" aria-hidden="true" />
                          Resolve
                        </Button>
                      }
                    />
                    <ConfirmDialog
                      title="Dismiss this report?"
                      description="Use this when there is no policy violation. The reporter is informed politely."
                      confirmLabel="Dismiss"
                      onConfirm={async () => {
                        await reportAction.mutateAsync({
                          id: report.id,
                          action: "dismiss",
                          ...(note ? { note } : {}),
                        });
                      }}
                      trigger={
                        <Button size="sm" variant="ghost">
                          Dismiss
                        </Button>
                      }
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={Flag}
              title="No reports in this view"
              description="Reports from members appear here. Requests mentioning payment or organ brokerage should be removed immediately."
            />
          )}
        </TabsContent>

        {/* Verifications */}
        <TabsContent value="verifications" className="mt-4 space-y-4">
          <div className="surface flex flex-wrap items-end gap-4 p-5">
            <div className="space-y-2">
              <Label htmlFor="admin-verification-status">Status</Label>
              <Select
                value={verificationStatus || "any"}
                onValueChange={(value) =>
                  setVerificationStatus(value === "any" ? "" : (value as VerificationStatus))
                }
              >
                <SelectTrigger id="admin-verification-status" className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">All verifications</SelectItem>
                  {VERIFICATION_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Approving sets the verified badge. Rejecting asks the member for better information —
              always explain why.
            </p>
          </div>

          {verificationsQuery.isLoading ? (
            <SkeletonCard />
          ) : verificationsQuery.data?.items.length ? (
            <ul className="space-y-3">
              {verificationsQuery.data.items.map((record) => (
                <li key={record.id} className="surface space-y-3 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="flex flex-wrap items-center gap-2 font-display text-base font-bold">
                        {record.userName}
                        <Pill tone="neutral">{record.organizationType.replace(/_/g, " ")}</Pill>
                        <Pill
                          tone={
                            record.status === "verified"
                              ? "success"
                              : record.status === "pending"
                                ? "warning"
                                : "danger"
                          }
                        >
                          {record.status}
                        </Pill>
                        {record.isDemo ? <DemoBadge /> : null}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {record.userEmail}
                        {record.organizationName ? ` · ${record.organizationName}` : ""} · submitted{" "}
                        {relativeTime(record.submittedAt)}
                      </p>
                      {record.evidenceNote ? (
                        <p className="mt-2 rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
                          “{record.evidenceNote}”
                        </p>
                      ) : null}
                      {record.reviewNote ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Review note: {record.reviewNote}
                        </p>
                      ) : null}
                    </div>
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/donors/$userId" params={{ userId: record.userId }}>
                        View profile
                      </Link>
                    </Button>
                  </div>

                  {record.status === "pending" ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          verificationAction.mutate({
                            id: record.id,
                            action: "approve",
                            ...(note ? { note } : {}),
                          })
                        }
                        disabled={verificationAction.isPending}
                      >
                        <BadgeCheck className="size-4" aria-hidden="true" />
                        Approve verification
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          verificationAction.mutate({
                            id: record.id,
                            action: "reject",
                            ...(note ? { note } : {}),
                          })
                        }
                        disabled={verificationAction.isPending}
                      >
                        Reject with note
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={BadgeCheck}
              title="No verification requests in this view"
              description="Submitted verification requests appear here for manual review by a moderator."
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
