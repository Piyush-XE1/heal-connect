import type { BloodGroup } from "./domain";

/**
 * Red-blood-cell compatibility (donor → recipient).
 *
 * This is general information used only to *rank and surface* potentially
 * relevant requests. It is deliberately conservative: the platform never
 * decides whether a donation is clinically suitable. Cross-matching, screening,
 * and eligibility are always performed by qualified medical professionals and
 * licensed blood banks.
 */
export const RBC_DONOR_TO_RECIPIENTS: Record<BloodGroup, BloodGroup[]> = {
  "O-": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
  "O+": ["O+", "A+", "B+", "AB+"],
  "A-": ["A-", "A+", "AB-", "AB+"],
  "A+": ["A+", "AB+"],
  "B-": ["B-", "B+", "AB-", "AB+"],
  "B+": ["B+", "AB+"],
  "AB-": ["AB-", "AB+"],
  "AB+": ["AB+"],
};

/** Recipients of red blood cells may receive from these donor groups. */
export const RBC_RECIPIENT_CAN_RECEIVE_FROM: Record<BloodGroup, BloodGroup[]> = {
  "O-": ["O-"],
  "O+": ["O-", "O+"],
  "A-": ["O-", "A-"],
  "A+": ["O-", "O+", "A-", "A+"],
  "B-": ["O-", "B-"],
  "B+": ["O-", "O+", "B-", "B+"],
  "AB-": ["O-", "A-", "B-", "AB-"],
  "AB+": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
};

export function canDonateTo(donor: BloodGroup, recipient: BloodGroup): boolean {
  return RBC_DONOR_TO_RECIPIENTS[donor].includes(recipient);
}

export function compatibleDonorsFor(recipient: BloodGroup): BloodGroup[] {
  return RBC_RECIPIENT_CAN_RECEIVE_FROM[recipient];
}

export function isUniversalDonor(bloodGroup: BloodGroup): boolean {
  return bloodGroup === "O-";
}

export function isUniversalRecipient(bloodGroup: BloodGroup): boolean {
  return bloodGroup === "AB+";
}

/**
 * Compatibility guidance shown to users. Kept in one place so the wording can
 * be reviewed and refined by medical reviewers.
 */
export const COMPATIBILITY_DISCLAIMER =
  "Compatibility shown here is general red-blood-cell guidance only. Final compatibility, screening and donor eligibility are always determined by qualified medical professionals and the blood bank. Never rely on this platform for a medical decision.";

export const MEDICAL_DECISION_DISCLAIMER =
  "Heal Connect does not provide medical advice and does not decide who can donate or receive. Hospitals, blood banks and licensed clinicians make every medical eligibility decision.";

/** Chance/benefit weighting used by the matching ranker (documented for transparency). */
export const MATCHING_WEIGHTS = {
  bloodGroup: 40,
  distance: 25,
  availability: 20,
  urgency: 15,
} as const;

export const MATCHING_EXPLAINER =
  "Requests are ranked by blood-group compatibility, proximity, donor availability and urgency. This is a relevance ordering, not a medical decision.";
