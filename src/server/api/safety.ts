import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { BlockedUserView, ReportView } from "@/lib/domain";
import { reportSchema } from "@/lib/validation";

import { requireActiveUser, requireUser } from "../auth/session";
import { getDb, mutate, newId, nowIso } from "../db/store";
import { forbidden, invalid, notFound } from "../errors";
import { recordAudit } from "../services/audit";
import { createNotification } from "../services/notifications";
import { enforceRateLimit } from "../services/rate-limit";
import { toReportView } from "../services/views";
import { action } from "./result";

export const createReport = createServerFn({ method: "POST" })
  .validator(reportSchema)
  .handler(async ({ data }) =>
    action(async () => {
      const session = await requireActiveUser();
      enforceRateLimit(`report:${session.id}`, 6, 60 * 60_000);

      const reportId = newId("rep");
      const timestamp = nowIso();

      await mutate((db) => {
        if (data.targetType === "user") {
          const target = db.users.find((row) => row.id === data.targetId);
          if (!target) throw notFound("That member could not be found.");
          if (target.id === session.id) throw invalid("You cannot report your own account.");
        } else {
          const target = db.helpRequests.find((row) => row.id === data.targetId);
          if (!target) throw notFound("That request could not be found.");
        }

        const duplicate = db.reports.find(
          (row) =>
            row.reporterId === session.id &&
            row.targetId === data.targetId &&
            row.status !== "resolved" &&
            row.status !== "dismissed",
        );
        if (duplicate) throw invalid("You have already reported this. Our team is reviewing it.");

        db.reports.unshift({
          id: reportId,
          reporterId: session.id,
          targetType: data.targetType,
          targetId: data.targetId,
          reason: data.reason,
          details: data.details ? data.details : null,
          status: "open",
          resolutionNote: null,
          handledBy: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        });

        recordAudit(db, {
          actorId: session.id,
          action: `report.created:${data.reason}`,
          targetType: data.targetType,
          targetId: data.targetId,
          note: data.details ?? null,
        });

        for (const admin of db.users.filter((row) => row.isAdmin)) {
          createNotification(db, {
            userId: admin.id,
            type: "system",
            title: "New safety report",
            body: `${session.name} reported a ${data.targetType} (${data.reason.replace(/_/g, " ")}).`,
            link: "/admin?tab=reports",
          });
        }
      });

      return { id: reportId };
    }),
  );

export const fetchMyReports = createServerFn({ method: "GET" }).handler(async () => {
  const session = await requireUser();
  const database = await getDb();
  const items: ReportView[] = database.reports
    .filter((row) => row.reporterId === session.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((row) => toReportView(row, database));
  return { items };
});

export const blockUser = createServerFn({ method: "POST" })
  .validator(z.object({ userId: z.string().trim().min(1) }))
  .handler(async ({ data }) =>
    action(async () => {
      const session = await requireActiveUser();
      if (data.userId === session.id) throw invalid("You cannot block your own account.");

      await mutate((db) => {
        const target = db.users.find((row) => row.id === data.userId);
        if (!target) throw notFound("That member could not be found.");
        const existing = db.blocks.find(
          (row) => row.userId === session.id && row.blockedUserId === data.userId,
        );
        if (existing) return;
        db.blocks.push({
          id: newId("blk"),
          userId: session.id,
          blockedUserId: data.userId,
          createdAt: nowIso(),
        });
        // Blocking also withdraws any pending offers between the two accounts.
        const myRequests = db.helpRequests
          .filter((row) => row.requesterId === session.id)
          .map((row) => row.id);
        for (const response of db.donorResponses) {
          if (myRequests.includes(response.requestId) && response.donorId === data.userId) {
            if (response.status === "pending") {
              response.status = "withdrawn";
              response.withdrawnAt = nowIso();
            }
          }
        }
      });

      return { blocked: true };
    }),
  );

export const unblockUser = createServerFn({ method: "POST" })
  .validator(z.object({ userId: z.string().trim().min(1) }))
  .handler(async ({ data }) =>
    action(async () => {
      const session = await requireUser();
      await mutate((db) => {
        db.blocks = db.blocks.filter(
          (row) => !(row.userId === session.id && row.blockedUserId === data.userId),
        );
      });
      return { blocked: false };
    }),
  );

export const fetchBlockedUsers = createServerFn({ method: "GET" }).handler(async () => {
  const session = await requireUser();
  const database = await getDb();
  const items: BlockedUserView[] = database.blocks
    .filter((row) => row.userId === session.id)
    .map((row) => {
      const user = database.users.find((item) => item.id === row.blockedUserId);
      return {
        id: row.blockedUserId,
        name: user?.name ?? "Removed member",
        blockedAt: row.createdAt,
      };
    })
    .sort((a, b) => b.blockedAt.localeCompare(a.blockedAt));
  return { items };
});

export const fetchMyBlockStatus = createServerFn({ method: "GET" })
  .validator(z.object({ userId: z.string().trim().min(1) }))
  .handler(async ({ data }) => {
    const session = await requireUser();
    const database = await getDb();
    const blocked = database.blocks.some(
      (row) => row.userId === session.id && row.blockedUserId === data.userId,
    );
    const blockedByThem = database.blocks.some(
      (row) => row.userId === data.userId && row.blockedUserId === session.id,
    );
    if (data.userId === session.id) {
      throw forbidden("You cannot block yourself.");
    }
    return { blocked, blockedByThem };
  });
