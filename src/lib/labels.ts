import type {
  Availability,
  BloodGroup,
  NotificationType,
  OrganizationType,
  ReportReason,
  RequestStatus,
  RequestType,
  ResponseStatus,
  Urgency,
  UserRole,
  VerificationStatus,
} from "./domain";

export type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info" | "blood";

export const ROLE_LABELS: Record<UserRole, string> = {
  donor: "Donor",
  recipient: "Recipient",
  both: "Donor & Recipient",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  donor: "You want to donate blood or platelets and help requests near you.",
  recipient: "You are coordinating medical donation help for yourself or someone you know.",
  both: "You want to give when you can, and you can also raise a request when you need help.",
};

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  blood: "Blood",
  platelets: "Platelets",
  medical_assistance: "Other medical assistance",
};

export const REQUEST_TYPE_SHORT_LABELS: Record<RequestType, string> = {
  blood: "Blood",
  platelets: "Platelets",
  medical_assistance: "Medical assistance",
};

export const URGENCY_LABELS: Record<Urgency, string> = {
  normal: "Normal",
  urgent: "Urgent",
  emergency: "Emergency",
};

export const URGENCY_DESCRIPTIONS: Record<Urgency, string> = {
  normal: "Planned need. A few days of notice is available.",
  urgent: "Needed soon — usually within 24–48 hours.",
  emergency: "Needed immediately. Use emergency services and hospital blood bank first.",
};

export const URGENCY_TONES: Record<Urgency, Tone> = {
  normal: "neutral",
  urgent: "warning",
  emergency: "danger",
};

export const URGENCY_RANK: Record<Urgency, number> = {
  emergency: 3,
  urgent: 2,
  normal: 1,
};

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
  expired: "Expired",
  removed: "Removed by moderators",
};

export const REQUEST_STATUS_TONES: Record<RequestStatus, Tone> = {
  open: "primary",
  in_progress: "info",
  fulfilled: "success",
  cancelled: "neutral",
  expired: "neutral",
  removed: "danger",
};

export const RESPONSE_STATUS_LABELS: Record<ResponseStatus, string> = {
  pending: "Awaiting confirmation",
  accepted: "Accepted by coordinator",
  declined: "Not needed",
  withdrawn: "Withdrawn by donor",
  completed: "Donation completed",
};

export const RESPONSE_STATUS_TONES: Record<ResponseStatus, Tone> = {
  pending: "warning",
  accepted: "success",
  declined: "neutral",
  withdrawn: "neutral",
  completed: "success",
};

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  available: "Available to donate",
  unavailable: "Not available right now",
  on_hold: "Available with notice",
};

export const AVAILABILITY_TONES: Record<Availability, Tone> = {
  available: "success",
  unavailable: "neutral",
  on_hold: "warning",
};

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  unverified: "Unverified",
  pending: "Pending verification",
  verified: "Verified",
  rejected: "Verification needs attention",
};

export const VERIFICATION_TONES: Record<VerificationStatus, Tone> = {
  unverified: "neutral",
  pending: "warning",
  verified: "success",
  rejected: "danger",
};

export const ORGANIZATION_TYPE_LABELS: Record<OrganizationType, string> = {
  individual_donor: "Individual donor",
  hospital: "Hospital",
  blood_bank: "Blood bank",
  ngo: "NGO / community group",
  patient_support_org: "Patient support organisation",
};

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  misleading_information: "Misleading or inaccurate information",
  payment_or_compensation_request: "Request for payment or compensation",
  organ_trade_or_brokerage: "Organ trade, brokerage or private organ deal",
  harassment_or_abuse: "Harassment or abusive behaviour",
  spam_or_duplicate: "Spam or duplicate listing",
  privacy_violation: "Sharing private information",
  unsafe_or_illegal_activity: "Unsafe or illegal activity",
  other: "Something else",
};

export const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  matching_request: "Matching request",
  donor_response: "Donor response",
  response_update: "Response update",
  request_update: "Request update",
  request_cancelled: "Request cancelled",
  verification_update: "Verification update",
  system: "Platform update",
};

export const BLOOD_GROUP_TONES: Record<BloodGroup, string> = {
  "O-": "bg-blood/10 text-blood border-blood/25",
  "O+": "bg-blood/10 text-blood border-blood/25",
  "A-": "bg-info/10 text-info border-info/25",
  "A+": "bg-info/10 text-info border-info/25",
  "B-": "bg-primary/10 text-primary border-primary/25",
  "B+": "bg-primary/10 text-primary border-primary/25",
  "AB-": "bg-warning/15 text-warning border-warning/30",
  "AB+": "bg-warning/15 text-warning border-warning/30",
};

/** Urgency ordering helper for filters and sorting. */
export function urgencyRank(urgency: Urgency): number {
  return URGENCY_RANK[urgency];
}
