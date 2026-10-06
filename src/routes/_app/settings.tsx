import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BellRing,
  Check,
  Database,
  Download,
  Droplet,
  HeartHandshake,
  Info,
  Loader2,
  LogOut,
  MapPin,
  ShieldBan,
  ShieldCheck,
  Smartphone,
  Trash2,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { BlockUserButton } from "@/components/common/dialogs";
import {
  DemoBadge,
  EmptyState,
  InfoNote,
  PageHeader,
  Pill,
  SkeletonCard,
  SuccessNote,
  VerificationBadge,
} from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/components/providers/auth-provider";
import { usePwa } from "@/components/providers/pwa-provider";
import { BRAND, PRIVACY_PROMISE, SAFETY_RULES } from "@/lib/brand";
import { REPORT_REASON_LABELS } from "@/lib/labels";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/labels";
import { USER_ROLES, type UserRole } from "@/lib/domain";
import { formatDate, maskPhone, relativeTime } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { errorMessage, unwrapAction } from "@/lib/actions";
import { updateRole } from "@/server/api/auth";
import { unblockUser } from "@/server/api/safety";
import { fetchBlockedUsers, fetchMyReports } from "@/server/api/safety";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/settings")({
  head: () =>
    pageHead({
      title: "Settings — Heal Connect",
      description:
        "Manage your role, privacy, notifications, blocked accounts and the reports you have raised.",
      noIndex: true,
    }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, refresh, signOut } = useAuth();
  const { canInstall, promptInstall, isStandalone, isIos, installDismissed } = usePwa();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [roleDraft, setRoleDraft] = useState<UserRole>(user?.role ?? "recipient");
  const [savedRole, setSavedRole] = useState(false);

  const blocked = useQuery({
    queryKey: queryKeys.blockedUsers,
    queryFn: async () => unwrapAction(await fetchBlockedUsers()),
  });

  const reports = useQuery({
    queryKey: queryKeys.myReports,
    queryFn: async () => unwrapAction(await fetchMyReports()),
  });

  const roleMutation = useMutation({
    mutationFn: async (role: UserRole) => unwrapAction(await updateRole({ data: { role } })),
    onSuccess: async (_data, role) => {
      setSavedRole(true);
      toast.success(`Role updated to ${ROLE_LABELS[role]}`, {
        description:
          role === "recipient"
            ? "Donor details were hidden. You can switch back at any time."
            : "Your dashboard and matching will use the new role right away.",
      });
      await refresh();
      void queryClient.invalidateQueries();
    },
    onError: (error) => {
      setSavedRole(false);
      toast.error("Could not update your role", { description: errorMessage(error) });
    },
  });

  const unblock = useMutation({
    mutationFn: async (userId: string) => unwrapAction(await unblockUser({ data: { userId } })),
    onSuccess: () => {
      toast.success("Member unblocked");
      void queryClient.invalidateQueries({ queryKey: queryKeys.blockedUsers });
    },
    onError: (error) => toast.error("Could not unblock", { description: errorMessage(error) }),
  });

  if (!user) {
    return (
      <div className="page-shell max-w-3xl py-8">
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="page-shell max-w-3xl space-y-6 py-8">
      <PageHeader
        title="Settings"
        description="Your role, privacy, notifications and safety controls in one place."
        actions={
          <Button variant="outline" onClick={() => void signOut()}>
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="primary">{ROLE_LABELS[user.role]}</Pill>
          <VerificationBadge status={user.verificationStatus} />
          {user.isDemo ? <DemoBadge /> : null}
        </div>
      </PageHeader>

      {/* Account */}
      <section className="surface space-y-4 p-6" aria-labelledby="account-heading">
        <h2 id="account-heading" className="font-display text-lg font-extrabold">
          Account
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Name
            </dt>
            <dd className="mt-1 text-sm font-semibold">{user.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Email
            </dt>
            <dd className="mt-1 text-sm">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Contact number
            </dt>
            <dd className="mt-1 text-sm">{maskPhone(user.profile.phone)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Member since
            </dt>
            <dd className="mt-1 text-sm">{formatDate(user.createdAt)}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/profile">Edit profile details</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/verify">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Verification
            </Link>
          </Button>
        </div>
      </section>

      {/* Role */}
      <section className="surface space-y-4 p-6" aria-labelledby="role-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="role-heading" className="font-display text-lg font-extrabold">
            How you take part
          </h2>
          {savedRole ? <SuccessNote>Role updated</SuccessNote> : null}
        </div>
        <p className="text-sm text-muted-foreground">
          Changing your role changes which tools you see first. You can switch back whenever you
          like — it never deletes your history.
        </p>
        <div className="grid gap-3">
          {USER_ROLES.map((role) => {
            const active = roleDraft === role;
            const Icon = role === "donor" ? Droplet : role === "recipient" ? HeartHandshake : Users;
            return (
              <button
                key={role}
                type="button"
                aria-pressed={active}
                onClick={() => setRoleDraft(role)}
                className={`flex items-start gap-4 rounded-2xl border p-4 text-left transition ${
                  active
                    ? "border-primary bg-primary-soft"
                    : "border-border bg-card hover:bg-accent/60"
                }`}
              >
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                    active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="flex items-center gap-2 font-semibold">
                    {ROLE_LABELS[role]}
                    {active ? <Check className="size-4 text-primary" aria-hidden="true" /> : null}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {ROLE_DESCRIPTIONS[role]}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex justify-end">
          <Button
            onClick={() => roleMutation.mutate(roleDraft)}
            disabled={roleMutation.isPending || roleDraft === user.role}
          >
            {roleMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="size-4" aria-hidden="true" />
            )}
            Save role
          </Button>
        </div>
      </section>

      {/* Privacy */}
      <section className="surface space-y-4 p-6" aria-labelledby="privacy-heading">
        <h2 id="privacy-heading" className="font-display text-lg font-extrabold">
          Privacy
        </h2>
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4 rounded-2xl border border-border p-4">
            <div>
              <p className="text-sm font-semibold">Share my contact number when matched</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Controls whether a coordinator who accepted your offer can see your number.
              </p>
            </div>
            <Switch
              checked={user.profile.sharePhoneWithMatches}
              onCheckedChange={(next) => {
                toast.info(next ? "Enable in your profile" : "Update in your profile", {
                  description:
                    "Phone sharing is stored with your profile — open Donor profile to change it.",
                });
              }}
              aria-label="Share phone when matched"
            />
          </div>
          <div className="flex items-start justify-between gap-4 rounded-2xl border border-border p-4">
            <div>
              <p className="text-sm font-semibold">Show me in the donor directory</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {user.donorProfile
                  ? user.donorProfile.isVisibleToRecipients
                    ? "Currently visible at city and area level."
                    : "Currently hidden from the directory."
                  : "Available once you add donor details."}
              </p>
            </div>
            <Switch
              checked={Boolean(user.donorProfile?.isVisibleToRecipients)}
              disabled={!user.donorProfile}
              onCheckedChange={() =>
                toast.info("Update visibility in your donor profile", {
                  description: "Directory visibility lives next to your donation details.",
                })
              }
              aria-label="Visible in donor directory"
            />
          </div>
        </div>
        <InfoNote tone="primary" icon={MapPin} title="Location">
          {PRIVACY_PROMISE} Requests never carry a street address, and your stored coordinates are
          rounded to about a kilometre.
        </InfoNote>
      </section>

      {/* Notifications */}
      <section className="surface space-y-4 p-6" aria-labelledby="notifications-heading">
        <h2 id="notifications-heading" className="font-display text-lg font-extrabold">
          Notifications
        </h2>
        <div className="grid gap-3">
          {[
            {
              label: "Matching requests near me",
              detail: "When a compatible request is posted in your area.",
            },
            {
              label: "Donor responses and updates",
              detail: "Offers, acceptances and withdrawals.",
            },
            { label: "Request status changes", detail: "Cancellations, fulfilments and edits." },
            {
              label: "Verification decisions",
              detail: "When your verification is approved or needs attention.",
            },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-start justify-between gap-4 rounded-2xl border border-border p-4"
            >
              <div>
                <p className="text-sm font-semibold">{row.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{row.detail}</p>
              </div>
              <Switch
                defaultChecked
                onCheckedChange={() =>
                  toast.info("In-app alerts are always on", {
                    description:
                      "Push notifications are not enabled in this MVP. The notification service is structured so they can be added without changing your settings.",
                  })
                }
                aria-label={`${row.label} alerts`}
              />
            </div>
          ))}
        </div>
        <InfoNote tone="info" icon={BellRing} title="Push notifications coming next">
          Today you get in-app notifications, and the badge in the header updates automatically. Web
          push is scaffolded behind the same service so this setting can control it once enabled.
        </InfoNote>
      </section>

      {/* Install */}
      <section className="surface space-y-3 p-6" aria-labelledby="install-heading">
        <h2 id="install-heading" className="font-display text-lg font-extrabold">
          App
        </h2>
        {isStandalone ? (
          <SuccessNote>Heal Connect is installed on this device.</SuccessNote>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4">
            <div>
              <p className="text-sm font-semibold">Install Heal Connect</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {isIos
                  ? "On iOS: tap Share, then “Add to Home Screen”."
                  : installDismissed
                    ? "You dismissed the install prompt earlier — you can still install from your browser menu."
                    : "Adds an app icon, offline support and a native-feeling navigation bar."}
              </p>
            </div>
            <Button
              onClick={async () => {
                const outcome = await promptInstall();
                if (outcome === "unavailable") {
                  toast.info("Use your browser menu", {
                    description:
                      "Choose “Install app” or “Add to Home Screen” from the browser menu.",
                  });
                }
              }}
              disabled={!canInstall}
            >
              <Download className="size-4" aria-hidden="true" />
              Install
            </Button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Pill tone="primary">
            <Smartphone className="size-3.5" aria-hidden="true" />
            Offline fallback included
          </Pill>
          <Pill tone="neutral">Safe-area aware navigation</Pill>
        </div>
      </section>

      {/* Safety */}
      <section className="surface space-y-4 p-6" aria-labelledby="safety-heading">
        <h2 id="safety-heading" className="font-display text-lg font-extrabold">
          Safety and blocking
        </h2>
        <InfoNote tone="warning" title="Safety rules">
          <ul className="list-disc space-y-1 pl-4">
            {SAFETY_RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </InfoNote>

        <div>
          <h3 className="flex items-center gap-2 font-display text-sm font-bold">
            <ShieldBan className="size-4 text-primary" aria-hidden="true" />
            Blocked members
          </h3>
          {blocked.data?.items.length ? (
            <ul className="mt-3 space-y-2">
              {blocked.data.items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-3"
                >
                  <div>
                    <p className="text-sm font-semibold">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Blocked {relativeTime(item.blockedAt)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <BlockUserButton userId={item.id} name={item.name} blocked />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => unblock.mutate(item.id)}
                      disabled={unblock.isPending}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              You have not blocked anyone. Blocking hides each other's requests and offers
              instantly.
            </p>
          )}
        </div>

        <div>
          <h3 className="flex items-center gap-2 font-display text-sm font-bold">
            <Info className="size-4 text-primary" aria-hidden="true" />
            Reports you raised
          </h3>
          {reports.data?.items.length ? (
            <ul className="mt-3 space-y-2">
              {reports.data.items.map((report) => (
                <li key={report.id} className="rounded-2xl border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{report.targetLabel}</p>
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
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {REPORT_REASON_LABELS[report.reason]} · {relativeTime(report.createdAt)}
                  </p>
                  {report.resolutionNote ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Reviewer note: {report.resolutionNote}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              You have not reported anything. Reports are only visible to platform moderators.
            </p>
          )}
        </div>
      </section>

      {/* Data */}
      <section className="surface space-y-4 p-6" aria-labelledby="data-heading">
        <h2 id="data-heading" className="font-display text-lg font-extrabold">
          Your data
        </h2>
        <p className="text-sm text-muted-foreground">
          We store your account details, the profile fields you provide, and the requests and offers
          you make. We never ask for ID documents, medical reports or bank details.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const payload = {
                exportedAt: new Date().toISOString(),
                account: {
                  id: user.id,
                  name: user.name,
                  email: user.email,
                  role: user.role,
                  verificationStatus: user.verificationStatus,
                  createdAt: user.createdAt,
                },
                profile: user.profile,
                donorProfile: user.donorProfile,
              };
              const blob = new Blob([JSON.stringify(payload, null, 2)], {
                type: "application/json",
              });
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement("a");
              anchor.href = url;
              anchor.download = "heal-connect-my-data.json";
              anchor.click();
              URL.revokeObjectURL(url);
              toast.success("Download started", {
                description: "This file contains your account and profile data only.",
              });
            }}
          >
            <Download className="size-4" aria-hidden="true" />
            Export my data
          </Button>
          <Button asChild variant="ghost">
            <Link to="/privacy">
              <Database className="size-4" aria-hidden="true" />
              Read the privacy policy
            </Link>
          </Button>
        </div>
        <InfoNote tone="neutral" title="Deleting your account">
          Data deletion is handled by our team in this MVP. Email{" "}
          <a className="font-semibold underline" href={`mailto:${BRAND.supportEmail}`}>
            {BRAND.supportEmail}
          </a>{" "}
          from your registered address and we will remove your account, profile and contact details.
          Requests you raised are removed as well; fulfilled donation counts are kept anonymously
          for reporting.
        </InfoNote>
      </section>

      {/* Danger zone */}
      <section
        className="surface space-y-3 border-destructive/30 p-6"
        aria-labelledby="danger-heading"
      >
        <h2 id="danger-heading" className="font-display text-lg font-extrabold text-destructive">
          Sign out everywhere
        </h2>
        <p className="text-sm text-muted-foreground">
          Signing out clears your session cookie on this device. If you suspect your account was
          accessed by someone else, sign out and contact support immediately.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="destructive" onClick={() => void signOut()}>
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </Button>
          <Button variant="ghost" onClick={() => void navigate({ to: "/safety" })}>
            Safety guidelines
          </Button>
        </div>
      </section>

      {blocked.isError || reports.isError ? (
        <EmptyState
          icon={ShieldCheck}
          title="Some settings could not be loaded"
          description="Blocked members and reports are temporarily unavailable. Everything else on this page still works."
        />
      ) : null}
    </div>
  );
}
