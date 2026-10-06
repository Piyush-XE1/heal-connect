import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Droplet, Info, MapPin, Plus, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  EmptyState,
  ErrorState,
  InfoNote,
  PageHeader,
  Pill,
  SkeletonGrid,
} from "@/components/common/primitives";
import { RequestCard } from "@/components/requests/request-card";
import {
  RequestFilters,
  EMPTY_FILTERS,
  type FilterState,
} from "@/components/requests/request-filters";
import { RespondDialog } from "@/components/requests/respond-dialog";
import { Button } from "@/components/ui/button";
import { SimplePagination } from "@/components/common/pagination";
import { useAuth } from "@/components/providers/auth-provider";
import { MATCHING_EXPLAINER, MEDICAL_DECISION_DISCLAIMER } from "@/lib/blood";
import { queryKeys } from "@/lib/query-keys";
import { errorMessage, unwrapAction } from "@/lib/actions";
import { updateLocation } from "@/server/api/profile";
import {
  fetchRequestFiltersMeta,
  searchRequests,
  type RequestSearchItem,
} from "@/server/api/requests";
import type { BloodGroup, RequestType, Urgency } from "@/lib/domain";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/find-help")({
  head: () =>
    pageHead({
      title: "Find help requests — Heal Connect",
      description:
        "Search open blood, platelet and medical assistance requests by blood group, city, area, distance and urgency.",
      noIndex: true,
    }),
  component: FindHelpPage,
});

const PER_PAGE = 9;

