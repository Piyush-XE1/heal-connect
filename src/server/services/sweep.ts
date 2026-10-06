import type { RequestStatus } from "@/lib/domain";

import type { Database, HelpRequestRow } from "../db/types";

/**
 * Statuses are derived as well as stored: a request whose `requiredBy` date has
 * passed while still open is treated (and, on the next write, persisted) as
 * expired. This keeps listings honest without a cron job in the MVP.
 */
export function effectiveStatus(request: HelpRequestRow, now = new Date()): RequestStatus {
  if (request.status === "open" || request.status === "in_progress") {
    const required = new Date(`${request.requiredBy}T23:59:59`);
    if (!Number.isNaN(required.getTime()) && required.getTime() < now.getTime()) {
      return "expired";
    }
  }
  return request.status;
}

export function isOpenForResponses(request: HelpRequestRow): boolean {
  return effectiveStatus(request) === "open";
}

/** Persists expiry for records that are past their required date. */
export function sweepExpiredRequests(database: Database): number {
  const now = new Date().toISOString();
  let changed = 0;
  for (const request of database.helpRequests) {
    if (request.status !== "open" && request.status !== "in_progress") continue;
    if (effectiveStatus(request) === "expired") {
      request.status = "expired";
      request.updatedAt = now;
      changed += 1;
    }
  }
  return changed;
}

export function touchRequest(database: Database, requestId: string): void {
  const request = database.helpRequests.find((row) => row.id === requestId);
  if (request) request.updatedAt = new Date().toISOString();
}
