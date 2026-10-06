import { canDonateTo, MATCHING_WEIGHTS } from "./blood";
import type {
  Availability,
  BloodGroup,
  DonationPreference,
  RequestStatus,
  RequestType,
  Urgency,
} from "./domain";
import { distanceKm, type Coordinates } from "./geo";
import { URGENCY_RANK } from "./labels";

export type MatchDonorContext = {
  userId: string;
  bloodGroup: BloodGroup | null;
  point: Coordinates | null;
  city: string | null;
  availability: Availability | null;
  lastDonationDate: string | null;
  maxTravelKm: number;
  preferences: DonationPreference[];
};

export type MatchRequestContext = {
  id: string;
  requesterId: string;
  requestType: RequestType;
  bloodGroup: BloodGroup | null;
  urgency: Urgency;
  status: RequestStatus;
  point: Coordinates | null;
  requiredBy: string;
  hasResponded: boolean;
};

export type MatchBreakdownEntry = {
  label: string;
  points: number;
  max: number;
  detail: string;
};

export type MatchResult = {
  eligible: boolean;
  score: number;
  distanceKm: number | null;
  breakdown: MatchBreakdownEntry[];
  blockers: string[];
  cautions: string[];
};

export type MatchOptions = {
  blockedUserIds?: string[];
  /** Requests created by the viewer are never shown as matches. */
  viewerId?: string;
  preferenceAware?: boolean;
};

/** Roughly the interval blood banks use for whole-blood donation; informational only. */
export const SUGGESTED_WHOLE_BLOOD_INTERVAL_DAYS = 90;

function daysSince(value: string | null): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

function bloodGroupScore(requestGroup: BloodGroup | null, donorGroup: BloodGroup | null) {
  if (!requestGroup) {
    return { points: Math.round(MATCHING_WEIGHTS.bloodGroup * 0.7), detail: "Group not specified" };
  }
  if (!donorGroup) {
    return { points: 0, detail: "Add your blood group to see compatibility" };
  }
  if (donorGroup === requestGroup) {
    return { points: MATCHING_WEIGHTS.bloodGroup, detail: `Same group (${donorGroup})` };
  }
  if (canDonateTo(donorGroup, requestGroup)) {
    return {
      points: Math.round(MATCHING_WEIGHTS.bloodGroup * 0.78),
      detail: `${donorGroup} can often help ${requestGroup} (confirm at blood bank)`,
    };
  }
  return { points: 0, detail: `${donorGroup} is not a routine red-cell match for ${requestGroup}` };
}

function distanceScore(distance: number | null) {
  if (distance == null) {
    return { points: Math.round(MATCHING_WEIGHTS.distance * 0.5), detail: "Distance unknown" };
  }
  if (distance <= 5) return { points: MATCHING_WEIGHTS.distance, detail: "Within 5 km" };
  if (distance <= 15) return { points: 20, detail: "Within 15 km" };
  if (distance <= 40) return { points: 14, detail: "Within 40 km" };
  if (distance <= 100) return { points: 8, detail: "Within 100 km" };
  return { points: 3, detail: "More than 100 km away" };
}

function availabilityScore(availability: Availability | null) {
  if (availability === "available") {
    return { points: MATCHING_WEIGHTS.availability, detail: "You are marked available" };
  }
  if (availability === "on_hold") {
    return { points: 12, detail: "You are available with notice" };
  }
  if (availability === "unavailable") {
    return { points: 3, detail: "You are marked unavailable" };
  }
  return { points: 10, detail: "Availability not set" };
}

function urgencyScore(urgency: Urgency) {
  const rank = URGENCY_RANK[urgency];
  const points = Math.round((rank / 3) * MATCHING_WEIGHTS.urgency);
  const detail =
    urgency === "emergency"
      ? "Emergency need"
      : urgency === "urgent"
        ? "Urgent need"
        : "Planned need";
  return { points, detail };
}

