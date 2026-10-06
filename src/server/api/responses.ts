import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { DonorResponseView, NotificationView, ResponseStatus } from "@/lib/domain";

import { requireActiveUser, requireUser } from "../auth/session";
import { getDb, mutate, newId, nowIso } from "../db/store";
import { forbidden, invalid, notFound } from "../errors";
import { buildDonorContext, createNotification } from "../services/notifications";
import { effectiveStatus } from "../services/sweep";
import { enforceRateLimit } from "../services/rate-limit";
import { toDonorResponseView, toNotificationView, type ViewerContext } from "../services/views";
import { action } from "./result";

function assertNotBlocked(
  blocks: { userId: string; blockedUserId: string }[],
  a: string,
  b: string,
): void {
  const blocked = blocks.some(
    (row) =>
      (row.userId === a && row.blockedUserId === b) || (row.userId === b && row.blockedUserId === a),
  );
  if (blocked) {
    throw forbidden("This connection is not available because of a block on this account.");
  }
}

export const createDonorResponse = createServerFn({ method: "POST" })
  .validator(
    z.object({
      requestId: z.string().trim().min(1),
      message: z.string().trim().max(400, "Keep your message under 400 characters").optional(),
      shareContact: z.boolean().default(false),
    }),
  )
  .handler(async ({ data }) =>
    action(async () => {
      const session = await requireActiveUser();
      if (session.role === "recipient") {
        throw forbidden(
          "Switch your role to Donor or Donor & Recipient in Settings to offer help with requests.",
        );
      }
      enforceRateLimit(`response:create:${session.id}`, 10, 60 * 60_000);

      const timestamp = nowIso();
      const responseId = newId("res");

      await mutate((db) => {
        const request = db.helpRequests.find((row) => row.id === data.requestId);
        if (!request) throw notFound("This request is no longer available.");
        if (request.requesterId === session.id) {
          throw invalid("You cannot offer help with your own request.");
        }
        if (effectiveStatus(request) !== "open") {
          throw invalid("This request is no longer accepting new offers.");
        }
        assertNotBlocked(db.blocks, session.id, request.requesterId);

        const existing = db.donorResponses.find(
          (row) => row.requestId === request.id && row.donorId === session.id,
        );
        if (existing && existing.status !== "withdrawn" && existing.status !== "declined") {
          throw invalid("You have already offered to help with this request.");
        }

        if (request.requestType !== "medical_assistance") {
          const donorProfile = db.donorProfiles.find((row) => row.userId === session.id);
          if (!donorProfile) {
            throw invalid(
              "Add your blood group in your donor profile before offering to help with a blood request.",
              { bloodGroup: "Blood group required" },
            );
          }
        }

        if (existing) {
          existing.status = "pending";
          existing.message = data.message ? data.message : null;
          existing.shareContact = data.shareContact;
          existing.updatedAt = timestamp;
          existing.withdrawnAt = null;
        } else {
          db.donorResponses.unshift({
            id: responseId,
            requestId: request.id,
            donorId: session.id,
            message: data.message ? data.message : null,
            status: "pending",
            shareContact: data.shareContact,
            createdAt: timestamp,
            updatedAt: timestamp,
            withdrawnAt: null,
          });
        }

        const donorProfile = db.donorProfiles.find((row) => row.userId === session.id);
        const donorProfileInfo = db.profiles.find((row) => row.userId === session.id);
        const verification = db.verifications
          .filter((row) => row.userId === session.id)
          .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1))[0];

        const groupLabel = donorProfile ? `${donorProfile.bloodGroup} ` : "";
        const verifiedLabel = verification?.status === "verified" ? "verified " : "";

        createNotification(db, {
          userId: request.requesterId,
          type: "donor_response",
          title: `${session.name} offered to help with ${request.reference}`,
          body: `${groupLabel}${verifiedLabel}donor${
            donorProfileInfo?.city ? ` in ${donorProfileInfo.city}` : ""
          } responded. Open the request to confirm and share coordination details.`,
          link: `/requests/${request.id}`,
        });

        createNotification(db, {
          userId: session.id,
          type: "response_update",
          title: `Your offer for ${request.reference} was sent`,
          body: "The requester or coordinator has been notified. You can withdraw your offer any time from My Activity.",
          link: "/activity",
        });
      });

      return { id: responseId, requestId: data.requestId };
    }),
  );

export const withdrawResponse = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().trim().min(1) }))
  .handler(async ({ data }) =>
    action(async () => {
      const session = await requireActiveUser();
      const timestamp = nowIso();

      await mutate((db) => {
        const response = db.donorResponses.find((row) => row.id === data.id);
        if (!response) throw notFound("Offer not found.");
        if (response.donorId !== session.id && !session.isAdmin) {
          throw forbidden("You can only withdraw your own offers.");
        }
        if (response.status === "withdrawn") {
          throw invalid("This offer is already withdrawn.");
        }
        if (response.status === "completed") {
          throw invalid(
            "This offer is recorded as a completed donation and cannot be withdrawn. Contact the team if this is a mistake.",
          );
        }

        const request = db.helpRequests.find((row) => row.id === response.requestId);
        const wasAccepted = response.status === "accepted";
        response.status = "withdrawn";
        response.withdrawnAt = timestamp;
        response.updatedAt = timestamp;

        if (request && wasAccepted) {
          createNotification(db, {
            userId: request.requesterId,
            type: "response_update",
            title: `A donor withdrew their offer for ${request.reference}`,
            body: `${session.name} is no longer able to help. Consider raising or reopening the request so other donors can respond.`,
            link: `/requests/${request.id}`,
          });
        }

      });

      return { withdrawn: true };
    }),
  );

