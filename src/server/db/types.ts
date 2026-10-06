import type {
  AccountStatus,
  Availability,
  BloodGroup,
  DonationPreference,
  NotificationType,
  OrganizationType,
  ReportReason,
  RequestStatus,
  RequestType,
  ResponseStatus,
  Urgency,
  UserRole,
  VerificationStatus,
} from "@/lib/domain";

/**
 * Database row shapes.
 *
 * The MVP ships with a JSON-backed store (`src/server/db/store.ts`) that keeps
 * the same relational structure a SQL schema would use: one collection per
 * table, foreign keys by id, and no nested duplication of private data. Swapping
 * the adapter for Postgres/Supabase only requires re-implementing the store.
 */

export type UserRow = {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null;
  provider: "google" | "password" | "demo";
  providerId: string | null;
  avatarUrl: string | null;
  role: UserRole;
  isAdmin: boolean;
  isDemo: boolean;
  accountStatus: AccountStatus;
  suspendedReason: string | null;
  onboardingComplete: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
};

export type ProfileRow = {
  userId: string;
  phone: string | null;
  city: string | null;
  area: string | null;
  approxLat: number | null;
  approxLng: number | null;
  bio: string | null;
  age: number | null;
  sharePhoneWithMatches: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DonorProfileRow = {
  userId: string;
  bloodGroup: BloodGroup;
  lastDonationDate: string | null;
  availability: Availability;
  preferences: DonationPreference[];
  maxTravelKm: number;
  isVisibleToRecipients: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type HelpRequestRow = {
  id: string;
  reference: string;
  requesterId: string;
  requestType: RequestType;
  bloodGroup: BloodGroup | null;
  unitsRequired: number;
  unitsFulfilled: number;
  hospitalName: string;
  /** Intentionally no street address — city/area granularity only. */
  city: string;
  area: string | null;
  approxLat: number | null;
  approxLng: number | null;
  requiredBy: string;
  urgency: Urgency;
  status: RequestStatus;
  additionalInfo: string | null;
  contactName: string;
  contactPhone: string;
  contactInstructions: string | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  moderationNote: string | null;
  removedBy: string | null;
};

export type DonorResponseRow = {
  id: string;
  requestId: string;
  donorId: string;
  message: string | null;
  status: ResponseStatus;
  shareContact: boolean;
  createdAt: string;
  updatedAt: string;
  withdrawnAt: string | null;
};

export type NotificationRow = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export type ReportRow = {
  id: string;
  reporterId: string;
  targetType: "user" | "request";
  targetId: string;
  reason: ReportReason;
  details: string | null;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  resolutionNote: string | null;
  handledBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VerificationRow = {
  id: string;
  userId: string;
  organizationType: OrganizationType;
  organizationName: string | null;
  evidenceNote: string | null;
  status: VerificationStatus;
  reviewNote: string | null;
  reviewedBy: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  isDemo: boolean;
};

export type BlockRow = {
  id: string;
  userId: string;
  blockedUserId: string;
  createdAt: string;
};

export type SessionRow = {
  id: string;
  tokenHash: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
};

export type AuditRow = {
  id: string;
  actorId: string;
  action: string;
  targetType: "user" | "request" | "report" | "verification" | "system";
  targetId: string;
  note: string | null;
  createdAt: string;
};

export type Database = {
  version: number;
  seeded: boolean;
  users: UserRow[];
  profiles: ProfileRow[];
  donorProfiles: DonorProfileRow[];
  helpRequests: HelpRequestRow[];
  donorResponses: DonorResponseRow[];
  notifications: NotificationRow[];
  reports: ReportRow[];
  verifications: VerificationRow[];
  blocks: BlockRow[];
  sessions: SessionRow[];
  auditLog: AuditRow[];
  counters: {
    requestReference: number;
  };
};

export const EMPTY_DATABASE: Database = {
  version: 1,
  seeded: false,
  users: [],
  profiles: [],
  donorProfiles: [],
  helpRequests: [],
  donorResponses: [],
  notifications: [],
  reports: [],
  verifications: [],
  blocks: [],
  sessions: [],
  auditLog: [],
  counters: { requestReference: 1000 },
};