/**
 * Ranks a request for a donor. Pure function — used by the server to order
 * matches and by the interface to explain *why* a request is shown.
 *
 * The result never certifies eligibility: `eligible === false` only means
 * "not a sensible match for the coordination flow", and every caution asks the
 * donor to confirm with the blood bank.
 */
export function scoreMatch(
  request: MatchRequestContext,
  donor: MatchDonorContext,
  options: MatchOptions = {},
): MatchResult {
  const blockers: string[] = [];
  const cautions: string[] = [];

  const resolvedDistance =
    request.point && donor.point ? distanceKm(request.point, donor.point) : null;

  if (options.viewerId && request.requesterId === options.viewerId) {
    blockers.push("This request was created by you.");
  }

  if (request.status !== "open" && request.status !== "in_progress") {
    blockers.push("This request is no longer open.");
  }

  if (request.hasResponded) {
    blockers.push("You have already offered to help with this request.");
  }

  const blockedUsers = options.blockedUserIds ?? [];
  if (blockedUsers.includes(request.requesterId)) {
    blockers.push("This request is hidden because of a block you or the requester set.");
  }

  const group = bloodGroupScore(request.bloodGroup, donor.bloodGroup);
  if (request.requestType !== "medical_assistance" && request.bloodGroup && donor.bloodGroup) {
    if (group.points === 0) {
      blockers.push(
        `${donor.bloodGroup} is not a routine red-cell donor group for ${request.bloodGroup}. The blood bank decides the final match.`,
      );
    }
  }

  const recentDays = daysSince(donor.lastDonationDate);
  if (recentDays != null && recentDays < SUGGESTED_WHOLE_BLOOD_INTERVAL_DAYS) {
    cautions.push(
      `Your last donation was ${recentDays} day${recentDays === 1 ? "" : "s"} ago. Blood banks usually require an interval between donations — please confirm with the blood bank before planning.`,
    );
  }

  if (donor.availability === "unavailable") {
    cautions.push(
      "You are currently marked as not available. Update availability if that changed.",
    );
  }

  if (
    options.preferenceAware &&
    donor.preferences.length > 0 &&
    request.requestType === "platelets" &&
    !donor.preferences.includes("platelets")
  ) {
    cautions.push("Your donation preferences do not include platelets.");
  }

  if (
    options.preferenceAware &&
    donor.preferences.length > 0 &&
    request.requestType === "blood" &&
    !donor.preferences.includes("whole_blood")
  ) {
    cautions.push("Your donation preferences do not include whole blood.");
  }

  if (resolvedDistance != null && resolvedDistance > donor.maxTravelKm) {
    cautions.push(
      `This is about ${Math.round(resolvedDistance)} km away, beyond your ${donor.maxTravelKm} km travel preference.`,
    );
  }

  const breakdown: MatchBreakdownEntry[] = [
    { label: "Blood group", ...group, max: MATCHING_WEIGHTS.bloodGroup },
    { label: "Distance", ...distanceScore(resolvedDistance), max: MATCHING_WEIGHTS.distance },
    {
      label: "Availability",
      ...availabilityScore(donor.availability),
      max: MATCHING_WEIGHTS.availability,
    },
    { label: "Urgency", ...urgencyScore(request.urgency), max: MATCHING_WEIGHTS.urgency },
  ];

  const score = breakdown.reduce((total, entry) => total + entry.points, 0);
  const eligible = blockers.length === 0;

  return {
    eligible,
    score: eligible ? score : 0,
    distanceKm: resolvedDistance,
    breakdown,
    blockers,
    cautions,
  };
}

export function sortByMatchScore<T extends { match: MatchResult | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    // Items without a match score (anonymous viewers, own requests) sort last.
    if (!a.match || !b.match) {
      if (a.match && !b.match) return -1;
      if (!a.match && b.match) return 1;
      return 0;
    }
    if (a.match.eligible !== b.match.eligible) return a.match.eligible ? -1 : 1;
    return b.match.score - a.match.score;
  });
}
