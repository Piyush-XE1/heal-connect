import { createServerFn } from "@tanstack/react-start";

import type { VerificationView } from "@/lib/domain";
import { verificationSchema } from "@/lib/validation";

import { requireActiveUser, requireUser } from "../auth/session";
import { getDb, mutate, newId, nowIso } from "../db/store";
import { invalid } from "../errors";
import { recordAudit } from "../services/audit";
import { createNotification } from "../services/notifications";
import { enforceRateLimit } from "../services/rate-limit";
import { toVerificationView } from "../services/views";
import { action } from "./result";

export type VerificationPayload = {
  current: VerificationView | null;
  eligible: boolean;
  requirements: { label: string; met: boolean }[];
  guidance: string[];
};

export const fetchMyVerification = createServerFn({ method: "GET" }).handler(
  async (): Promise<VerificationPayload> => {
    const session = await requireUser();
    const database = await getDb();

    const record = database.verifications
      .filter((row) => row.userId === session.id)
      .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1))[0];

    const profile = database.profiles.find((row) => row.userId === session.id);
    const requirements = [
      { label: "Full name on your account", met: Boolean(session.name && session.name.length > 1) },
      {
        label: "City and area added to your profile",
        met: Boolean(profile?.city && profile?.area),
      },
      { label: "A contact number saved privately", met: Boolean(profile?.phone) },
      { label: "Profile marked complete", met: session.onboardingComplete },
      {
        label: "Donor details added (for donor accounts)",
        met:
          session.role === "recipient" ||
          Boolean(database.donorProfiles.find((row) => row.userId === session.id)?.bloodGroup),
      },
    ];

    return {
      current: record ? toVerificationView(record, database) : null,
      eligible: requirements.every((item) => item.met),
      requirements,
      guidance: [
        "Verification is a manual, admin-controlled review in this MVP. A real deployment would verify against hospital or blood-bank records.",
        "We never ask for ID documents, medical reports or payment inside the platform. Do not upload sensitive documents here.",
        "Verified badges apply to the account holder — they are not a medical certification of any donor.",
      ],
    };
  },
);

export const submitVerification = createServerFn({ method: "POST" })
  .validator(verificationSchema)
  .handler(async ({ data }) =>
    action(async () => {
      const session = await requireActiveUser();
      enforceRateLimit(`verification:${session.id}`, 3, 24 * 60 * 60_000);
      const timestamp = nowIso();
      const verificationId = newId("ver");

      await mutate((db) => {
        const existing = db.verifications
          .filter((row) => row.userId === session.id)
          .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1))[0];

        if (existing?.status === "verified") {
          throw invalid("Your account is already verified.");
        }
        if (existing?.status === "pending") {
          throw invalid("Your verification is already in review.");
        }

        db.verifications.push({
          id: verificationId,
          userId: session.id,
          organizationType: data.organizationType,
          organizationName: data.organizationName ? data.organizationName : null,
          evidenceNote: data.evidenceNote,
          status: "pending",
          reviewNote: null,
          reviewedBy: null,
          submittedAt: timestamp,
          reviewedAt: null,
          isDemo: session.isDemo,
        });

        recordAudit(db, {
          actorId: session.id,
          action: "verification.submitted",
          targetType: "verification",
          targetId: verificationId,
          note: data.organizationType,
        });

        createNotification(db, {
          userId: session.id,
          type: "verification_update",
          title: "Verification submitted",
          body: "Our team is reviewing your details. This MVP uses a manual, admin-controlled review.",
          link: "/verify",
        });

        for (const admin of db.users.filter((row) => row.isAdmin)) {
          createNotification(db, {
            userId: admin.id,
            type: "system",
            title: "New verification request",
            body: `${session.name} requested verification as ${data.organizationType.replace(/_/g, " ")}.`,
            link: "/admin?tab=verifications",
          });
        }
      });

      return { id: verificationId, status: "pending" as const };
    }),
  );
