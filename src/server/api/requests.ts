import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { cityCoordinates, offsetPoint } from "@/lib/cities";
import {
  BLOOD_GROUPS,
  type RequestView,
  type Urgency,
  type UserRole,
  type VerificationStatus,
} from "@/lib/domain";
import { roundCoord } from "@/lib/geo";
import { sortByMatchScore, type MatchResult } from "@/lib/matching";
import { requestBaseSchema, requestSchema, searchFiltersSchema } from "@/lib/validation";

import { getSessionUser, requireActiveUser, requireUser } from "../auth/session";
import { getDb, mutate, newId, nowIso } from "../db/store";
import { forbidden, invalid, notFound } from "../errors";
import {
  buildDonorContext,
  createNotification,
  notifyMatchingDonors,
  scoreRequestForDonor,
} from "../services/notifications";
import { effectiveStatus, sweepExpiredRequests } from "../services/sweep";
import { enforceRateLimit } from "../services/rate-limit";
import { toDonorResponseView, toRequestView, type ViewerContext } from "../services/views";
import { action } from "./result";

export type RequestSearchItem = RequestView & {
  match: MatchResult | null;
  /** True when the request was raised by the viewer. */
  isOwn: boolean;
};

export type RequestSearchResult = {
  items: RequestSearchItem[];
  total: number;
  page: number;
  perPage: number;
  viewer: {
    canMatch: boolean;
    bloodGroup: string | null;
    hasLocation: boolean;
  };
};

const OPEN_STATUSES = new Set(["open", "in_progress"]);

