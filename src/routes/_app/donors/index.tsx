import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { BadgeCheck, Droplet, HeartHandshake, MapPin, Search, ShieldCheck, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { SimplePagination } from "@/components/common/pagination";
import {
  AvailabilityBadge,
  BloodGroupChip,
  DemoBadge,
  EmptyState,
  ErrorState,
  InfoNote,
  PageHeader,
  Pill,
  SkeletonGrid,
  VerificationBadge,
} from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/components/providers/auth-provider";
import { AVAILABILITY_LABELS, AVAILABILITY_TONES, BLOOD_GROUP_TONES } from "@/lib/labels";
import { AVAILABILITY_STATES, BLOOD_GROUPS, type Availability, type BloodGroup } from "@/lib/domain";
import { formatDate, initials } from "@/lib/format";
import { formatDistance } from "@/lib/geo";
import { queryKeys } from "@/lib/query-keys";
import { errorMessage, unwrapAction } from "@/lib/actions";
import { updateLocation } from "@/server/api/profile";
import { listVolunteers } from "@/server/api/profile";

export const Route = createFileRoute("/_app/donors/")({
  head: () => ({
    meta: [
      { title: "Donor directory — Heal Connect" },
      {
        name: "description",
        content:
          "Browse voluntary donors by blood group, city, area and availability. Contact details stay private until a match is confirmed.",
      },
    ],
  }),
  component: DonorsPage,
});

const PER_PAGE = 12;

function DonorsPage() {
  const { user, refresh } = useAuth();
  const [q, setQ] = useState("");
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | "">("");
  const [city, setCity] = useState("");
  const [availability, setAvailability] = useState<Availability | "">("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [radiusKm, setRadiusKm] = useState("");
  const [page, setPage] = useState(1);

  const location = user?.profile.approxLat != null && user?.profile.approxLng != null
    ? { lat: user.profile.approxLat, lng: user.profile.approxLng }
    : null;

  const queryInput = useMemo(() => {
    const input: Record<string, unknown> = { page, perPage: PER_PAGE };
    if (q) input["q"] = q;
    if (bloodGroup) input["bloodGroup"] = bloodGroup;
    if (city) input["city"] = city;
    if (availability) input["availability"] = availability;
    if (verifiedOnly) input["verifiedOnly"] = true;
    if (radiusKm) input["radiusKm"] = Number(radiusKm);
    if (location) {
      input["lat"] = location.lat;
      input["lng"] = location.lng;
    }
    return input;
  }, [availability, bloodGroup, city, location, page, q, radiusKm, verifiedOnly]);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: queryKeys.volunteers(queryInput),
    queryFn: async () => unwrapAction(await listVolunteers({ data: queryInput })),
    placeholderData: keepPreviousData,
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
          () => reject(new Error("We could not get your location. You can filter by city instead.")),
          { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
        );
      }),
    onSuccess: async (coords) => {
      try {
        unwrapAction(await updateLocation({ data: coords }));
        await refresh();
        toast.success("Location saved at city-level precision");
        void refetch();
      } catch (error) {
        toast.error("Could not save your location", { description: errorMessage(error) });
      }
    },
    onError: (error) => toast.error("Location unavailable", { description: errorMessage(error) }),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.perPage)) : 1;

  return (
    <div className="page-shell space-y-6 py-8">
      <PageHeader
        title="Donor directory"
        description="Self-reported donor profiles, shown at city and area level only. Use it to see who can help near you — then raise a request so coordination stays structured and safe."
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
                <HeartHandshake className="size-4" aria-hidden="true" />
                Request help
              </Link>
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {data ? <Pill tone="primary">{data.total} donors listed</Pill> : null}
          <Pill tone="neutral">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            No phone numbers or addresses shown
          </Pill>
          {isFetching ? <Pill tone="info">Updating…</Pill> : null}
        </div>
      </PageHeader>

      <InfoNote tone="primary" title="Why you cannot contact donors directly here">
        Direct outreach to donors invites misuse and pressure. Raise a request instead — matching donors are notified,
        and contact details are exchanged only after a donor offers help and the coordinator accepts. Never ask donors
        for payment.
      </InfoNote>

      <div className="surface space-y-4 p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="donor-q">Search</Label>
            <Input
              id="donor-q"
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setPage(1);
              }}
              placeholder="Name, city or area"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="donor-group">Blood group</Label>
            <Select
              value={bloodGroup || "any"}
              onValueChange={(value) => {
                setBloodGroup(value === "any" ? "" : (value as BloodGroup));
                setPage(1);
              }}
            >
              <SelectTrigger id="donor-group">
                <SelectValue placeholder="Any group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any group</SelectItem>
                {BLOOD_GROUPS.map((group) => (
                  <SelectItem key={group} value={group}>
                    {group}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="donor-city">City</Label>
            <Input
              id="donor-city"
              value={city}
              onChange={(event) => {
                setCity(event.target.value);
                setPage(1);
              }}
              placeholder="Any city"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="donor-availability">Availability</Label>
            <Select
              value={availability || "any"}
              onValueChange={(value) => {
                setAvailability(value === "any" ? "" : (value as Availability));
                setPage(1);
              }}
            >
              <SelectTrigger id="donor-availability">
                <SelectValue placeholder="Any availability" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any availability</SelectItem>
                {AVAILABILITY_STATES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {AVAILABILITY_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="donor-radius">Distance</Label>
            <Select
              value={radiusKm || "any"}
              onValueChange={(value) => {
                setRadiusKm(value === "any" ? "" : value);
                setPage(1);
              }}
            >
              <SelectTrigger id="donor-radius">
                <SelectValue placeholder="Any distance" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any distance</SelectItem>
                <SelectItem value="5">Within 5 km</SelectItem>
                <SelectItem value="15">Within 15 km</SelectItem>
                <SelectItem value="40">Within 40 km</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col justify-end gap-3">
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border-input accent-primary"
                checked={verifiedOnly}
                onChange={(event) => {
                  setVerifiedOnly(event.target.checked);
                  setPage(1);
                }}
              />
              Verified accounts only
            </label>
            <Button variant="outline" onClick={() => locate.mutate()} disabled={locate.isPending}>
              <MapPin className="size-4" aria-hidden="true" />
              {location ? "Refresh my location" : locatingLabel(locate.isPending)}
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <SkeletonGrid count={6} />
      ) : isError || !data ? (
        <ErrorState description="We could not load the donor directory." onRetry={() => void refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No donors match these filters"
          description="Try a different blood group, widen the distance, or clear the availability filter."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setQ("");
                setBloodGroup("");
                setCity("");
                setAvailability("");
                setVerifiedOnly(false);
                setRadiusKm("");
                setPage(1);
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((donor) => (
              <li key={donor.id}>
                <article className="surface surface-hover flex h-full flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {donor.avatarUrl ? (
                        <img src={donor.avatarUrl} alt="" className="size-11 rounded-2xl object-cover" />
                      ) : (
                        <span className="grid size-11 place-items-center rounded-2xl bg-primary-soft font-display text-sm font-extrabold text-primary">
                          {initials(donor.name)}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-display text-base font-bold">{donor.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[donor.area, donor.city].filter(Boolean).join(", ") || "Location not shared"}
                        </p>
                      </div>
                    </div>
                    <BloodGroupChip group={donor.bloodGroup} size="sm" />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <AvailabilityBadge availability={donor.availability} />
                    <VerificationBadge status={donor.verificationStatus} compact />
                    {donor.isDemo ? <DemoBadge /> : null}
                  </div>

                  <dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>
                      <dt className="font-semibold text-foreground">Distance</dt>
                      <dd>{donor.distanceKm != null ? formatDistance(donor.distanceKm) : "Not available"}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-foreground">Last donation</dt>
                      <dd>{donor.lastDonationDate ? formatDate(donor.lastDonationDate) : "Not recorded"}</dd>
                    </div>
                  </dl>

                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${BLOOD_GROUP_TONES[donor.bloodGroup ?? "O+"]} ${donor.bloodGroup ? "" : "opacity-60"}`}
                    >
                      Self-reported details
                    </span>
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/donors/$userId" params={{ userId: donor.id }}>
                        View profile
                      </Link>
                    </Button>
                  </div>
                </article>
              </li>
            ))}
          </ul>

          <SimplePagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />

          <InfoNote tone="warning" title="Compatibility is not decided here">
            {data.bloodGroupFilterSupport} Donor availability is self-reported and may be out of date — always confirm
            through the hospital or blood bank before relying on it.
          </InfoNote>
        </>
      )}

      <InfoNote tone="blood" title="Want to appear here?">
        Donors can opt in from their donor profile by keeping “Visible to recipients” enabled, and by setting an
        accurate availability status.{" "}
        <Link to="/profile" className="font-semibold underline">
          Open donor profile
        </Link>
        . Availability labels: {AVAILABILITY_STATES.map((state) => AVAILABILITY_TONES[state]).length > 0 ? "" : ""}
        available, available with notice, not available.
      </InfoNote>

      <div className="surface flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="flex items-center gap-3">
          <Droplet className="size-5 text-blood" aria-hidden="true" />
          <p className="text-sm">
            <span className="font-semibold">Ready to donate?</span> Keep your availability current so families are not
            waiting on donors who cannot travel.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/profile">
            <BadgeCheck className="size-4" aria-hidden="true" />
            Update availability
          </Link>
        </Button>
      </div>
    </div>
  );
}

function locatingLabel(pending: boolean) {
  return pending ? "Getting your location…" : "Use my location for distance";
}
