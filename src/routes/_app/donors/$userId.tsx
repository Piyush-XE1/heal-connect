import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  Droplet,
  Lock,
  MapPin,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { BlockUserButton, ReportButton } from "@/components/common/dialogs";
import {
  AvailabilityBadge,
  BloodGroupChip,
  DemoBadge,
  ErrorState,
  InfoNote,
  PageHeader,
  Pill,
  SkeletonCard,
  SkeletonLines,
  StatTile,
  VerificationBadge,
} from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { COMPATIBILITY_DISCLAIMER } from "@/lib/blood";
import { formatDate, initials, relativeTime } from "@/lib/format";
import { areasForCity } from "@/lib/cities";
import { queryKeys } from "@/lib/query-keys";
import { errorMessage, unwrapAction } from "@/lib/actions";
import { fetchPublicProfile, updateLocation } from "@/server/api/profile";
import { fetchMyBlockStatus } from "@/server/api/safety";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/donors/$userId")({
  head: () =>
    pageHead({
      title: "Donor profile — Heal Connect",
      description:
        "Public donor summary with blood group, city, availability and verification status. Contact details and exact locations are never public.",
      noIndex: true,
    }),
  component: DonorProfilePage,
});

function DonorProfilePage() {
  const { userId } = Route.useParams();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.publicProfile(userId),
    queryFn: async () => unwrapAction(await fetchPublicProfile({ data: { userId } })),
  });

  const { data: blockStatus } = useQuery({
    queryKey: ["block-status", userId],
    queryFn: async () => unwrapAction(await fetchMyBlockStatus({ data: { userId } })),
  });

  const locate = useMutation({
    mutationFn: async () =>
      new Promise<{ lat: number; lng: number }>((resolve, reject) => {
        if (!("geolocation" in navigator)) {
          reject(new Error("This browser does not support location."));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
          () => reject(new Error("We could not get your location.")),
          { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
        );
      }),
    onSuccess: async (coords) => {
      try {
        unwrapAction(await updateLocation({ data: coords }));
        toast.success("Location updated at city-level precision");
      } catch (error) {
        toast.error("Could not save your location", { description: errorMessage(error) });
      }
    },
    onError: (error) => toast.error("Location unavailable", { description: errorMessage(error) }),
  });

  if (isLoading) {
    return (
      <div className="page-shell max-w-3xl space-y-4 page-y">
        <SkeletonCard />
        <SkeletonLines count={5} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="page-shell max-w-3xl page-y">
        <ErrorState
          title="We could not load this profile"
          description="The member may have removed their profile or been suspended."
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  return (
    <div className="page-shell max-w-3xl space-y-6 page-y">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/donors">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to directory
          </Link>
        </Button>
        {blockStatus ? (
          <div className="flex items-center gap-2">
            <BlockUserButton userId={data.id} name={data.name} blocked={blockStatus.blocked} />
            <ReportButton targetType="user" targetId={data.id} />
          </div>
        ) : null}
      </div>

      <PageHeader
        title={data.name}
        description={data.bio ?? "This member has not added an introduction yet."}
      >
        <div className="flex flex-wrap items-center gap-2">
          <VerificationBadge status={data.verificationStatus} />
          <AvailabilityBadge availability={data.availability} />
          {data.organizationName ? <Pill tone="info">{data.organizationName}</Pill> : null}
          {data.isDemo ? <DemoBadge /> : null}
        </div>
      </PageHeader>

      <section className="surface space-y-4 p-5 sm:space-y-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {data.avatarUrl ? (
              <img src={data.avatarUrl} alt="" className="size-16 rounded-3xl object-cover" />
            ) : (
              <span className="grid size-16 place-items-center rounded-3xl bg-primary-soft font-display text-xl font-extrabold text-primary">
                {initials(data.name)}
              </span>
            )}
            <div>
              <p className="flex items-center gap-2 font-display text-lg font-bold">
                <UserRound className="size-4 text-primary" aria-hidden="true" />
                {data.role === "donor"
                  ? "Donor"
                  : data.role === "recipient"
                    ? "Recipient"
                    : "Donor & Recipient"}
              </p>
              <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="size-4 text-primary" aria-hidden="true" />
                {[data.area, data.city].filter(Boolean).join(", ") || "Location not shared"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Member since {formatDate(data.memberSince)}
              </p>
            </div>
          </div>
          <BloodGroupChip group={data.bloodGroup} size="lg" />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile
            label="Completed donations"
            value={data.completedDonations}
            icon={Droplet}
            tone="blood"
          />
          <StatTile
            label="Active requests"
            value={data.activeRequests}
            icon={CalendarClock}
            tone="primary"
          />
          <StatTile
            label="Last donation"
            value={data.lastDonationDate ? formatDate(data.lastDonationDate) : "—"}
            icon={ShieldCheck}
            tone="success"
          />
        </div>

        {data.organizationType && data.organizationType !== "individual_donor" ? (
          <InfoNote tone="info" icon={BadgeCheck} title="Organisation account">
            This account is registered as {data.organizationType.replace(/_/g, " ")} — verified
            information reviewed by our trust &amp; safety team. Organisation accounts can be
            hospitals, blood banks, NGOs or patient support groups.
          </InfoNote>
        ) : null}
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <InfoNote tone="primary" icon={Lock} title="What stays private">
          {data.privacyNote} {COMPATIBILITY_DISCLAIMER}
        </InfoNote>
        <div className="surface space-y-3 p-4 sm:p-5">
          <h2 className="font-display text-sm font-bold">Need this donor's help?</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Raise a request with the hospital and requirement details. Matching donors are notified
            automatically, and they can offer to help. Direct messaging is intentionally not
            available before a match.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/requests/new">Raise a request</Link>
            </Button>
            {data.city && areasForCity(data.city).length > 0 ? (
              <Button asChild variant="outline">
                <Link to="/find-help">Requests in {data.city}</Link>
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => locate.mutate()} disabled={locate.isPending}>
              <MapPin className="size-4" aria-hidden="true" />
              Update my location
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Profile last active {relativeTime(data.memberSince)} · Availability is self-reported.
          </p>
        </div>
      </section>
    </div>
  );
}
