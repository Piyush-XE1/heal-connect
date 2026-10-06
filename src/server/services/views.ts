import type {
  DonorProfileView,
  DonorResponseView,
  NotificationView,
  ProfileView,
  PublicUser,
  ReportView,
  RequestContact,
  RequestView,
  ResponseStatus,
  SessionUser,
  VerificationView,
  VolunteerSummary,
} from "@/lib/domain";
import { distanceKm, type Coordinates } from "@/lib/geo";
import { relativeTime } from "@/lib/format";

import type {
  Database,
  DonorResponseRow,
  HelpRequestRow,
  NotificationRow,
  ProfileRow,
  ReportRow,
  UserRow,
  VerificationRow,
} from "../db/types";

export type ViewerContext = {
  userId: string | null;
  isAdmin: boolean;
  point: Coordinates | null;
};

export function toPublicUser(user: UserRow, db: Database): PublicUser {
  const profile = db.profiles.find((row) => row.userId === user.id);
  const verification = db.verifications
    .filter((row) => row.userId === user.id)
    .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1))[0];
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    role: user.role,
    isAdmin: user.isAdmin,
    isDemo: user.isDemo,
    accountStatus: user.accountStatus,
    verificationStatus: verification?.status ?? "unverified",
    organizationType: verification?.organizationType ?? null,
    organizationName: verification?.organizationName ?? null,
    onboardingComplete: user.onboardingComplete,
    city: profile?.city ?? null,
    createdAt: user.createdAt,
  };
}

export function toProfileView(profile: ProfileRow): ProfileView {
  return {
    userId: profile.userId,
    phone: profile.phone,
    city: profile.city,
    area: profile.area,
    approxLat: profile.approxLat,
    approxLng: profile.approxLng,
    bio: profile.bio,
    age: profile.age,
    sharePhoneWithMatches: profile.sharePhoneWithMatches,
    updatedAt: profile.updatedAt,
  };
}

export function toDonorProfileView(
  profile: NonNullable<Database["donorProfiles"][number]>,
): DonorProfileView {
  return {
    userId: profile.userId,
    bloodGroup: profile.bloodGroup,
    lastDonationDate: profile.lastDonationDate,
    availability: profile.availability,
    preferences: profile.preferences,
    maxTravelKm: profile.maxTravelKm,
    isVisibleToRecipients: profile.isVisibleToRecipients,
    notes: profile.notes,
    updatedAt: profile.updatedAt,
  };
}

/** Completion meter used by the dashboard and onboarding nudges. */
export function computeProfileCompletion(
  user: UserRow,
  profile: ProfileRow | undefined,
  donorProfile: Database["donorProfiles"][number] | undefined,
): number {
  const checks: boolean[] = [
    Boolean(user.name && user.name.trim().length > 1),
    Boolean(profile?.city),
    Boolean(profile?.area),
    Boolean(profile?.phone),
    Boolean(profile?.age),
    Boolean(user.avatarUrl),
    user.onboardingComplete,
  ];

  const wantsDonor = user.role === "donor" || user.role === "both";
  if (wantsDonor) {
    checks.push(Boolean(donorProfile?.bloodGroup));
    checks.push(Boolean(donorProfile?.availability));
    checks.push(Boolean(donorProfile?.preferences?.length));
    checks.push(Boolean(profile?.sharePhoneWithMatches !== undefined));
  }

  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
}