export const searchRequests = createServerFn({ method: "GET" })
  .validator(searchFiltersSchema)
  .handler(async ({ data }): Promise<RequestSearchResult> => {
    const database = await getDb();
    const session = await getSessionUser();
    const donor = buildDonorContext(database, session?.id ?? null);

    const viewerPoint =
      typeof data.lat === "number" && typeof data.lng === "number"
        ? { lat: data.lat, lng: data.lng }
        : donor.point;

    const viewer: ViewerContext = {
      userId: session?.id ?? null,
      isAdmin: Boolean(session?.isAdmin),
      point: viewerPoint,
    };

    const perPage = data.perPage ?? 9;
    const page = data.page ?? 1;
    const statusFilter = data.status ? new Set([data.status]) : OPEN_STATUSES;

    let rows = database.helpRequests.filter((row) => {
      const status = effectiveStatus(row);
      if (!statusFilter.has(status)) return false;
      if (status === "removed" && !session?.isAdmin) return false;
      // Drafts are private: only their author (or a moderator) can see them.
      if (status === "draft" && row.requesterId !== session?.id && !session?.isAdmin) return false;
      if (data.bloodGroup && row.bloodGroup !== data.bloodGroup) return false;
      if (data.urgency && row.urgency !== data.urgency) return false;
      if (data.requestType && row.requestType !== data.requestType) return false;
      if (data.city && row.city.toLowerCase() !== data.city.toLowerCase()) return false;
      if (data.area && !(row.area ?? "").toLowerCase().includes(data.area.toLowerCase())) return false;
      if (data.requiredFrom && row.requiredBy < data.requiredFrom) return false;
      if (data.requiredTo && row.requiredBy > data.requiredTo) return false;
      if (data.q) {
        const needle = data.q.toLowerCase();
        const haystack = [
          row.hospitalName,
          row.city,
          row.area ?? "",
          row.reference,
          row.additionalInfo ?? "",
          data.bloodGroup ?? row.bloodGroup ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });

    const items: RequestSearchItem[] = rows.map((row) => {
      const request = { ...row, status: effectiveStatus(row) };
      const match =
        donor.userId && (session?.role === "donor" || session?.role === "both")
          ? scoreRequestForDonor(database, request, donor)
          : null;
      return {
        ...toRequestView(request, database, viewer),
        match,
        isOwn: Boolean(session && row.requesterId === session.id),
      };
    });

    const filtered = items.filter((item) => {
      if (data.radiusKm && viewerPoint && item.distanceKm != null) {
        return item.distanceKm <= data.radiusKm;
      }
      return true;
    });

    const sort = data.sort ?? (donor.userId ? "match" : "recent");
    const sorted =
      sort === "match"
        ? sortByMatchScore(filtered)
        : sort === "urgency"
          ? [...filtered].sort((a, b) => {
              const rank = { emergency: 3, urgent: 2, normal: 1 } as Record<Urgency, number>;
              if (rank[a.urgency] !== rank[b.urgency]) return rank[b.urgency] - rank[a.urgency];
              return a.requiredBy.localeCompare(b.requiredBy);
            })
          : sort === "distance"
            ? [...filtered].sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999))
            : [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return {
      items: sorted.slice((page - 1) * perPage, page * perPage),
      total: sorted.length,
      page,
      perPage,
      viewer: {
        canMatch: Boolean(donor.userId && (session?.role === "donor" || session?.role === "both")),
        bloodGroup: donor.bloodGroup,
        hasLocation: Boolean(viewerPoint),
      },
    };
  });

export const fetchMatchedRequests = createServerFn({ method: "GET" })
  .validator(z.object({ limit: z.coerce.number().min(1).max(24).optional() }).optional())
  .handler(async ({ data }) => {
    const session = await requireUser();
    const database = await getDb();
    const donor = buildDonorContext(database, session.id);
    const viewer: ViewerContext = { userId: session.id, isAdmin: session.isAdmin, point: donor.point };

    const items = database.helpRequests
      .filter((row) => OPEN_STATUSES.has(effectiveStatus(row)) && row.requesterId !== session.id)
      .map((row) => {
        const request = { ...row, status: effectiveStatus(row) };
        const match = scoreRequestForDonor(database, request, donor);
        return { ...toRequestView(request, database, viewer), match, isOwn: row.requesterId === session.id };
      })
      .filter((item) => item.match.eligible);

    const ranked = sortByMatchScore(items).slice(0, data?.limit ?? 6);
    return { items: ranked, hasBloodGroup: Boolean(donor.bloodGroup) };
  });

export const fetchEmergencyRequests = createServerFn({ method: "GET" })
  .validator(z.object({ limit: z.coerce.number().min(1).max(24).optional() }).optional())
  .handler(async ({ data }): Promise<{ items: RequestSearchItem[]; total: number }> => {
    const database = await getDb();
    const session = await getSessionUser();
    const donor = buildDonorContext(database, session?.id ?? null);
    const viewer: ViewerContext = {
      userId: session?.id ?? null,
      isAdmin: Boolean(session?.isAdmin),
      point: donor.point,
    };

    const rows = database.helpRequests
      .filter((row) => row.urgency === "emergency" && OPEN_STATUSES.has(effectiveStatus(row)))
      .sort((a, b) => a.requiredBy.localeCompare(b.requiredBy));

    const items = rows.map((row) => {
      const request = { ...row, status: effectiveStatus(row) };
      const match =
        donor.userId && (session?.role === "donor" || session?.role === "both")
          ? scoreRequestForDonor(database, request, donor)
          : null;
      return {
        ...toRequestView(request, database, viewer),
        match,
        isOwn: Boolean(session && row.requesterId === session.id),
      };
    });

    return { items: items.slice(0, data?.limit ?? 6), total: items.length };
  });

export const fetchRequest = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string().trim().min(1) }))
  .handler(async ({ data }) => {
    const database = await getDb();
    const session = await getSessionUser();
    const row = database.helpRequests.find((item) => item.id === data.id);
    if (!row) throw notFound("This request is no longer available.");

    const status = effectiveStatus(row);
    if (status === "removed" && !session?.isAdmin && session?.id !== row.requesterId) {
      throw notFound("This request was removed by moderators.");
    }
    if (status === "draft" && !session?.isAdmin && session?.id !== row.requesterId) {
      throw notFound("This request is still a private draft.");
    }

    const donor = buildDonorContext(database, session?.id ?? null);
    const viewer: ViewerContext = {
      userId: session?.id ?? null,
      isAdmin: Boolean(session?.isAdmin),
      point: donor.point,
    };

    const request = { ...row, status };
    const isOwner = session?.id === row.requesterId;

    const responses = isOwner || session?.isAdmin
      ? database.donorResponses
          .filter((item) => item.requestId === row.id)
          .map((item) => toDonorResponseView(item, database, viewer))
          .filter((item): item is NonNullable<typeof item> => item !== null)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      : [];

    const match =
      donor.userId && !isOwner && (session?.role === "donor" || session?.role === "both")
        ? scoreRequestForDonor(database, request, donor)
        : null;

    return {
      request: toRequestView(request, database, viewer),
      responses,
      match,
      isOwner: Boolean(isOwner),
      isAdmin: Boolean(session?.isAdmin),
      canRespond: Boolean(
        session &&
          !isOwner &&
          (session.role === "donor" || session.role === "both") &&
          status === "open" &&
          session.accountStatus === "active",
      ),
    };
  });

