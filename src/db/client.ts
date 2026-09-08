import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";

// Side-effect: on web, attach error listeners to the sqlite worker so a failed
// worker logs to the console instead of silently becoming "Sync operation
// timeout". No-op on native. Must run before the sync open below.
import "@/src/db/web/worker-diagnostics";

import * as catalogSchema from "@/src/db/schema/catalog";
import * as matchesSchema from "@/src/db/schema/matches";
import * as messagesSchema from "@/src/db/schema/messages";
import * as profileSchema from "@/src/db/schema/profiles";
import * as outboxSchema from "@/src/db/schema/outbox";
import * as swipesSchema from "@/src/db/schema/swipes";
import * as settingsSchema from "@/src/db/schema/settings";
import * as shortlistSchema from "@/src/db/schema/shortlist";

/**
 * Single drizzle instance over the app's SQLite file. Opened at module scope
 * like any Expo app: on native/web-runtime this is a real database; during
 * static web export (Node SSR) expo-sqlite swaps in a no-op server module,
 * so nothing here crashes rendering.
 */
export const expoDb = openDatabaseSync("vouch.db", { enableChangeListener: true });

export const schema = { ...catalogSchema, ...matchesSchema, ...messagesSchema, ...profileSchema, ...outboxSchema, ...swipesSchema, ...settingsSchema, ...shortlistSchema };

export const db = drizzle(expoDb, { schema });

/** The transaction client handed to a `db.transaction` callback. */
export type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Any client capable of running a query: the shared db or a transaction scope. */
export type DbClient = Db | DbTx;

export type Db = typeof db;