/**
 * Shared domain model for Heal Connect.
 *
 * These types are used by both the browser and the server, and mirror the
 * database rows defined in `src/server/db/types.ts`. Anything that is exposed
 * to the client must be shaped by the API layer — never by dumping raw rows —
 * so sensitive fields (private phone numbers, exact addresses, session data)
 * can be redacted per-viewer.
 */

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export const USER_ROLES = ["donor", "recipient", "both"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const REQUEST_TYPES = ["blood", "platelets", "medical_assistance"] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const URGENCIES = ["normal", "urgent", "emergency"] as const;
export type Urgency = (typeof URGENCIES)[number];

export const REQUEST_STATUSES = [
  "draft",
  "open",
  "in_progress",
  "fulfilled",
  "cancelled",
  "expired",
  "removed",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const AVAILABILITY_STATES = ["available", "unavailable", "on_hold"] as const;
export type Availability = (typeof AVAILABILITY_STATES)[number];

export const VERIFICATION_STATUSES = ["unverified", "pending", "verified", "rejected"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const RESPONSE_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "withdrawn",
  "completed",
] as const;
export type ResponseStatus = (typeof RESPONSE_STATUSES)[number];

export const ACCOUNT_STATUSES = ["active", "suspended"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const ORGANIZATION_TYPES = [
  "individual_donor",
  "hospital",
  "blood_bank",
  "ngo",
  "patient_support_org",
] as const;
export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];

export const NOTIFICATION_TYPES = [
  "matching_request",
  "donor_response",
  "response_update",
  "request_update",
  "request_cancelled",
  "verification_update",
  "system",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const REPORT_TARGETS = ["user", "request"] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export const REPORT_REASONS = [
  "misleading_information",
  "payment_or_compensation_request",
  "organ_trade_or_brokerage",
  "harassment_or_abuse",
  "spam_or_duplicate",
  "privacy_violation",
  "unsafe_or_illegal_activity",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export type DonationPreference = "whole_blood" | "platelets" | "plasma";
export const DONATION_PREFERENCES: DonationPreference[] = ["whole_blood", "platelets", "plasma"];

/* ------------------------------------------------------------------ */
/* View models (what the API returns)                                  */
/* ------------------------------------------------------------------ */

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: UserRole;
  isAdmin: boolean;
  isDemo: boolean;
  accountStatus: AccountStatus;
  verificationStatus: VerificationStatus;
  organizationType: OrganizationType | null;
  organizationName: string | null;
  onboardingComplete: boolean;
  city: string | null;
  createdAt: string;
};

export type ProfileView = {
  userId: string;
  phone: string | null;
  city: string | null;
  area: string | null;
  approxLat: number | null;
  approxLng: number | null;
  bio: string | null;
  age: number | null;
  sharePhoneWithMatches: boolean;
  updatedAt: string;
};

export type DonorProfileView = {
  userId: string;
  bloodGroup: BloodGroup;
  lastDonationDate: string | null;
  availability: Availability;
  preferences: DonationPreference[];
  maxTravelKm: number;
  isVisibleToRecipients: boolean;
  notes: string | null;
  updatedAt: string;
};

export type RequestView = {
  id: string;
  reference: string;
  requesterId: string;
  requesterName: string;
  requesterVerified: boolean;
  requesterIsDemo: boolean;
  /** Never the exact hospital address — city/area granularity only. */
  city: string;
  area: string | null;
  /** Rounded to ~1km so home/private locations can never be reverse-engineered. */
  approxLat: number | null;
  approxLng: number | null;
  distanceKm: number | null;
  requestType: RequestType;
  bloodGroup: BloodGroup | null;
  unitsRequired: number;
  unitsFulfilled: number;
  hospitalName: string;
  requiredBy: string;
  urgency: Urgency;
  status: RequestStatus;
  additionalInfo: string | null;
  /** Only populated when the viewer is allowed to coordinate this request. */
  contact: RequestContact | null;
  responseCount: number;
  myResponseStatus: ResponseStatus | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

export type RequestContact = {
  name: string;
  phone: string;
  instructions: string | null;
  /** true when the phone number comes from a coordinated/approved match. */
  unlockedBy: "owner" | "admin" | "accepted_response" | "public";
};

export type DonorResponseView = {
  id: string;
  requestId: string;
  requestReference: string;
  requestUrgency: Urgency;
  requestType: RequestType;
  requestStatus: RequestStatus;
  requestCity: string;
  requestHospitalName: string;
  requestBloodGroup: BloodGroup | null;
  status: ResponseStatus;
  message: string | null;
  donorId?: string;
  donorName?: string;
  donorVerified?: boolean;
  donorBloodGroup?: BloodGroup | null;
  donorCity?: string | null;
  donorDistanceKm?: number | null;
  contact?: RequestContact | null;
  createdAt: string;
  updatedAt: string;
};

export type NotificationView = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

export type ReportView = {
  id: string;
  targetType: ReportTarget;
  targetId: string;
  targetLabel: string;
  reason: ReportReason;
  details: string | null;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  reporterId: string;
  reporterName: string;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VerificationView = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  organizationType: OrganizationType;
  organizationName: string | null;
  evidenceNote: string | null;
  status: VerificationStatus;
  reviewNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  isDemo: boolean;
};

export type AdminStats = {
  totalUsers: number;
  donors: number;
  recipients: number;
  both: number;
  verifiedUsers: number;
  pendingVerifications: number;
  suspendedUsers: number;
  openRequests: number;
  emergencyRequests: number;
  fulfilledRequests: number;
  totalRequests: number;
  donorResponses: number;
  openReports: number;
  demoRecords: number;
  realRecords: number;
  bloodGroupDemand: { label: string; value: number }[];
  requestsByDay: { label: string; value: number }[];
  requestsByType: { label: string; value: number }[];
};

export type VolunteerSummary = {
  id: string;
  name: string;
  avatarUrl: string | null;
  bloodGroup: BloodGroup | null;
  city: string | null;
  area: string | null;
  availability: Availability | null;
  verificationStatus: VerificationStatus;
  isDemo: boolean;
  distanceKm: number | null;
  lastDonationDate: string | null;
};

export type BlockedUserView = {
  id: string;
  name: string;
  blockedAt: string;
};

export type SessionUser = PublicUser & {
  profile: ProfileView;
  donorProfile: DonorProfileView | null;
  unreadNotifications: number;
  profileCompletion: number;
};
