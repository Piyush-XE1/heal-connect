import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  BLOOD_GROUPS,
  USER_ROLES,
  VERIFICATION_STATUSES,
  type AdminStats,
  type ReportView,
  type RequestStatus,
  type RequestType,
  type Urgency,
  type UserRole,
  type VerificationStatus,
  type VerificationView,
} from "@/lib/domain";
import { relativeTime } from "@/lib/format";

import { requireAdmin } from "../auth/session";
import { getDb, mutate, nowIso } from "../db/store";
import { invalid, notFound } from "../errors";
import { recordAudit } from "../services/audit";
import { createNotification } from "../services/notifications";
import { effectiveStatus, sweepExpiredRequests } from "../services/sweep";
import { toReportView, toVerificationView } from "../services/views";
import { action } from "./result";

export type AdminOverview = {
  stats: AdminStats;
  recentReports: ReportView[];
  pendingVerifications: VerificationView[];
  emergencyRequests: {
    id: string;
    reference: string;
    city: string;
    hospitalName: string;
    bloodGroup: string | null;
    unitsRequired: number;
    requiredBy: string;
    createdAt: string;
    requesterName: string;
  }[];
  auditTrail: { id: string; action: string; targetType: string; note: string | null; at: string; actorName: string }[];
  environment: {
    demoLoginEnabled: boolean;
    demoRecords: number;
    realRecords: number;
    googleConfigured: boolean;
  };
};

function buildStats(db: Awaited<ReturnType<typeof getDb>>): AdminStats {
  const requests = db.helpRequests.map((row) => ({ ...row, status: effectiveStatus(row) }));
  const openRequests = requests.filter((row) => row.status === "open" || row.status === "in_progress");

  const bloodGroupDemand = BLOOD_GROUPS.map((group) => ({
    label: group,
    value: openRequests.filter((row) => row.bloodGroup === group).length,
  })).filter((entry) => entry.value > 0);

  const days: { label: string; value: number }[] = [];
  for (let offset = 13; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    const key = date.toISOString().slice(0, 10);
    days.push({
      label: date.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      value: requests.filter((row) => row.createdAt.slice(0, 10) === key).length,
    });
  }

  const typeLabels: Record<RequestType, string> = {
    blood: "Blood",
    platelets: "Platelets",
    medical_assistance: "Medical assistance",
  };

  return {
    totalUsers: db.users.length,
    donors: db.users.filter((row) => row.role === "donor").length,
    recipients: db.users.filter((row) => row.role === "recipient").length,
    both: db.users.filter((row) => row.role === "both").length,
    verifiedUsers: db.verifications.filter((row) => row.status === "verified").length,
    pendingVerifications: db.verifications.filter((row) => row.status === "pending").length,
    suspendedUsers: db.users.filter((row) => row.accountStatus === "suspended").length,
    openRequests: openRequests.length,
    emergencyRequests: openRequests.filter((row) => row.urgency === "emergency").length,
    fulfilledRequests: requests.filter((row) => row.status === "fulfilled").length,
    totalRequests: requests.length,
    donorResponses: db.donorResponses.length,
    openReports: db.reports.filter((row) => row.status === "open" || row.status === "reviewing").length,
    demoRecords:
      db.users.filter((row) => row.isDemo).length +
      db.helpRequests.filter((row) => row.isDemo).length,
    realRecords:
      db.users.filter((row) => !row.isDemo).length +
      db.helpRequests.filter((row) => !row.isDemo).length,
    bloodGroupDemand,
    requestsByDay: days,
    requestsByType: (Object.keys(typeLabels) as RequestType[]).map((type) => ({
      label: typeLabels[type],
      value: requests.filter((row) => row.requestType === type).length,
    })),
  };
}

