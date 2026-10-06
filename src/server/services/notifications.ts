import { canDonateTo, MATCHING_WEIGHTS } from "@/lib/blood";
import type { Availability, BloodGroup, DonationPreference, NotificationType } from "@/lib/domain";
import { distanceKm, type Coordinates } from "@/lib/geo";
import { scoreMatch, type MatchResult } from "@/lib/matching";

import type { Database, HelpRequestRow, UserRow } from "../db/types";
import { newId, nowIso } from "../db/store";

export function createNotification(
  database: Database,
  input: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    link?: string | null;
  },
): void {
  // Never notify a user who is opted out by suspension.
  const user = database.users.find((row) => row.id === input.userId);
  if (!user) return;

  database.notifications.unshift({
    id: newId("not"),
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    link: input.link ?? null,
    readAt: null,
    createdAt: nowIso(),
  });

  // Keep the notification list bounded for the JSON store.
  const forUser = database.notifications.filter((row) => row.userId === input.userId);
  if (forUser.length > 200) {
    const overflow = new Set(forUser.slice(200).map((row) => row.id));
    database.notifications = database.notifications.filter((row) => !overflow.has(row.id));
  }
}

export function markAllNotificationsRead(database: Database, userId: string): number {
  const timestamp = nowIso();
  let changed = 0;
  for (const row of database.notifications) {
    if (row.userId === userId && !row.readAt) {
      row.readAt = timestamp;
      changed += 1;
    }
  }
  return changed;
}

const FAN_OUT_LIMIT = 10;

/**
 * Notifies donors who are plausibly relevant to a brand-new request:
 * same blood-group compatibility, reasonable distance and an active account.
 * Deliberately capped so a new request can never spam the whole network.
 */
export function notifyMatchingDonors(database: Database, request: HelpRequestRow): number {
  const requestPoint =
    request.approxLat != null && request.approxLng != null
      ? { lat: request.approxLat, lng: request.approxLng }
      : null;

  const candidates: { user: UserRow; distance: number | null }[] = [];

  for (const user of database.users) {
    if (user.id === request.requesterId) continue;
    if (user.accountStatus !== "active") continue;
    if (user.role === "recipient") continue;
    const donorProfile = database.donorProfiles.find((row) => row.userId === user.id);
    if (!donorProfile || !donorProfile.isVisibleToRecipients) continue;

    if (request.requestType !== "medical_assistance" && request.bloodGroup) {
      if (!canDonateTo(donorProfile.bloodGroup, request.bloodGroup)) continue;
    }

    const profile = database.profiles.find((row) => row.userId === user.id);
    const donorPoint =
      profile?.approxLat != null && profile?.approxLng != null
        ? { lat: profile.approxLat, lng: profile.approxLng }
        : null;

    const distance =
      requestPoint && donorPoint ? Math.round(distanceKm(requestPoint, donorPoint)) : null;

    if (distance != null && distance > Math.max(60, donorProfile.maxTravelKm)) continue;

    candidates.push({ user, distance });
  }

  candidates.sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));

  const notified = candidates.slice(0, FAN_OUT_LIMIT);
  notified.forEach(({ user, distance }) => {
    createNotification(database, {
      userId: user.id,
      type: "matching_request",
      title:
        request.urgency === "emergency"
          ? `Emergency ${request.bloodGroup ?? "medical"} need in ${request.city}`
          : `New ${request.requestType === "blood" ? "blood" : request.requestType} request near you`,
      body: `${request.hospitalName}, ${request.city} · ${request.unitsRequired} unit${
        request.unitsRequired === 1 ? "" : "s"
      }${distance != null ? ` · about ${distance} km away` : ""}`,
      link: `/requests/${request.id}`,
    });
  });

  return notified.length;
}

/* ------------------------------------------------------------------ */
/* Match context helpers                                              */
/* ------------------------------------------------------------------ */

export type DonorContext = {
  userId: string | null;
  bloodGroup: BloodGroup | null;
  point: Coordinates | null;
  city: string | null;
  availability: Availability | null;
  lastDonationDate: string | null;
  maxTravelKm: number;
  preferences: DonationPreference[];
  blockedUserIds: string[];
  respondedRequestIds: Set<string>;
};

export function buildDonorContext(database: Database, userId: string | null): DonorContext {
  if (!userId) {
    return {
      userId: null,
      bloodGroup: null,
      point: null,
      city: null,
      availability: null,
      lastDonationDate: null,
      maxTravelKm: 25,
      preferences: [],
      blockedUserIds: [],
      respondedRequestIds: new Set(),
    };
  }

  const profile = database.profiles.find((row) => row.userId === userId);
  const donorProfile = database.donorProfiles.find((row) => row.userId === userId);
  const blockedUserIds = database.blocks
    .filter((row) => row.userId === userId || row.blockedUserId === userId)
    .map((row) => (row.userId === userId ? row.blockedUserId : row.userId));

  return {
    userId,
    bloodGroup: donorProfile?.bloodGroup ?? null,
    point:
      profile?.approxLat != null && profile?.approxLng != null
        ? { lat: profile.approxLat, lng: profile.approxLng }
        : null,
    city: profile?.city ?? null,
    availability: donorProfile?.availability ?? null,
    lastDonationDate: donorProfile?.lastDonationDate ?? null,
    maxTravelKm: donorProfile?.maxTravelKm ?? 25,
    preferences: donorProfile?.preferences ?? [],
    blockedUserIds,
    respondedRequestIds: new Set(
      database.donorResponses.filter((row) => row.donorId === userId).map((row) => row.requestId),
    ),
  };
}

export function scoreRequestForDonor(
  database: Database,
  request: HelpRequestRow,
  donor: DonorContext,
): MatchResult {
  return scoreMatch(
    {
      id: request.id,
      requesterId: request.requesterId,
      requestType: request.requestType,
      bloodGroup: request.bloodGroup,
      urgency: request.urgency,
      status: request.status,
      point:
        request.approxLat != null && request.approxLng != null
          ? { lat: request.approxLat, lng: request.approxLng }
          : null,
      requiredBy: request.requiredBy,
      hasResponded: donor.respondedRequestIds.has(request.id),
    },
    {
      userId: donor.userId ?? "anonymous",
      bloodGroup: donor.bloodGroup,
      point: donor.point,
      city: donor.city,
      availability: donor.availability,
      lastDonationDate: donor.lastDonationDate,
      maxTravelKm: donor.maxTravelKm,
      preferences: donor.preferences,
    },
    {
      blockedUserIds: donor.blockedUserIds,
      ...(donor.userId ? { viewerId: donor.userId } : {}),
      preferenceAware: true,
    },
  );
}

export const MATCH_WEIGHT_SUMMARY = MATCHING_WEIGHTS;