export function buildSessionUser(db: Database, userId: string): SessionUser | null {
  const user = db.users.find((row) => row.id === userId);
  if (!user) return null;
  const profile = db.profiles.find((row) => row.userId === userId);
  const donorProfile = db.donorProfiles.find((row) => row.userId === userId);
  const unreadNotifications = db.notifications.filter(
    (row) => row.userId === userId && !row.readAt,
  ).length;

  const fallbackProfile: ProfileRow = {
    userId,
    phone: null,
    city: null,
    area: null,
    approxLat: null,
    approxLng: null,
    bio: null,
    age: null,
    sharePhoneWithMatches: false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  return {
    ...toPublicUser(user, db),
    profile: toProfileView(profile ?? fallbackProfile),
    donorProfile: donorProfile ? toDonorProfileView(donorProfile) : null,
    unreadNotifications,
    profileCompletion: computeProfileCompletion(user, profile, donorProfile),
  };
}

/**
 * Contact details are only attached when the viewer is legitimately able to
 * coordinate the request: the requester, an admin, or a donor whose offer the
 * requester accepted. Everyone else sees the request without personal data.
 */
export function resolveContactAccess(
  request: HelpRequestRow,
  viewer: ViewerContext,
  responses: DonorResponseRow[],
): RequestContact | null {
  if (!viewer.userId) return null;

  if (viewer.userId === request.requesterId) {
    return {
      name: request.contactName,
      phone: request.contactPhone,
      instructions: request.contactInstructions,
      unlockedBy: "owner",
    };
  }

  if (viewer.isAdmin) {
    return {
      name: request.contactName,
      phone: request.contactPhone,
      instructions: request.contactInstructions,
      unlockedBy: "admin",
    };
  }

  const accepted = responses.find(
    (row) =>
      row.requestId === request.id &&
      row.donorId === viewer.userId &&
      (row.status === "accepted" || row.status === "completed"),
  );

  if (accepted) {
    return {
      name: request.contactName,
      phone: request.contactPhone,
      instructions: request.contactInstructions,
      unlockedBy: "accepted_response",
    };
  }

  return null;
}

export function myResponseStatusFor(
  responses: DonorResponseRow[],
  requestId: string,
  userId: string | null,
): ResponseStatus | null {
  if (!userId) return null;
  const mine = responses.find((row) => row.requestId === requestId && row.donorId === userId);
  return mine?.status ?? null;
}

export function toRequestView(
  request: HelpRequestRow,
  db: Database,
  viewer: ViewerContext,
): RequestView {
  const requester = db.users.find((row) => row.id === request.requesterId);
  const responses = db.donorResponses.filter((row) => row.requestId === request.id);
  const requesterVerification = db.verifications
    .filter((row) => row.userId === request.requesterId)
    .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1))[0];

  const requestPoint =
    request.approxLat != null && request.approxLng != null
      ? { lat: request.approxLat, lng: request.approxLng }
      : null;

  return {
    id: request.id,
    reference: request.reference,
    requesterId: request.requesterId,
    requesterName: requester?.name ?? "Community member",
    requesterVerified: requesterVerification?.status === "verified",
    requesterIsDemo: Boolean(requester?.isDemo),
    city: request.city,
    area: request.area,
    approxLat: request.approxLat,
    approxLng: request.approxLng,
    distanceKm:
      requestPoint && viewer.point
        ? Math.round(distanceKm(viewer.point, requestPoint) * 10) / 10
        : null,
    requestType: request.requestType,
    bloodGroup: request.bloodGroup,
    unitsRequired: request.unitsRequired,
    unitsFulfilled: request.unitsFulfilled,
    hospitalName: request.hospitalName,
    requiredBy: request.requiredBy,
    urgency: request.urgency,
    status: request.status,
    additionalInfo: request.additionalInfo,
    contact: resolveContactAccess(request, viewer, responses),
    responseCount: responses.filter((row) => row.status !== "withdrawn").length,
    myResponseStatus: myResponseStatusFor(responses, request.id, viewer.userId),
    isDemo: request.isDemo,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    resolvedAt: request.resolvedAt,
  };
}