export const fetchAdminOverview = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminOverview> => {
    await requireAdmin();
    const database = await getDb();

    const recentReports = database.reports
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5)
      .map((row) => toReportView(row, database));

    const pendingVerifications = database.verifications
      .filter((row) => row.status === "pending")
      .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
      .slice(0, 5)
      .map((row) => toVerificationView(row, database));

    const emergencyRequests = database.helpRequests
      .filter((row) => row.urgency === "emergency" && effectiveStatus(row) === "open")
      .sort((a, b) => a.requiredBy.localeCompare(b.requiredBy))
      .slice(0, 5)
      .map((row) => ({
        id: row.id,
        reference: row.reference,
        city: row.city,
        hospitalName: row.hospitalName,
        bloodGroup: row.bloodGroup,
        unitsRequired: row.unitsRequired,
        requiredBy: row.requiredBy,
        createdAt: row.createdAt,
        requesterName: database.users.find((user) => user.id === row.requesterId)?.name ?? "Unknown",
      }));

    const auditTrail = database.auditLog.slice(0, 8).map((row) => ({
      id: row.id,
      action: row.action,
      targetType: row.targetType,
      note: row.note,
      at: row.createdAt,
      actorName: database.users.find((user) => user.id === row.actorId)?.name ?? "System",
    }));

    const { demoLoginEnabled } = await import("./auth");
    const { isGoogleConfigured } = await import("../auth/google");
    const stats = buildStats(database);

    return {
      stats,
      recentReports,
      pendingVerifications,
      emergencyRequests,
      auditTrail,
      environment: {
        demoLoginEnabled: demoLoginEnabled(),
        demoRecords: stats.demoRecords,
        realRecords: stats.realRecords,
        googleConfigured: isGoogleConfigured(),
      },
    };
  },
);

/* ------------------------------------------------------------------ */
/* Users                                                              */
/* ------------------------------------------------------------------ */

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isAdmin: boolean;
  isDemo: boolean;
  accountStatus: "active" | "suspended";
  suspendedReason: string | null;
  verificationStatus: VerificationStatus;
  organizationName: string | null;
  city: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  requests: number;
  responses: number;
  reports: number;
};

export const listAdminUsers = createServerFn({ method: "GET" })
  .validator(
    z.object({
      q: z.string().trim().max(80).optional(),
      role: z.enum(USER_ROLES).optional(),
      status: z.enum(["active", "suspended"]).optional(),
      verification: z.enum(VERIFICATION_STATUSES).optional(),
      demo: z.enum(["all", "demo", "real"]).optional(),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const database = await getDb();

    const items: AdminUserRow[] = database.users
      .filter((user) => {
        if (data.role && user.role !== data.role) return false;
        if (data.status && user.accountStatus !== data.status) return false;
        if (data.demo === "demo" && !user.isDemo) return false;
        if (data.demo === "real" && user.isDemo) return false;
        if (data.q) {
          const needle = data.q.toLowerCase();
          const profile = database.profiles.find((row) => row.userId === user.id);
          const haystack = `${user.name} ${user.email} ${profile?.city ?? ""}`.toLowerCase();
          if (!haystack.includes(needle)) return false;
        }
        return true;
      })
      .map((user) => {
        const verification = database.verifications
          .filter((row) => row.userId === user.id)
          .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1))[0];
        const profile = database.profiles.find((row) => row.userId === user.id);
        if (data.verification && (verification?.status ?? "unverified") !== data.verification) {
          return null;
        }
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isAdmin: user.isAdmin,
          isDemo: user.isDemo,
          accountStatus: user.accountStatus,
          suspendedReason: user.suspendedReason,
          verificationStatus: verification?.status ?? ("unverified" as VerificationStatus),
          organizationName: verification?.organizationName ?? null,
          city: profile?.city ?? null,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
          requests: database.helpRequests.filter((row) => row.requesterId === user.id).length,
          responses: database.donorResponses.filter((row) => row.donorId === user.id).length,
          reports: database.reports.filter(
            (row) => row.targetType === "user" && row.targetId === user.id,
          ).length,
        };
      })
      .filter((row): row is AdminUserRow => row !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return { items, total: items.length };
  });

