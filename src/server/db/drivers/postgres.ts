import type { SupabaseClient } from "@supabase/supabase-js";

import { EMPTY_DATABASE, type Database } from "../types";

/**
 * Postgres driver (Lovable Cloud).
 *
 * The app runs on an edge runtime without raw TCP sockets, so it talks to
 * Postgres through the service-role Data API. Every mutate() is sent as one
 * change set to the `heal_connect_apply` SQL function, which runs inside a
 * single transaction: either every changed row is written or none is.
 *
 * - Only rows that actually changed are upserted; removed rows are deleted.
 * - If the mutation function throws, nothing is sent and the in-memory copy is
 *   discarded. If the SQL write fails, the transaction rolls back and the cache
 *   is dropped so the next read reloads the true state.
 */

type TableKey = Exclude<keyof Database, "version" | "seeded" | "counters">;

const TABLES: { key: TableKey; table: string; pk: string }[] = [
  { key: "users", table: "users", pk: "id" },
  { key: "profiles", table: "profiles", pk: "userId" },
  { key: "donorProfiles", table: "donor_profiles", pk: "userId" },
  { key: "helpRequests", table: "help_requests", pk: "id" },
  { key: "donorResponses", table: "donor_responses", pk: "id" },
  { key: "notifications", table: "notifications", pk: "id" },
  { key: "reports", table: "reports", pk: "id" },
  { key: "verifications", table: "verifications", pk: "id" },
  { key: "blocks", table: "blocks", pk: "id" },
  { key: "sessions", table: "sessions", pk: "id" },
  { key: "auditLog", table: "audit_log", pk: "id" },
];

const SCHEMA_VERSION = 1;
const CACHE_TTL_MS = 1500;
const PAGE = 1000;

let cache: { db: Database; at: number } | null = null;
let writeQueue: Promise<void> = Promise.resolve();
let seedPromise: Promise<void> | null = null;
/**
 * Sessions whose user was removed and is expected back with the same id (the
 * demo reset deletes then re-seeds deterministic demo accounts). Postgres
 * cascades would drop them, so they are re-attached once the user exists again.
 */
let pendingSessions: Database["sessions"] = [];

function reattachSessions(database: Database): void {
  const userIds = new Set(database.users.map((row) => row.id));
  const present = new Set(database.sessions.map((row) => row.id));
  const now = new Date().toISOString();
  pendingSessions = pendingSessions.filter((row) => row.expiresAt > now);
  const ready = pendingSessions.filter((row) => userIds.has(row.userId) && !present.has(row.id));
  database.sessions.push(...ready);
  pendingSessions = pendingSessions.filter((row) => !userIds.has(row.userId));
}

function holdOrphanSessions(database: Database): void {
  const userIds = new Set(database.users.map((row) => row.id));
  const orphans = database.sessions.filter((row) => !userIds.has(row.userId));
  if (!orphans.length) return;
  pendingSessions.push(...orphans);
  database.sessions = database.sessions.filter((row) => userIds.has(row.userId));
}

const toSnake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const toCamel = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

function mapKeys(row: Record<string, unknown>, fn: (k: string) => string) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[fn(k)] = v;
  return out;
}