/** Donor-facing view of an offer, with the donor's own contact hidden by default. */
export function toDonorResponseView(
  response: DonorResponseRow,
  db: Database,
  viewer: ViewerContext,
): DonorResponseView | null {
  const request = db.helpRequests.find((row) => row.id === response.requestId);
  const donor = db.users.find((row) => row.id === response.donorId);
  if (!request || !donor) return null;

  const donorProfile = db.donorProfiles.find((row) => row.userId === donor.id);
  const donorContactProfile = db.profiles.find((row) => row.userId === donor.id);
  const donorVerification = db.verifications
    .filter((row) => row.userId === donor.id)
    .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1))[0];

  const requestPoint =
    request.approxLat != null && request.approxLng != null
      ? { lat: request.approxLat, lng: request.approxLng }
      : null;

  const isRequester = viewer.userId === request.requesterId;
  const isOwner = viewer.userId === donor.id;
  const canSeeDonorContact =
    viewer.isAdmin ||
    isOwner ||
    (isRequester && (response.status === "accepted" || response.status === "completed"));

  const contact: RequestContact | null =
    canSeeDonorContact && donorContactProfile
      ? {
          name: donor.name,
          phone:
            donorContactProfile.sharePhoneWithMatches || viewer.isAdmin || isOwner
              ? (donorContactProfile.phone ?? "")
              : "",
          instructions: null,
          unlockedBy: viewer.isAdmin ? "admin" : isRequester ? "accepted_response" : "owner",
        }
      : null;

  return {
    id: response.id,
    requestId: request.id,
    requestReference: request.reference,
    requestUrgency: request.urgency,
    requestType: request.requestType,
    requestStatus: request.status,
    requestCity: request.city,
    requestHospitalName: request.hospitalName,
    requestBloodGroup: request.bloodGroup,
    status: response.status,
    message: response.message,
    donorId: donor.id,
    donorName: donor.name,
    donorVerified: donorVerification?.status === "verified",
    donorBloodGroup: donorProfile?.bloodGroup ?? null,
    donorCity: donorProfile
      ? (db.profiles.find((row) => row.userId === donor.id)?.city ?? null)
      : null,
    donorDistanceKm:
      isRequester && viewer.point && requestPoint
        ? Math.round(distanceKm(viewer.point, requestPoint) * 10) / 10
        : null,
    contact,
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
  };
}

export function toNotificationView(row: NotificationRow): NotificationView {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    read: Boolean(row.readAt),
    createdAt: row.createdAt,
  };
}

export function toReportView(row: ReportRow, db: Database): ReportView {
  const reporter = db.users.find((user) => user.id === row.reporterId);
  let targetLabel = "Unknown record";
  if (row.targetType === "user") {
    const target = db.users.find((user) => user.id === row.targetId);
    targetLabel = target ? `User · ${target.name}` : "Deleted user";
  } else {
    const target = db.helpRequests.find((request) => request.id === row.targetId);
    targetLabel = target
      ? `${target.reference} · ${target.hospitalName}, ${target.city}`
      : "Deleted request";
  }

  return {
    id: row.id,
    targetType: row.targetType,
    targetId: row.targetId,
    targetLabel,
    reason: row.reason,
    details: row.details,
    status: row.status,
    reporterId: row.reporterId,
    reporterName: reporter?.name ?? "Community member",
    resolutionNote: row.resolutionNote,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toVerificationView(row: VerificationRow, db: Database): VerificationView {
  const user = db.users.find((item) => item.id === row.userId);
  return {
    id: row.id,
    userId: row.userId,
    userName: user?.name ?? "Deleted user",
    userEmail: user?.email ?? "—",
    organizationType: row.organizationType,
    organizationName: row.organizationName,
    evidenceNote: row.evidenceNote,
    status: row.status,
    reviewNote: row.reviewNote,
    submittedAt: row.submittedAt,
    reviewedAt: row.reviewedAt,
    isDemo: row.isDemo,
  };
}

/**
 * Volunteer directory entry — deliberately sparse. No phone number, no street
 * address, no email, no medical notes: only what a coordinator needs to decide
 * whether to reach out through the platform.
 */
export function toVolunteerSummary(
  user: UserRow,
  db: Database,
  viewerPoint: Coordinates | null,
): VolunteerSummary {
  const profile = db.profiles.find((row) => row.userId === user.id);
  const donorProfile = db.donorProfiles.find((row) => row.userId === user.id);
  const verification = db.verifications
    .filter((row) => row.userId === user.id)
    .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1))[0];

  const point =
    profile?.approxLat != null && profile?.approxLng != null
      ? { lat: profile.approxLat, lng: profile.approxLng }
      : null;

  return {
    id: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl,
    bloodGroup: donorProfile?.bloodGroup ?? null,
    city: profile?.city ?? null,
    area: profile?.area ?? null,
    availability: donorProfile?.availability ?? null,
    verificationStatus: verification?.status ?? "unverified",
    isDemo: user.isDemo,
    distanceKm: viewerPoint && point ? Math.round(distanceKm(viewerPoint, point) * 10) / 10 : null,
    lastDonationDate: donorProfile?.lastDonationDate ?? null,
  };
}

export function activityLabel(row: NotificationRow): string {
  return `${row.title} · ${relativeTime(row.createdAt)}`;
}