export const adminUserAction = createServerFn({ method: "POST" })
  .validator(
    z.object({
      userId: z.string().trim().min(1),
      action: z.enum([
        "suspend",
        "reactivate",
        "grant_admin",
        "revoke_admin",
        "clear_verification",
      ]),
      note: z.string().trim().max(300).optional(),
    }),
  )
  .handler(async ({ data }) =>
    action(async () => {
      const admin = await requireAdmin();
      const timestamp = nowIso();

      await mutate((db) => {
        const user = db.users.find((row) => row.id === data.userId);
        if (!user) throw notFound("Member not found.");
        if (user.id === admin.id && (data.action === "suspend" || data.action === "revoke_admin")) {
          throw invalid("You cannot suspend or downgrade your own administrator account.");
        }

        switch (data.action) {
          case "suspend": {
            user.accountStatus = "suspended";
            user.suspendedReason = data.note ?? "Suspended by a moderator pending review.";
            db.sessions = db.sessions.filter((row) => row.userId !== user.id);
            createNotification(db, {
              userId: user.id,
              type: "system",
              title: "Account suspended",
              body: user.suspendedReason,
              link: "/settings",
            });
            break;
          }
          case "reactivate": {
            user.accountStatus = "active";
            user.suspendedReason = null;
            createNotification(db, {
              userId: user.id,
              type: "system",
              title: "Account reactivated",
              body: "Your account is active again. Please keep requests free of payments and private information.",
              link: "/dashboard",
            });
            break;
          }
          case "grant_admin": {
            user.isAdmin = true;
            break;
          }
          case "revoke_admin": {
            user.isAdmin = false;
            break;
          }
          case "clear_verification": {
            db.verifications = db.verifications.filter((row) => row.userId !== user.id);
            createNotification(db, {
              userId: user.id,
              type: "verification_update",
              title: "Verification reset",
              body: "A moderator reset your verification status. You can submit verification again.",
              link: "/verify",
            });
            break;
          }
        }

        user.updatedAt = timestamp;
        recordAudit(db, {
          actorId: admin.id,
          action: `user.${data.action}`,
          targetType: "user",
          targetId: user.id,
          note: data.note ?? null,
        });
      });

      return { updated: true };
    }),
  );

/* ------------------------------------------------------------------ */
/* Requests                                                           */
/* ------------------------------------------------------------------ */

export type AdminRequestRow = {
  id: string;
  reference: string;
  requesterName: string;
  requesterEmail: string;
  requesterIsDemo: boolean;
  requestType: RequestType;
  bloodGroup: string | null;
  unitsRequired: number;
  unitsFulfilled: number;
  hospitalName: string;
  city: string;
  urgency: Urgency;
  status: RequestStatus;
  requiredBy: string;
  createdAt: string;
  responseCount: number;
  reportCount: number;
  isDemo: boolean;
  moderationNote: string | null;
};