export type ActivityPayload = {
  offers: DonorResponseView[];
  history: DonorResponseView[];
  notifications: NotificationView[];
  stats: {
    active: number;
    pending: number;
    accepted: number;
    completed: number;
    withdrawn: number;
    total: number;
  };
};

export const fetchMyActivity = createServerFn({ method: "GET" }).handler(
  async (): Promise<ActivityPayload> => {
    const session = await requireUser();
    const database = await getDb();
    const donor = buildDonorContext(database, session.id);
    const viewer: ViewerContext = { userId: session.id, isAdmin: session.isAdmin, point: donor.point };

    const all = database.donorResponses
      .filter((row) => row.donorId === session.id)
      .map((row) => toDonorResponseView(row, database, viewer))
      .filter((row): row is DonorResponseView => row !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const active = all.filter((row) => row.status === "pending" || row.status === "accepted");
    const history = all.filter(
      (row) =>
        row.status === "completed" || row.status === "declined" || row.status === "withdrawn",
    );

    const notifications = database.notifications
      .filter((row) => row.userId === session.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 20)
      .map(toNotificationView);

    return {
      offers: active,
      history,
      notifications,
      stats: {
        active: active.length,
        pending: all.filter((row) => row.status === "pending").length,
        accepted: all.filter((row) => row.status === "accepted").length,
        completed: all.filter((row) => row.status === "completed").length,
        withdrawn: all.filter((row) => row.status === "withdrawn").length,
        total: all.length,
      },
    };
  },
);

export const listRequestResponses = createServerFn({ method: "GET" })
  .validator(z.object({ requestId: z.string().trim().min(1) }))
  .handler(async ({ data }) => {
    const session = await requireUser();
    const database = await getDb();
    const request = database.helpRequests.find((row) => row.id === data.requestId);
    if (!request) throw notFound("Request not found.");
    if (request.requesterId !== session.id && !session.isAdmin) {
      throw forbidden("Only the requester or a moderator can view donor offers.");
    }

    const donor = buildDonorContext(database, session.id);
    const viewer: ViewerContext = { userId: session.id, isAdmin: session.isAdmin, point: donor.point };

    return database.donorResponses
      .filter((row) => row.requestId === request.id)
      .map((row) => toDonorResponseView(row, database, viewer))
      .filter((row): row is DonorResponseView => row !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

export const updateResponseStatus = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().trim().min(1),
      status: z.enum(["accepted", "declined", "completed", "pending"]),
      note: z.string().trim().max(300).optional(),
    }),
  )
  .handler(async ({ data }) =>
    action(async () => {
      const session = await requireActiveUser();
      const timestamp = nowIso();
      const status: ResponseStatus = data.status;

      await mutate((db) => {
        const response = db.donorResponses.find((row) => row.id === data.id);
        if (!response) throw notFound("Offer not found.");
        const request = db.helpRequests.find((row) => row.id === response.requestId);
        if (!request) throw notFound("Request not found.");
        if (request.requesterId !== session.id && !session.isAdmin) {
          throw forbidden("Only the requester or a moderator can update an offer.");
        }
        if (effectiveStatus(request) === "removed") {
          throw forbidden("This request was removed by moderators.");
        }

        response.status = status;
        response.updatedAt = timestamp;

        if (status === "accepted") {
          createNotification(db, {
            userId: response.donorId,
            type: "response_update",
            title: `Your offer for ${request.reference} was accepted`,
            body: `Please coordinate with ${request.contactName} at ${request.hospitalName}, ${request.city}. Donors and coordinators only — never share documents or money.`,
            link: `/requests/${request.id}`,
          });

          if (request.status === "open") {
            request.status = "in_progress";
            request.updatedAt = timestamp;
          }
        }

        if (status === "declined") {
          createNotification(db, {
            userId: response.donorId,
            type: "response_update",
            title: `Your offer for ${request.reference} was not needed`,
            body: data.note
              ? `Coordinator note: ${data.note}`
              : "The coordinator found another donor. Thank you for offering — other nearby requests may still need you.",
            link: "/find-help",
          });
        }

        if (status === "completed") {
          const fulfilled = Math.min(request.unitsRequired, Math.max(1, request.unitsFulfilled + 1));
          request.unitsFulfilled = fulfilled;
          request.updatedAt = timestamp;
          if (fulfilled >= request.unitsRequired) {
            request.status = "fulfilled";
            request.resolvedAt = timestamp;
          }
          createNotification(db, {
            userId: response.donorId,
            type: "response_update",
            title: `Donation recorded for ${request.reference}`,
            body: "Thank you. Please make sure the hospital or blood bank updated the official donation record.",
            link: "/activity",
          });
        }
      });

      return { status };
    }),
  );