export const createRequest = createServerFn({ method: "POST" })
  .validator(requestSchema)
  .handler(async ({ data }) =>
    action(async () => {
      const session = await requireActiveUser();
      enforceRateLimit(`request:create:${session.id}`, 6, 60 * 60_000);

      const timestamp = nowIso();
      const requestId = newId("req");
      const cityPoint = cityCoordinates(data.city);
      const point = cityPoint ? offsetPoint(cityPoint, requestId, 7) : null;

      const result = await mutate((db) => {
        sweepExpiredRequests(db);
        db.counters.requestReference += 1;
        const reference = `REQ-${db.counters.requestReference}`;

        const row = {
          id: requestId,
          reference,
          requesterId: session.id,
          requestType: data.requestType,
          bloodGroup: data.requestType === "medical_assistance" ? null : (data.bloodGroup ?? null),
          unitsRequired: data.unitsRequired,
          unitsFulfilled: 0,
          hospitalName: data.hospitalName,
          city: data.city,
          area: data.area ? data.area : null,
          approxLat: point ? roundCoord(point.lat) : null,
          approxLng: point ? roundCoord(point.lng) : null,
          requiredBy: data.requiredBy,
          urgency: data.urgency,
          status: "open" as const,
          additionalInfo: data.additionalInfo ? data.additionalInfo : null,
          contactName: data.contactName,
          contactPhone: data.contactPhone,
          contactInstructions: data.contactInstructions ? data.contactInstructions : null,
          isDemo: false,
          createdAt: timestamp,
          updatedAt: timestamp,
          resolvedAt: null,
          moderationNote: null,
          removedBy: null,
        };

        db.helpRequests.unshift(row);

        createNotification(db, {
          userId: session.id,
          type: "request_update",
          title: `Request ${reference} is live`,
          body:
            data.urgency === "emergency"
              ? "Your emergency request is published and highlighted to matching donors near you."
              : "Your request is published. We will notify matching donors nearby.",
          link: `/requests/${row.id}`,
        });

        const notified = notifyMatchingDonors(db, row);
        return { reference, notified };
      });

      return { id: requestId, reference: result.reference, notifiedDonors: result.notified };
    }),
  );

/**
 * Drafts let a coordinator start a request and finish it later. Only the author
 * (and moderators) can see a draft; publishing goes through
 * `updateRequestStatus({ status: "open" })`, which notifies matching donors.
 */
