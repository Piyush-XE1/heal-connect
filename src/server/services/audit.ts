import type { Database } from "../db/types";
import { newId, nowIso } from "../db/store";

/** Every moderation action is recorded so admins can explain their decisions. */
export function recordAudit(
  database: Database,
  input: {
    actorId: string;
    action: string;
    targetType: "user" | "request" | "report" | "verification" | "system";
    targetId: string;
    note?: string | null;
  },
): void {
  database.auditLog.unshift({
    id: newId("aud"),
    actorId: input.actorId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    note: input.note ?? null,
    createdAt: nowIso(),
  });
  if (database.auditLog.length > 500) {
    database.auditLog = database.auditLog.slice(0, 500);
  }
}
