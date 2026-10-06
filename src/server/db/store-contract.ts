import type { Database } from "./types";

/** Surface every storage driver implements. `src/server/api/*` only sees this. */
export type StoreDriver = {
  getDb(): Promise<Database>;
  mutate<T>(fn: (database: Database) => T | Promise<T>): Promise<T>;
  snapshot(): Promise<Database>;
  __resetStoreForTests(): void;
};