export const createRequestDraft = createServerFn({ method: "POST" })
  .validator(requestBaseSchema.partial())
  .handler(async ({ data }) =>
    action(async () => {
      const session = await requireActiveUser();
      const timestamp = nowIso();
      const requestId = newId("req");
      const city = data.city ?? session.profile.city ?? "";
      const cityPoint = city ? cityCoordinates(city) : null;
      const point = cityPoint ? offsetPoint(cityPoint, requestId, 7) : null;

      const reference = await mutate((db) => {
        sweepExpiredRequests(db);
        db.counters.requestReference += 1;
        const nextReference = `REQ-${db.counters.requestReference}`;

        db.helpRequests.unshift({
          id: requestId,
          reference: nextReference,
          requesterId: session.id,
          requestType: data.requestType ?? "blood",
          bloodGroup: data.requestType === "medical_assistance" ? null : (data.bloodGroup ?? null),
          unitsRequired: data.unitsRequired ?? 1,
          unitsFulfilled: 0,
          hospitalName: data.hospitalName ?? "",
          city,
          area: data.area ? data.area : null,
          approxLat: point ? roundCoord(point.lat) : null,
          approxLng: point ? roundCoord(point.lng) : null,
          requiredBy: data.requiredBy ?? new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          urgency: data.urgency ?? "normal",
          status: "draft",
          additionalInfo: data.additionalInfo ? data.additionalInfo : null,
          contactName: data.contactName ?? session.name,
          contactPhone: data.contactPhone ?? session.profile.phone ?? "",
          contactInstructions: data.contactInstructions ? data.contactInstructions : null,
          isDemo: false,
          createdAt: timestamp,
          updatedAt: timestamp,
          resolvedAt: null,
          moderationNote: null,
          removedBy: null,
        });

        return nextReference;
      });

      return { id: requestId, reference, draft: true as const };
    }),
  );

const updateRequestSchema = requestBaseSchema
  .partial()
  .extend({ id: z.string().trim().min(1) });

export const updateRequest = createServerFn({ method: "POST" })
  .validator(updateRequestSchema)
  .handler(async ({ data }) =>
    action(async () => {
      const session = await requireActiveUser();
      const timestamp = nowIso();

      await mutate((db) => {
        sweepExpiredRequests(db);
        const row = db.helpRequests.find((item) => item.id === data.id);
        if (!row) throw notFound("Request not found.");
        const isOwner = row.requesterId === session.id;
        if (!isOwner && !session.isAdmin) throw forbidden("You can only edit your own requests.");
        if (row.status === "removed") {
          throw forbidden("This request was removed by moderators and cannot be edited.");
        }

        const before = {
          urgency: row.urgency,
          bloodGroup: row.bloodGroup,
          unitsRequired: row.unitsRequired,
          requiredBy: row.requiredBy,
        };

        if (data.requestType) row.requestType = data.requestType;
        if (data.requestType === "medical_assistance") {
          row.bloodGroup = null;
        } else if (data.bloodGroup !== undefined) {
          row.bloodGroup = data.bloodGroup ?? null;
        }
        if (data.unitsRequired !== undefined) row.unitsRequired = data.unitsRequired;
        if (data.hospitalName) row.hospitalName = data.hospitalName;
        if (data.city) {
          row.city = data.city;
          const cityPoint = cityCoordinates(data.city);
          if (cityPoint) {
            const point = offsetPoint(cityPoint, row.id, 7);
            row.approxLat = roundCoord(point.lat);
            row.approxLng = roundCoord(point.lng);
          }
        }
        if (data.area !== undefined) row.area = data.area ? data.area : null;
        if (data.requiredBy) row.requiredBy = data.requiredBy;
        if (data.urgency) row.urgency = data.urgency;
        if (data.additionalInfo !== undefined) row.additionalInfo = data.additionalInfo || null;
        if (data.contactName) row.contactName = data.contactName;
        if (data.contactPhone) row.contactPhone = data.contactPhone;
        if (data.contactInstructions !== undefined)
          row.contactInstructions = data.contactInstructions || null;
        row.updatedAt = timestamp;

        const significantChange =
          before.urgency !== row.urgency ||
          before.bloodGroup !== row.bloodGroup ||
          before.unitsRequired !== row.unitsRequired ||
          before.requiredBy !== row.requiredBy;

        if (significantChange) {
          const responders = db.donorResponses.filter(
            (item) => item.requestId === row.id && item.status !== "withdrawn",
          );
          for (const responder of responders) {
            createNotification(db, {
              userId: responder.donorId,
              type: "request_update",
              title: `${row.reference} was updated`,
              body: `The requirement changed to ${row.unitsRequired} unit${
                row.unitsRequired === 1 ? "" : "s"
              } (${row.urgency}) at ${row.hospitalName}, ${row.city}.`,
              link: `/requests/${row.id}`,
            });
          }
        }
      });

      return { updatedAt: timestamp };
    }),
  );

