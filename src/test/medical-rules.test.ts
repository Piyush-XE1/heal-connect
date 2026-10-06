import { describe, expect, it } from "vitest";

import {
  MATCHING_WEIGHTS,
  RBC_DONOR_TO_RECIPIENTS,
  RBC_RECIPIENT_CAN_RECEIVE_FROM,
  canDonateTo,
  compatibleDonorsFor,
  isUniversalDonor,
  isUniversalRecipient,
} from "@/lib/blood";
import { BLOOD_GROUPS, type BloodGroup } from "@/lib/domain";
import { distanceBand, distanceKm, formatDistance, roundCoord } from "@/lib/geo";
import { maskEmail, maskPhone, relativeTime } from "@/lib/format";
import {
  SUGGESTED_WHOLE_BLOOD_INTERVAL_DAYS,
  scoreMatch,
  sortByMatchScore,
  type MatchDonorContext,
  type MatchRequestContext,
  type MatchResult,
} from "@/lib/matching";
import { requestSchema } from "@/lib/validation";

const today = () => new Date().toISOString().slice(0, 10);
const inDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

const baseRequest = {
  requestType: "blood" as const,
  bloodGroup: "O+" as BloodGroup,
  unitsRequired: 2,
  hospitalName: "City Hospital",
  city: "Delhi",
  requiredBy: inDays(2),
  urgency: "urgent" as const,
  contactName: "Asha Verma",
  contactPhone: "9876543210",
  consent: true as const,
};

describe("red-blood-cell compatibility reference", () => {
  it("keeps the donor and recipient tables as exact transposes of each other", () => {
    for (const donor of BLOOD_GROUPS) {
      for (const recipient of BLOOD_GROUPS) {
        const donorSays = RBC_DONOR_TO_RECIPIENTS[donor].includes(recipient);
        const recipientSays = RBC_RECIPIENT_CAN_RECEIVE_FROM[recipient].includes(donor);
        expect(donorSays).toBe(recipientSays);
        expect(canDonateTo(donor, recipient)).toBe(donorSays);
      }
    }
  });

  it("treats O-negative as the universal donor and AB-positive as the universal recipient", () => {
    for (const group of BLOOD_GROUPS) {
      expect(canDonateTo("O-", group)).toBe(true);
      expect(canDonateTo(group, "AB+")).toBe(true);
    }
    expect(isUniversalDonor("O-")).toBe(true);
    expect(isUniversalDonor("O+")).toBe(false);
    expect(isUniversalRecipient("AB+")).toBe(true);
  });

  it("never claims a donor group is compatible with itself only by accident", () => {
    for (const group of BLOOD_GROUPS) {
      expect(canDonateTo(group, group)).toBe(true);
      expect(compatibleDonorsFor(group)).toContain(group);
      expect(compatibleDonorsFor(group).length).toBeGreaterThan(0);
    }
  });

  it("matches the clinically expected directions", () => {
    expect(canDonateTo("A+", "B+")).toBe(false);
    expect(canDonateTo("B+", "A+")).toBe(false);
    expect(canDonateTo("A+", "AB+")).toBe(true);
    expect(canDonateTo("AB+", "A+")).toBe(false);
    expect(canDonateTo("O+", "O-")).toBe(false);
    expect(canDonateTo("O-", "AB-")).toBe(true);
    expect(compatibleDonorsFor("A+")).toEqual(["O-", "O+", "A-", "A+"]);
  });

  it("documents matching weights that add up to a full score", () => {
    const total = Object.values(MATCHING_WEIGHTS).reduce((sum, value) => sum + value, 0);
    expect(total).toBe(100);
  });
});