export const listAdminRequests = createServerFn({ method: "GET" })
  .validator(
    z.object({
      q: z.string().trim().max(80).optional(),
      status: z.string().trim().optional(),
      urgency: z.enum(["normal", "urgent", "emergency"]).optional(),
      type: z.enum(["blood", "platelets", "medical_assistance"]).optional(),
      demo: z.enum(["all", "demo", "real"]).optional(),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const database = await getDb();

    const items: AdminRequestRow[] = database.helpRequests
      .map((row) => ({ ...row, status: effectiveStatus(row) }))
      .filter((row) => {
        if (data.status && row.status !== data.status) return false;
        if (data.urgency && row.urgency !== data.urgency) return false;
        if (data.type && row.requestType !== data.type) return false;
        if (data.demo === "demo" && !row.isDemo) return false;
        if (data.demo === "real" && row.isDemo) return false;
        if (data.q) {
          const needle = data.q.toLowerCase();
          const requester = database.users.find((user) => user.id === row.requesterId);
          const haystack = `${row.reference} ${row.hospitalName} ${row.city} ${row.area ?? ""} ${
            requester?.name ?? ""
          } ${requester?.email ?? ""}`.toLowerCase();
          if (!haystack.includes(needle)) return false;
        }
        return true;
      })
      .map((row) => {
        const requester = database.users.find((user) => user.id === row.requesterId);
        return {
          id: row.id,
          reference: row.reference,
          requesterName: requester?.name ?? "Deleted member",
          requesterEmail: requester?.email ?? "—",
          requesterIsDemo: Boolean(requester?.isDemo),
          requestType: row.requestType,
          bloodGroup: row.bloodGroup,
          unitsRequired: row.unitsRequired,
          unitsFulfilled: row.unitsFulfilled,
          hospitalName: row.hospitalName,
          city: row.city,
          urgency: row.urgency,
          status: row.status,
          requiredBy: row.requiredBy,
          createdAt: row.createdAt,
          responseCount: database.donorResponses.filter((item) => item.requestId === row.id).length,
          reportCount: database.reports.filter(
            (item) => item.targetType === "request" && item.targetId === row.id,
          ).length,
          isDemo: row.isDemo,
          moderationNote: row.moderationNote,
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return { items, total: items.length };
  });

export const adminRequestAction = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().trim().min(1),
      action: z.enum(["resolve_request", "mark_in_progress", "remove_request", "restore_request"]),
      note: z.string().trim().max(300).optional(),
    }),
  )
  .handler(async ({ data }) =>
    action(async () => {
      const admin = await requireAdmin();
      const timestamp = nowIso();

      await mutate((db) => {
        sweepExpiredRequests(db);
        const request = db.helpRequests.find((row) => row.id === data.id);
        if (!request) throw notFound("Request not found.");

        switch (data.action) {
          case "resolve_request": {
            request.status = "fulfilled";
            request.unitsFulfilled = request.unitsRequired;
            request.resolvedAt = timestamp;
            request.updatedAt = timestamp;
            createNotification(db, {
              userId: request.requesterId,
              type: "request_update",
              title: `${request.reference} marked as fulfilled`,
              body: data.note ?? "A moderator marked this request as resolved.",
              link: `/requests/${request.id}`,
            });
            break;
          }
          case "mark_in_progress": {
            request.status = "in_progress";
            request.updatedAt = timestamp;
            break;
          }
          case "remove_request": {
            request.status = "removed";
            request.removedBy = admin.id;
            request.moderationNote =
              data.note ?? "Removed by moderators for violating platform policy.";
            request.updatedAt = timestamp;
            for (const responder of db.donorResponses.filter(
              (row) => row.requestId === request.id && row.status === "pending",
            )) {
              responder.status = "withdrawn";
              responder.withdrawnAt = timestamp;
              createNotification(db, {
                userId: responder.donorId,
                type: "request_cancelled",
                title: `Request ${request.reference} was removed`,
                body: "Moderators removed this request. No further action is needed from you.",
                link: "/find-help",
              });
            }
            createNotification(db, {
              userId: request.requesterId,
              type: "system",
              title: `Request ${request.reference} removed`,
              body: request.moderationNote,
              link: "/my-requests",
            });
            break;
          }
          case "restore_request": {
            if (request.status !== "removed") throw invalid("This request is not removed.");
            request.status = "open";
            request.removedBy = null;
            request.updatedAt = timestamp;
            createNotification(db, {
              userId: request.requesterId,
              type: "request_update",
              title: `Request ${request.reference} restored`,
              body: "Moderators reviewed your request and restored it. Please keep contact details inside the platform.",
              link: `/requests/${request.id}`,
            });
            break;
          }
        }

        recordAudit(db, {
          actorId: admin.id,
          action: `request.${data.action}`,
          targetType: "request",
          targetId: request.id,
          note: data.note ?? null,
        });
      });

      return { updated: true };
    }),
  );

/* ------------------------------------------------------------------ */
/* Reports & verifications                                            */
/* ------------------------------------------------------------------ */

export const listAdminReports = createServerFn({ method: "GET" })
  .validator(z.object({ status: z.enum(["all", "open", "reviewing", "resolved", "dismissed"]).optional() }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const database = await getDb();
    const items = database.reports
      .filter((row) => (data?.status && data.status !== "all" ? row.status === data.status : true))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((row) => toReportView(row, database));
    return { items, total: items.length };
  });

export const adminReportAction = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().trim().min(1),
      action: z.enum(["review", "resolve", "dismiss"]),
      note: z.string().trim().max(300).optional(),
    }),
  )
  .handler(async ({ data }) =>
    action(async () => {
      const admin = await requireAdmin();
      const timestamp = nowIso();

      await mutate((db) => {
        const report = db.reports.find((row) => row.id === data.id);
        if (!report) throw notFound("Report not found.");
        report.status =
          data.action === "review" ? "reviewing" : data.action === "resolve" ? "resolved" : "dismissed";
        report.resolutionNote = data.note ?? null;
        report.handledBy = admin.id;
        report.updatedAt = timestamp;

        if (report.status === "resolved") {
          createNotification(db, {
            userId: report.reporterId,
            type: "system",
            title: "Your report was actioned",
            body: data.note ?? "Thank you for reporting — our team has acted on it.",
            link: "/settings",
          });
        } else if (report.status === "dismissed") {
          createNotification(db, {
            userId: report.reporterId,
            type: "system",
            title: "Your report was reviewed",
            body:
              data.note ??
              "Our team reviewed this report and found no policy violation. Thank you for flagging it.",
            link: "/settings",
          });
        }

        recordAudit(db, {
          actorId: admin.id,
          action: `report.${data.action}`,
          targetType: "report",
          targetId: report.id,
          note: data.note ?? null,
        });
      });

      return { updated: true };
    }),
  );