const statusSchema = z.object({
  id: z.string().trim().min(1),
  status: z.enum(["open", "in_progress", "fulfilled", "cancelled"]),
  unitsFulfilled: z.coerce.number().min(0).max(50).optional(),
  note: z.string().trim().max(300).optional(),
});

export const updateRequestStatus = createServerFn({ method: "POST" })
  .validator(statusSchema)
  .handler(async ({ data }) =>
    action(async () => {
      const session = await requireActiveUser();
      const timestamp = nowIso();

      await mutate((db) => {
        sweepExpiredRequests(db);
        const row = db.helpRequests.find((item) => item.id === data.id);
        if (!row) throw notFound("Request not found.");
        const isOwner = row.requesterId === session.id;
        if (!isOwner && !session.isAdmin) throw forbidden("You can only update your own requests.");
        if (row.status === "removed") throw forbidden("This request was removed by moderators.");

        if (data.status === "fulfilled" && data.unitsFulfilled != null) {
          row.unitsFulfilled = Math.min(data.unitsFulfilled, row.unitsRequired);
        }
        if (data.status === "fulfilled" && row.unitsFulfilled === 0) {
          row.unitsFulfilled = row.unitsRequired;
        }

        if (data.status === "cancelled" && row.status === data.status) {
          throw invalid("This request is already cancelled.");
        }

        const previous = row.status;
        row.status = data.status;
        row.updatedAt = timestamp;
        row.resolvedAt = data.status === "fulfilled" || data.status === "cancelled" ? timestamp : null;
        if (data.note) row.moderationNote = data.note;

        const responders = db.donorResponses.filter(
          (item) => item.requestId === row.id && item.status !== "withdrawn",
        );

        if (data.status === "cancelled" && previous !== "cancelled") {
          for (const responder of responders) {
            createNotification(db, {
              userId: responder.donorId,
              type: "request_cancelled",
              title: `${row.reference} was cancelled`,
              body: "The requester cancelled this request, so no further action is needed.",
              link: `/requests/${row.id}`,
            });
          }
        }

        if (data.status === "fulfilled" && previous !== "fulfilled") {
          for (const responder of responders) {
            if (responder.status === "accepted") {
              responder.status = "completed";
              responder.updatedAt = timestamp;
            }
            createNotification(db, {
              userId: responder.donorId,
              type: "request_update",
              title: `${row.reference} is fulfilled`,
              body:
                responder.status === "completed"
                  ? "Thank you — this request is marked as fulfilled. Your donation helped."
                  : "This request is marked as fulfilled, so no further action is needed. Thank you.",
              link: `/requests/${row.id}`,
            });
          }
        }

        // Publishing a draft reaches out to matching donors for the first time.
        if (data.status === "open" && previous === "draft") {
          createNotification(db, {
            userId: session.id,
            type: "request_update",
            title: `Request ${row.reference} is live`,
            body:
              row.urgency === "emergency"
                ? "Your emergency request is published and highlighted to matching donors near you."
                : "Your draft is published. We will notify matching donors nearby.",
            link: `/requests/${row.id}`,
          });
          notifyMatchingDonors(db, row);
        }

        if (data.status === "open" && previous !== "open" && previous !== "draft") {
          for (const responder of responders) {
            createNotification(db, {
              userId: responder.donorId,
              type: "request_update",
              title: `${row.reference} is open again`,
              body: "The requester reopened this request. Your earlier offer is still on record.",
              link: `/requests/${row.id}`,
            });
          }
        }
      });

      return { status: data.status };
    }),
  );