describe("scoreMatch ranking and safety blockers", () => {
  const donor: MatchDonorContext = {
    userId: "usr_donor",
    bloodGroup: "O-",
    city: "Delhi",
    availability: "available",
    lastDonationDate: null,
    maxTravelKm: 40,
    preferences: ["whole_blood"],
    point: { lat: 28.61, lng: 77.21 },
  };

  const request: MatchRequestContext = {
    id: "req_1",
    requesterId: "usr_recipient",
    requestType: "blood",
    bloodGroup: "A+",
    urgency: "urgent",
    status: "open",
    point: { lat: 28.62, lng: 77.22 },
    requiredBy: inDays(2),
    hasResponded: false,
  };

  it("scores a compatible, nearby, available donor as eligible", () => {
    const result = scoreMatch(request, donor);
    expect(result.eligible).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.score).toBeGreaterThan(0);
    const summed = result.breakdown.reduce((total, entry) => total + entry.points, 0);
    expect(result.score).toBe(summed);
    expect(result.breakdown.map((entry) => entry.label)).toEqual([
      "Blood group",
      "Distance",
      "Availability",
      "Urgency",
    ]);
    expect(result.distanceKm).toBeLessThan(5);
  });

  it("blocks incompatible blood groups but still explains the blood bank rule", () => {
    const result = scoreMatch({ ...request, bloodGroup: "B+" }, { ...donor, bloodGroup: "A+" });
    expect(result.eligible).toBe(false);
    expect(result.score).toBe(0);
    expect(result.blockers.join(" ")).toMatch(/blood bank decides the final match/i);
  });

  it("blocks the viewer's own requests, closed requests, existing offers and blocked users", () => {
    expect(scoreMatch(request, donor, { viewerId: "usr_recipient" }).eligible).toBe(false);
    expect(scoreMatch({ ...request, status: "fulfilled" }, donor).eligible).toBe(false);
    expect(scoreMatch({ ...request, hasResponded: true }, donor).eligible).toBe(false);
    const blocked = scoreMatch(request, donor, { blockedUserIds: ["usr_recipient"] });
    expect(blocked.eligible).toBe(false);
    expect(blocked.blockers[0]).toMatch(/block/i);
  });

  it("warns about a recent donation and travel beyond the donor's preference without blocking", () => {
    const recent = scoreMatch(request, {
      ...donor,
      lastDonationDate: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    });
    expect(recent.eligible).toBe(true);
    expect(recent.cautions.join(" ")).toMatch(/last donation was 30 days ago/i);
    expect(SUGGESTED_WHOLE_BLOOD_INTERVAL_DAYS).toBe(90);

    const far = scoreMatch({ ...request, point: { lat: 19.07, lng: 72.87 } }, donor);
    expect(far.eligible).toBe(true);
    expect(far.cautions.join(" ")).toMatch(/travel preference/i);
  });

  it("notes missing donor blood group instead of pretending to match", () => {
    const result = scoreMatch(request, { ...donor, bloodGroup: null });
    expect(result.breakdown[0]?.detail).toMatch(/add your blood group/i);
  });

  it("sorts eligible items first and leaves unscored items last", () => {
    const stub = (eligible: boolean, score: number): MatchResult => ({
      eligible,
      score,
      distanceKm: null,
      breakdown: [],
      blockers: [],
      cautions: [],
    });
    const items = [
      { id: "low", match: stub(true, 40) },
      { id: "none", match: null },
      { id: "high", match: stub(true, 90) },
      { id: "blocked", match: stub(false, 0) },
    ];
    expect(sortByMatchScore(items).map((item) => item.id)).toEqual([
      "high",
      "low",
      "blocked",
      "none",
    ]);
  });
});

describe("geo helpers keep distances coarse", () => {
  it("computes a symmetric, zero-at-same-point distance", () => {
    const delhi = { lat: 28.6139, lng: 77.209 };
    const noida = { lat: 28.5355, lng: 77.391 };
    expect(distanceKm(delhi, delhi)).toBeCloseTo(0, 5);
    expect(distanceKm(delhi, noida)).toBeCloseTo(distanceKm(noida, delhi), 5);
    expect(distanceKm(delhi, noida)).toBeGreaterThan(15);
    expect(distanceKm(delhi, noida)).toBeLessThan(30);
  });

  it("bands distances and rounds coordinates so exact addresses never leak", () => {
    expect(distanceBand(3)).toMatch(/0–5 km/);
    expect(distanceBand(12)).toMatch(/5–15 km/);
    expect(distanceBand(30)).toMatch(/15–40 km/);
    expect(distanceBand(null)).toMatch(/unknown/i);
    expect(formatDistance(0.4)).toMatch(/under 1 km/i);
    expect(roundCoord(28.61391234)).toBe(28.61);
    expect(roundCoord(77.2091234)).toBe(77.21);
  });
});

describe("privacy-preserving formatting", () => {
  it("masks phone numbers and emails", () => {
    expect(maskPhone("+91 98765 43210")).toBe("••••••3210");
    expect(maskPhone(null)).toBe("Not shared");
    expect(maskPhone("1234")).toBe("••••1234");
    expect(maskEmail("asha.verma@example.com")).toBe("as••••••••@example.com");
    expect(maskEmail("not-an-email")).toBe("not-an-email");
  });

  it("describes recent timestamps in words", () => {
    expect(relativeTime(new Date().toISOString())).toMatch(/just now|moment/i);
    expect(relativeTime(null)).toBe("");
  });
});

describe("request validation rules", () => {
  it("accepts a complete blood request", () => {
    expect(requestSchema.safeParse(baseRequest).success).toBe(true);
  });

  it("requires consent, a future date and a blood group for blood requests", () => {
    expect(requestSchema.safeParse({ ...baseRequest, consent: false }).success).toBe(false);
    expect(requestSchema.safeParse({ ...baseRequest, requiredBy: inDays(-1) }).success).toBe(false);
    expect(requestSchema.safeParse({ ...baseRequest, bloodGroup: null }).success).toBe(false);
  });

  it("allows non-blood assistance without a blood group", () => {
    const result = requestSchema.safeParse({
      ...baseRequest,
      requestType: "medical_assistance",
      bloodGroup: null,
      hospitalName: "Community Clinic",
    });
    expect(result.success).toBe(true);
  });

  it("demands extra detail for emergency requests", () => {
    expect(requestSchema.safeParse({ ...baseRequest, urgency: "emergency" }).success).toBe(false);
    expect(
      requestSchema.safeParse({
        ...baseRequest,
        urgency: "emergency",
        additionalInfo: "ICU ward 4, ask for the transfusion desk.",
      }).success,
    ).toBe(true);
  });

  it("rejects implausible unit counts and short hospital names", () => {
    expect(requestSchema.safeParse({ ...baseRequest, unitsRequired: 0 }).success).toBe(false);
    expect(requestSchema.safeParse({ ...baseRequest, unitsRequired: 21 }).success).toBe(false);
    expect(requestSchema.safeParse({ ...baseRequest, hospitalName: "AB" }).success).toBe(false);
    expect(requestSchema.safeParse({ ...baseRequest, requiredBy: today() }).success).toBe(true);
  });
});
