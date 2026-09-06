import { migrate } from "drizzle-orm/expo-sqlite/migrator";

import migrations from "./migrations/migrations";
import { db } from "@/src/db/client";

let migrationPromise: Promise<void> | null = null;

/**
 * Applies pending committed migrations exactly once per process. Safe to call
 * from anywhere (auth restore, feature hooks) — concurrent callers share the
 * same promise. A failed run resets the cache so the next call retries.
 */
export function ensureMigrated(): Promise<void> {
  if (migrationPromise === null) {
    migrationPromise = migrate(db, migrations).catch((error) => {
      migrationPromise = null;
      throw error;
    });
  }
  return migrationPromise;
}