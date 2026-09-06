import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";

import * as schema from "@/src/db/schema/profiles";

/**
 * Single drizzle instance over the app's SQLite file. Opened at module scope
 * like any Expo app: on native/web-runtime this is a real database; during
 * static web export (Node SSR) expo-sqlite swaps in a no-op server module,
 * so nothing here crashes rendering.
 */
export const expoDb = openDatabaseSync("vouch.db", { enableChangeListener: true });

export const db = drizzle(expoDb, { schema });