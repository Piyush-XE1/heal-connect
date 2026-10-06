import { deleteCookie, getCookie, getRequestHeader, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";

import type { SessionUser } from "@/lib/domain";

import { getDb, mutate, newId, nowIso } from "../db/store";
import { AppError, forbidden, unauthorized } from "../errors";
import { buildSessionUser } from "../services/views";
import { randomToken, sha256Hex } from "./crypto";

export const SESSION_COOKIE = "hc_session";
const SESSION_TTL_DAYS = 30;

function isSecureRequest(): boolean {
  const proto = getRequestHeader("x-forwarded-proto");
  if (proto) return proto.split(",")[0]?.trim() === "https";
  const host = getRequestHeader("host") ?? "";
  const origin = getRequestHeader("origin") ?? "";
  return origin.startsWith("https://") && !host.startsWith("localhost");
}

export async function createSession(userId: string): Promise<string> {
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86400000).toISOString();

  await mutate((database) => {
    database.sessions = database.sessions.filter((row) => row.expiresAt > createdAt);
    database.sessions.push({
      id: newId("sess"),
      tokenHash,
      userId,
      createdAt,
      expiresAt,
      lastSeenAt: createdAt,
    });
    const user = database.users.find((row) => row.id === userId);
    if (user) {
      user.lastLoginAt = createdAt;
      user.updatedAt = createdAt;
    }
  });

  setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(),
    path: "/",
    maxAge: SESSION_TTL_DAYS * 86400,
  });

  return token;
}

export async function destroySession(): Promise<void> {
  const token = getCookie(SESSION_COOKIE);
  if (token) {
    const tokenHash = await sha256Hex(token);
    await mutate((database) => {
      database.sessions = database.sessions.filter((row) => row.tokenHash !== tokenHash);
    });
  }
  deleteCookie(SESSION_COOKIE, { path: "/" });
}

/** Resolves the signed-in user, or null. Never throws. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = getCookie(SESSION_COOKIE);
  if (!token) return null;

  const tokenHash = await sha256Hex(token);
  const database = await getDb();
  const session = database.sessions.find((row) => row.tokenHash === tokenHash);
  if (!session) return null;
  if (session.expiresAt <= nowIso()) {
    await mutate((db) => {
      db.sessions = db.sessions.filter((row) => row.id !== session.id);
    });
    return null;
  }

  const user = database.users.find((row) => row.id === session.userId);
  if (!user) return null;
  return buildSessionUser(database, user.id);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  return user;
}

export async function requireActiveUser(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.accountStatus === "suspended") {
    throw forbidden("Your account is suspended. Contact support to resolve this.");
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isAdmin) throw forbidden("Administrator access is required for this action.");
  return user;
}

/** Zod helper for optional session-derived identifiers in server functions. */
export const idSchema = z.string().trim().min(1, "Missing identifier").max(120);

export { AppError };