async function client(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

async function readTable(sb: SupabaseClient, table: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from(table).select("*").range(from, from + PAGE - 1);
    if (error) throw new Error(`[heal-connect] failed to read ${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

async function load(): Promise<Database> {
  const sb = await client();
  const [meta, counters, ...tables] = await Promise.all([
    readTable(sb, "store_meta"),
    readTable(sb, "store_counters"),
    ...TABLES.map((t) => readTable(sb, t.table)),
  ]);
  const database: Database = structuredClone(EMPTY_DATABASE);
  database.version = SCHEMA_VERSION;
  database.seeded = meta.some((row) => row["key"] === "seeded" && row["value"] === true);
  for (const row of counters) {
    (database.counters as Record<string, number>)[String(row["key"])] = Number(row["value"]);
  }
  TABLES.forEach((t, i) => {
    (database[t.key] as unknown[]) = (tables[i] ?? []).map((row) => mapKeys(row, toCamel));
  });
  return database;
}

type ChangeSet = {
  upserts: Record<string, Record<string, unknown>[]>;
  deletes: Record<string, string[]>;
};

function diff(before: Database | null, after: Database): ChangeSet {
  const changes: ChangeSet = { upserts: {}, deletes: {} };
  for (const t of TABLES) {
    const prev = new Map<string, string>();
    for (const row of (before?.[t.key] ?? []) as Record<string, unknown>[]) {
      prev.set(String(row[t.pk]), JSON.stringify(row));
    }
    const seen = new Set<string>();
    const upserts: Record<string, unknown>[] = [];
    for (const row of after[t.key] as Record<string, unknown>[]) {
      const id = String(row[t.pk]);
      seen.add(id);
      if (prev.get(id) !== JSON.stringify(row)) upserts.push(mapKeys(row, toSnake));
    }
    const deletes = [...prev.keys()].filter((id) => !seen.has(id));
    if (upserts.length) changes.upserts[t.table] = upserts;
    if (deletes.length) changes.deletes[t.table] = deletes;
  }
  const counterRows = Object.entries(after.counters)
    .filter(([k, v]) => (before?.counters as Record<string, number> | undefined)?.[k] !== v)
    .map(([key, value]) => ({ key, value }));
  if (counterRows.length) changes.upserts["store_counters"] = counterRows;
  if (after.seeded && !before?.seeded) {
    changes.upserts["store_meta"] = [
      { key: "seeded", value: true },
      { key: "version", value: SCHEMA_VERSION },
    ];
  }
  return changes;
}

async function apply(changes: ChangeSet): Promise<void> {
  if (!Object.keys(changes.upserts).length && !Object.keys(changes.deletes).length) return;
  const sb = await client();
  const { error } = await sb.rpc("heal_connect_apply", { p_changes: changes });
  if (error) throw new Error(`[heal-connect] database write failed: ${error.message}`);
}

async function ensureSeeded(database: Database): Promise<Database> {
  if (database.seeded || process.env["HEAL_CONNECT_SEED_DEMO"] === "false") return database;
  if (database.users.length > 0) return database;
  if (!seedPromise) {
    seedPromise = (async () => {
      const fresh: Database = structuredClone(EMPTY_DATABASE);
      fresh.version = SCHEMA_VERSION;
      const { seedDemoData } = await import("../seed");
      await seedDemoData(fresh);
      fresh.seeded = true;
      await apply(diff(null, fresh));
    })().finally(() => {
      seedPromise = null;
    });
  }
  await seedPromise;
  return load();
}

async function fresh(): Promise<Database> {
  const database = await ensureSeeded(await load());
  cache = { db: database, at: Date.now() };
  return database;
}

export async function getDb(): Promise<Database> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.db;
  return fresh();
}

export async function mutate<T>(fn: (database: Database) => T | Promise<T>): Promise<T> {
  let result!: T;
  let failure: unknown;

  writeQueue = writeQueue.then(async () => {
    try {
      // Always mutate the latest committed state.
      const committed = await fresh();
      const before = structuredClone(committed);
      result = await fn(committed);
      reattachSessions(committed);
      holdOrphanSessions(committed);
      try {
        await apply(diff(before, committed));
        cache = { db: committed, at: Date.now() };
      } catch (error) {
        cache = null;
        throw error;
      }
    } catch (error) {
      // fn threw or SQL rolled back: drop the in-memory copy entirely.
      cache = null;
      failure = error;
    }
  });

  await writeQueue;
  if (failure) throw failure;
  return result;
}

export async function snapshot(): Promise<Database> {
  return structuredClone(await getDb());
}

export function __resetStoreForTests(): void {
  cache = null;
  writeQueue = Promise.resolve();
  seedPromise = null;
  pendingSessions = [];
}