function FindHelpPage() {
  const { user, refresh } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [respondItem, setRespondItem] = useState<RequestSearchItem | null>(null);

  const { data: meta } = useQuery({
    queryKey: queryKeys.requestFiltersMeta,
    queryFn: () => fetchRequestFiltersMeta(),
    staleTime: 5 * 60_000,
  });

  const location = useMemo(
    () =>
      user?.profile.approxLat != null && user?.profile.approxLng != null
        ? { lat: user.profile.approxLat, lng: user.profile.approxLng }
        : null,
    [user?.profile.approxLat, user?.profile.approxLng],
  );

  const queryInput = useMemo(() => {
    const input: Record<string, unknown> = {
      sort: filters.sort,
      page,
      perPage: PER_PAGE,
    };
    if (filters.q) input["q"] = filters.q;
    if (filters.bloodGroup) input["bloodGroup"] = filters.bloodGroup as BloodGroup;
    if (filters.city) input["city"] = filters.city;
    if (filters.area) input["area"] = filters.area;
    if (filters.urgency) input["urgency"] = filters.urgency as Urgency;
    if (filters.requestType) input["requestType"] = filters.requestType as RequestType;
    if (filters.requiredFrom) input["requiredFrom"] = filters.requiredFrom;
    if (filters.requiredTo) input["requiredTo"] = filters.requiredTo;
    if (filters.radiusKm) input["radiusKm"] = Number(filters.radiusKm);
    if (location) {
      input["lat"] = location.lat;
      input["lng"] = location.lng;
    }
    return input;
  }, [filters, location, page]);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: queryKeys.requests(queryInput),
    queryFn: async () => unwrapAction(await searchRequests({ data: queryInput })),
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
          (error) => {
            const messages: Record<number, string> = {
              1: "Location permission was denied. You can still filter by city.",
              2: "Your location is unavailable right now. Try again in a moment.",
              3: "Getting your location timed out. Please try again.",
            };
            reject(new Error(messages[error.code] ?? "Could not get your location."));
          },
          { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
        );
      }),
    onSuccess: async (coords) => {
      try {
        const result = unwrapAction(await updateLocation({ data: coords }));
        await refresh();
        toast.success("Location saved at city-level precision", {
          description: result.suggestedCity
            ? `We rounded it to about a kilometre. Nearest city: ${result.suggestedCity}.`
            : "We rounded it to about a kilometre. It is never shown to anyone else.",
        });
        void queryClient.invalidateQueries({ queryKey: ["requests"] });
        void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      } catch (error) {
        toast.error("Could not save your location", { description: errorMessage(error) });
      }
    },
    onError: (error) => toast.error("Location unavailable", { description: errorMessage(error) }),
  });

  const update = (next: Partial<FilterState>) => {
    setFilters((current) => ({ ...current, ...next }));
    setPage(1);
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.perPage)) : 1;

  return (
    <div className="page-shell space-y-6 py-8">
      <PageHeader
        title="Find help requests"
        description="Every open request in your area — filtered the way you want. Compatibility shown here is general guidance only; the blood bank confirms the final match."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/donors">
                <Users className="size-4" aria-hidden="true" />
                Donor directory
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
          {data ? <Pill tone="primary">{data.total} open requests</Pill> : null}
          {user?.donorProfile?.bloodGroup ? (
            <Pill tone="blood">
              <Droplet className="size-3.5" aria-hidden="true" />
              Your group {user.donorProfile.bloodGroup}
            </Pill>
          ) : (
            <Pill tone="warning">Add your blood group for compatibility matching</Pill>
          )}
          {location ? (
            <Pill tone="success">
              <MapPin className="size-3.5" aria-hidden="true" />
              Distance enabled
            </Pill>
          ) : (
            <Pill tone="neutral">
              <MapPin className="size-3.5" aria-hidden="true" />
              No location set
            </Pill>
          )}
          {isFetching ? <Pill tone="info">Updating…</Pill> : null}
        </div>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[19rem_1fr] lg:items-start">
        <div className="lg:sticky lg:top-24">
          <RequestFilters
            filters={filters}
            onChange={update}
            onReset={() => {
              setFilters(EMPTY_FILTERS);
              setPage(1);
            }}
            cities={meta?.cities ?? []}
            resultCount={data?.total ?? 0}
            onLocationRequest={() => locate.mutate()}
            hasLocation={Boolean(location)}
            locating={locate.isPending}
          />
        </div>

        <div className="space-y-4">
          {!user?.donorProfile?.bloodGroup && user?.role !== "recipient" ? (
            <InfoNote tone="warning" title="Complete your donor profile for smarter matches">
              Add your blood group, availability and travel preference so requests are ranked for
              you.{" "}
              <Link to="/profile" className="font-semibold underline">
                Open donor profile
              </Link>
            </InfoNote>
          ) : null}

          {isLoading ? (
            <SkeletonGrid count={6} />
          ) : isError ? (
            <ErrorState
              description="We could not load requests right now. Check your connection and try again."
              onRetry={() => void refetch()}
            />
          ) : data && data.items.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No requests match these filters"
              description="Try widening the distance, clearing the urgency filter, or searching by city instead of area. New requests appear here as soon as they are posted."
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setFilters(EMPTY_FILTERS);
                    setPage(1);
                  }}
                >
                  Clear all filters
                </Button>
              }
            />
          ) : (
            <>
              <div className="grid gap-4 xl:grid-cols-2">
                {data?.items.map((item) => (
                  <RequestCard
                    key={item.id}
                    item={item}
                    {...(data.viewer.canMatch && !item.isOwn && item.status === "open"
                      ? { onRespond: (selected: RequestSearchItem) => setRespondItem(selected) }
                      : {})}
                  />
                ))}
              </div>

              {totalPages > 1 ? (
                <SimplePagination
                  className="pt-2"
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={(next) => {
                    setPage(next);
                    void navigate({ to: "/find-help", replace: true });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              ) : null}
            </>
          )}

          <InfoNote tone="info" icon={Info} title="How ranking works">
            {MATCHING_EXPLAINER} {MEDICAL_DECISION_DISCLAIMER}
          </InfoNote>
        </div>
      </div>

      <RespondDialog
        item={respondItem}
        open={Boolean(respondItem)}
        onOpenChange={(open) => {
          if (!open) setRespondItem(null);
        }}
      />
    </div>
  );
}
