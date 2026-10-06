import type { StoreDriver } from "./store-contract";
import type { Database } from "./types";
import * as jsonDriver from "./drivers/json";
import * as postgresDriver from "./drivers/postgres";

/**
 * Storage facade. Picks the driver from configuration at call time:
 *
 * - Postgres (Lovable Cloud) when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are
 *   set (DATABASE_URL / SUPABASE_DB_URL also opt in).
 * - JSON file store otherwise — the zero-config default for local development.
 * - HEAL_CONNECT_STORE=json|postgres forces a driver.
 *
 * `src/server/api/*` only imports from this file, so nothing there changes.
 */

export function activeStore(): "postgres" | "json" {
  const forced = process.env["HEAL_CONNECT_STORE"];
  if (forced === "json" || forced === "postgres") return forced;
  // The edge runtime reaches Postgres through the service-role API, so those
  // two values are what actually enable the Postgres driver.
  const hasApi = Boolean(process.env["SUPABASE_URL"] && process.env["SUPABASE_SERVICE_ROLE_KEY"]);
  return hasApi ? "postgres" : "json";
}

function driver(): StoreDriver {
  return activeStore() === "postgres" ? postgresDriver : jsonDriver;
}

export function getDb(): Promise<Database> {
  return driver().getDb();
}

export function mutate<T>(fn: (database: Database) => T | Promise<T>): Promise<T> {
  return driver().mutate(fn);
}

export function snapshot(): Promise<Database> {
  return driver().snapshot();
}

export function newId(prefix: string): string {
  const random =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${random.replace(/-/g, "").slice(0, 22)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function isDemoEnvironment(): boolean {
  return process.env["NODE_ENV"] !== "production";
}

/** Test helper: resets the in-process cache of both drivers. */
export function __resetStoreForTests(): void {
  jsonDriver.__resetStoreForTests();
  postgresDriver.__resetStoreForTests();
}
