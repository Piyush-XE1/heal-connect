import { EMPTY_DATABASE, type Database } from "./types";

/**
 * Lightweight persistence adapter.
 *
 * - In Node (local dev, preview, self-hosted) the database is written to a JSON
 *   file so data survives restarts.
 * - In environments without a filesystem (edge workers) it degrades to an
 *   in-memory database, so the app keeps working.
 *
 * All access goes through `getDb()` / `mutate()`, which means replacing this file
 * with a Postgres or Supabase client is a contained change.
 */

const SCHEMA_VERSION = 1;
const DATA_DIR = process.env["HEAL_CONNECT_DATA_DIR"] ?? ".data";
const DATA_FILE = `${DATA_DIR}/heal-connect-db.json`;

type FsModule = typeof import("node:fs/promises");

let dbCache: Database | null = null;
let loadPromise: Promise<Database> | null = null;
let writeQueue: Promise<void> = Promise.resolve();
let fsModule: FsModule | null | undefined;

async function loadFs(): Promise<FsModule | null> {
  if (fsModule !== undefined) return fsModule;
  const isNode =
    typeof process !== "undefined" &&
    typeof process.versions !== "undefined" &&
    Boolean(process.versions.node);
  if (!isNode) {
    fsModule = null;
    return fsModule;
  }
  try {
    // Built at runtime so bundlers never try to resolve the Node builtin
    // statically. Must evaluate to "node:fs/promises".
    const specifier = ["node", "fs/promises"].join(":");
    fsModule = (await import(/* @vite-ignore */ specifier)) as FsModule;
  } catch {
    fsModule = null;
  }
  return fsModule;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function normalize(raw: Partial<Database>): Database {
  const merged: Database = {
    ...EMPTY_DATABASE,
    ...raw,
    counters: { ...EMPTY_DATABASE.counters, ...(raw.counters ?? {}) },
  };
  merged.version = SCHEMA_VERSION;
  return merged;
}

async function readFromDisk(): Promise<Database | null> {
  const fs = await loadFs();
  if (!fs) return null;
  try {
    const contents = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(contents) as Partial<Database>;
    return normalize(parsed);
  } catch {
    return null;
  }
}

async function writeToDisk(database: Database): Promise<void> {
  const fs = await loadFs();
  if (!fs) return;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tempFile = `${DATA_FILE}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(database, null, 2), "utf8");
    await fs.rename(tempFile, DATA_FILE);
  } catch (error) {
    console.error("[heal-connect] failed to persist database", error);
  }
}

async function bootstrap(): Promise<Database> {
  const fromDisk = await readFromDisk();
  if (fromDisk) {
    if (!fromDisk.seeded) {
      const { seedDemoData } = await import("./seed");
      await seedDemoData(fromDisk);
      await writeToDisk(fromDisk);
    }
    return fromDisk;
  }

  const fresh = normalize({});
  const { seedDemoData } = await import("./seed");
  await seedDemoData(fresh);
  await writeToDisk(fresh);
  return fresh;
}

export async function getDb(): Promise<Database> {
  if (dbCache) return dbCache;
  if (!loadPromise) {
    loadPromise = bootstrap().then((database) => {
      dbCache = database;
      return database;
    });
  }
  return loadPromise;
}

/**
 * Serialises every mutation behind a promise chain so concurrent requests can
 * never interleave partial writes.
 */
export async function mutate<T>(fn: (database: Database) => T | Promise<T>): Promise<T> {
  const database = await getDb();
  let result!: T;
  let failure: unknown;

  writeQueue = writeQueue.then(async () => {
    try {
      result = await fn(database);
      await writeToDisk(database);
    } catch (error) {
      failure = error;
    }
  });

  await writeQueue;
  if (failure) throw failure;
  return result;
}

/** Read-only snapshot (cloned) — safe for serialising into responses. */
export async function snapshot(): Promise<Database> {
  const database = await getDb();
  return clone(database);
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

/** Test helper: resets the in-process cache (used by unit tests). */
export function __resetStoreForTests(): void {
  dbCache = null;
  loadPromise = null;
  writeQueue = Promise.resolve();
}