export const fetchMyRequests = createServerFn({ method: "GET" }).handler(async () => {
  const session = await requireUser();
  const database = await getDb();
  const donor = buildDonorContext(database, session.id);
  const viewer: ViewerContext = { userId: session.id, isAdmin: session.isAdmin, point: donor.point };

  const rows = database.helpRequests
    .filter((row) => row.requesterId === session.id)
    .map((row) => {
      const request = { ...row, status: effectiveStatus(row) };
      const responses = database.donorResponses.filter(
        (item) => item.requestId === row.id && item.status !== "withdrawn",
      );
      return {
        ...toRequestView(request, database, viewer),
        pendingResponses: responses.filter((item) => item.status === "pending").length,
        acceptedResponses: responses.filter(
          (item) => item.status === "accepted" || item.status === "completed",
        ).length,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    drafts: rows.filter((row) => row.status === "draft"),
    active: rows.filter((row) => row.status === "open" || row.status === "in_progress"),
    past: rows.filter((row) => row.status !== "open" && row.status !== "in_progress" && row.status !== "draft"),
    total: rows.length,
  };
});

export type DashboardPayload = {
  role: UserRole;
  isDonor: boolean;
  isRecipient: boolean;
  name: string;
  city: string | null;
  profileCompletion: number;
  verificationStatus: VerificationStatus;
  stats: {
    activeRequests: number;
    totalRequests: number;
    donationsOffered: number;
    donationsCompleted: number;
    matchedRequests: number;
    emergencyNearby: number;
    unreadNotifications: number;
    pendingOffers: number;
  };
  matchedRequests: RequestSearchItem[];
  activeRequests: (RequestView & { pendingResponses: number; acceptedResponses: number })[];
  recentActivity: {
    id: string;
    title: string;
    description: string;
    at: string;
    kind: "request" | "offer" | "notification";
    link: string;
  }[];
  notifications: {
    id: string;
    title: string;
    body: string;
    link: string | null;
    read: boolean;
    createdAt: string;
  }[];
  hasBloodGroup: boolean;
  hasLocation: boolean;
};

const DAY = 86400000;

export const fetchDashboard = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardPayload> => {
    const session = await requireUser();
    const database = await getDb();
    const donor = buildDonorContext(database, session.id);
    const viewer: ViewerContext = { userId: session.id, isAdmin: session.isAdmin, point: donor.point };
    const isDonor = session.role === "donor" || session.role === "both";
    const isRecipient = session.role === "recipient" || session.role === "both";

    const openRequests = database.helpRequests.filter((row) =>
      ["open", "in_progress"].includes(effectiveStatus(row)),
    );

    const matched = isDonor
      ? sortByMatchScore(
          openRequests.map((row) => {
            const request = { ...row, status: effectiveStatus(row) };
            const match = scoreRequestForDonor(database, request, donor);
            return {
              ...toRequestView(request, database, viewer),
              match,
              isOwn: row.requesterId === session.id,
            };
          }),
        )
          .filter((item) => item.match.eligible)
          .slice(0, 4)
      : [];

    const myRequests = database.helpRequests
      .filter((row) => row.requesterId === session.id)
      .map((row) => {
        const request = { ...row, status: effectiveStatus(row) };
        const responses = database.donorResponses.filter(
          (item) => item.requestId === row.id && item.status !== "withdrawn",
        );
        return {
          ...toRequestView(request, database, viewer),
          pendingResponses: responses.filter((item) => item.status === "pending").length,
          acceptedResponses: responses.filter(
            (item) => item.status === "accepted" || item.status === "completed",
          ).length,
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const activeRequests = myRequests.filter(
      (row) => row.status === "open" || row.status === "in_progress",
    );

    const myOffers = database.donorResponses.filter((row) => row.donorId === session.id);
    const notifications = database.notifications
      .filter((row) => row.userId === session.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const activity: DashboardPayload["recentActivity"] = [
      ...myRequests.slice(0, 4).map((row) => ({
        id: `req-${row.id}`,
        title: `You published ${row.reference}`,
        description: `${row.hospitalName}, ${row.city} · ${row.unitsRequired} unit${
          row.unitsRequired === 1 ? "" : "s"
        } · ${row.urgency}`,
        at: row.createdAt,
        kind: "request" as const,
        link: `/requests/${row.id}`,
      })),
      ...database.donorResponses
        .filter((row) => row.donorId === session.id)
        .slice(0, 4)
        .map((row) => {
          const request = database.helpRequests.find((item) => item.id === row.requestId);
          return {
            id: `res-${row.id}`,
            title: `You offered to help with ${request?.reference ?? "a request"}`,
            description: request
              ? `${request.hospitalName}, ${request.city} · ${row.status}`
              : "Request removed",
            at: row.createdAt,
            kind: "offer" as const,
            link: `/requests/${row.requestId}`,
          };
        }),
      ...notifications.slice(0, 5).map((row) => ({
        id: `not-${row.id}`,
        title: row.title,
        description: row.body,
        at: row.createdAt,
        kind: "notification" as const,
        link: row.link ?? "/notifications",
      })),
    ]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 7);

    const emergencyNearby = matched.filter((item) => item.urgency === "emergency").length;

    return {
      role: session.role,
      isDonor,
      isRecipient,
      name: session.name,
      city: session.profile.city,
      profileCompletion: session.profileCompletion,
      verificationStatus: session.verificationStatus,
      stats: {
        activeRequests: activeRequests.length,
        totalRequests: myRequests.length,
        donationsOffered: myOffers.length,
        donationsCompleted: myOffers.filter((row) => row.status === "completed").length,
        matchedRequests: matched.length,
        emergencyNearby,
        unreadNotifications: session.unreadNotifications,
        pendingOffers: myOffers.filter((row) => row.status === "pending").length,
      },
      matchedRequests: matched,
      activeRequests,
      recentActivity: activity,
      notifications: notifications.slice(0, 5).map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        link: row.link,
        read: Boolean(row.readAt),
        createdAt: row.createdAt,
      })),
      hasBloodGroup: Boolean(donor.bloodGroup),
      hasLocation: Boolean(donor.point),
    };
  },
);

export const fetchRequestFiltersMeta = createServerFn({ method: "GET" }).handler(async () => {
  const database = await getDb();
  const cities = Array.from(new Set(database.helpRequests.map((row) => row.city))).sort();
  const areas = Array.from(
    new Set(database.helpRequests.map((row) => row.area).filter((value): value is string => Boolean(value))),
  ).sort();
  return {
    cities,
    areas,
    bloodGroups: BLOOD_GROUPS,
    recentWindowDays: Math.round(30 / DAY) * 30,
  };
});

export type PublicStats = {
  openRequests: number;
  emergencyRequests: number;
  donors: number;
  cities: number;
  unitsCoordinated: number;
  verifiedMembers: number;
};

/** Anonymous-safe counters used on the landing page and marketing sections. */
export const fetchPublicStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicStats> => {
    const database = await getDb();
    const open = database.helpRequests.filter((row) =>
      ["open", "in_progress"].includes(effectiveStatus(row)),
    );

    return {
      openRequests: open.length,
      emergencyRequests: open.filter((row) => row.urgency === "emergency").length,
      donors: database.users.filter(
        (row) =>
          (row.role === "donor" || row.role === "both") &&
          row.accountStatus === "active" &&
          database.donorProfiles.some((profile) => profile.userId === row.id),
      ).length,
      cities: new Set(database.helpRequests.map((row) => row.city)).size,
      unitsCoordinated: database.helpRequests.reduce((total, row) => total + row.unitsFulfilled, 0),
      verifiedMembers: database.verifications.filter((row) => row.status === "verified").length,
    };
  },
);
