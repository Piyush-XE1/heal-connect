import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { NotificationView } from "@/lib/domain";

import { requireUser } from "../auth/session";
import { getDb, mutate, nowIso } from "../db/store";
import { notFound } from "../errors";
import { markAllNotificationsRead } from "../services/notifications";
import { toNotificationView } from "../services/views";
import { action } from "./result";

export const listNotifications = createServerFn({ method: "GET" })
  .validator(
    z
      .object({
        limit: z.coerce.number().min(5).max(100).optional(),
        unreadOnly: z.boolean().optional(),
      })
      .optional(),
  )
  .handler(async ({ data }) => {
    const session = await requireUser();
    const database = await getDb();
    const rows = database.notifications
      .filter((row) => row.userId === session.id)
      .filter((row) => (data?.unreadOnly ? !row.readAt : true))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const items: NotificationView[] = rows
      .slice(0, data?.limit ?? 50)
      .map(toNotificationView);

    return {
      items,
      unread: rows.filter((row) => !row.readAt).length,
      total: rows.length,
      // Push notifications are not enabled in the MVP; the client polls this
      // endpoint and the same payload shape is reused by a future web-push
      // service worker subscription (`src/server/api/push.ts`).
      pushEnabled: false,
    };
  });

export const fetchUnreadCount = createServerFn({ method: "GET" }).handler(async () => {
  const session = await requireUser();
  const database = await getDb();
  return {
    unread: database.notifications.filter((row) => row.userId === session.id && !row.readAt).length,
  };
});

export const markNotifications = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().trim().min(1).optional(),
      all: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) =>
    action(async () => {
      const session = await requireUser();
      const timestamp = nowIso();

      const changed = await mutate((db) => {
        if (data.all) {
          return markAllNotificationsRead(db, session.id);
        }
        if (!data.id) throw notFound("Nothing to update.");
        const row = db.notifications.find((item) => item.id === data.id && item.userId === session.id);
        if (!row) throw notFound("Notification not found.");
        if (!row.readAt) {
          row.readAt = timestamp;
          return 1;
        }
        return 0;
      });

      return { changed };
    }),
  );