export const listAdminVerifications = createServerFn({ method: "GET" })
  .validator(z.object({ status: z.enum(VERIFICATION_STATUSES).optional() }).optional())
  .handler(async ({ data }) => {
    await requireAdmin();
    const database = await getDb();
    const items = database.verifications
      .filter((row) => (data?.status ? row.status === data.status : true))
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
      .map((row) => toVerificationView(row, database));
    return { items, total: items.length };
  });

export const adminVerificationAction = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().trim().min(1),
      action: z.enum(["approve", "reject"]),
      note: z.string().trim().max(300).optional(),
    }),
  )
  .handler(async ({ data }) =>
    action(async () => {
      const admin = await requireAdmin();
      const timestamp = nowIso();

      await mutate((db) => {
        const record = db.verifications.find((row) => row.id === data.id);
        if (!record) throw notFound("Verification request not found.");
        record.status = data.action === "approve" ? "verified" : "rejected";
        record.reviewNote = data.note ?? null;
        record.reviewedBy = admin.id;
        record.reviewedAt = timestamp;

        createNotification(db, {
          userId: record.userId,
          type: "verification_update",
          title: data.action === "approve" ? "You are verified" : "Verification could not be approved",
          body:
            data.action === "approve"
              ? "Your account now shows a verified badge. Verified information is separated from self-reported details across the platform."
              : (data.note ??
                "We could not verify your details with the information provided. You can submit again with more detail."),
          link: "/verify",
        });

        recordAudit(db, {
          actorId: admin.id,
          action: `verification.${data.action}`,
          targetType: "verification",
          targetId: record.id,
          note: data.note ?? null,
        });
      });

      return { updated: true };
    }),
  );

export const adminResetDemoData = createServerFn({ method: "POST" }).handler(async () =>
  action(async () => {
    const admin = await requireAdmin();
    const { demoLoginEnabled } = await import("./auth");
    if (!demoLoginEnabled()) {
      throw invalid("Demo data can only be reset in demo environments.");
    }

    const { seedDemoData } = await import("../db/seed");

    await mutate((db) => {
      const isDemoUser = new Set(db.users.filter((row) => row.isDemo).map((row) => row.id));
      db.users = db.users.filter((row) => !row.isDemo);
      db.profiles = db.profiles.filter((row) => !isDemoUser.has(row.userId));
      db.donorProfiles = db.donorProfiles.filter((row) => !isDemoUser.has(row.userId));
      db.helpRequests = db.helpRequests.filter((row) => !row.isDemo);
      db.donorResponses = db.donorResponses.filter(
        (row) => !isDemoUser.has(row.donorId) && !isDemoUser.has(row.requestId),
      );
      db.notifications = db.notifications.filter((row) => !isDemoUser.has(row.userId));
      db.reports = db.reports.filter((row) => !isDemoUser.has(row.reporterId));
      db.verifications = db.verifications.filter((row) => !row.isDemo);
      db.blocks = db.blocks.filter(
        (row) => !isDemoUser.has(row.userId) && !isDemoUser.has(row.blockedUserId),
      );
      // Demo account ids are deterministic, so existing demo sessions stay valid.
      db.seeded = false;
    });

    await mutate(async (db) => {
      await seedDemoData(db);
    });

    return { reset: true, note: `Demo dataset restored by ${admin.name} at ${relativeTime(nowIso())}.` };
  }));
