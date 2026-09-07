import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";

import * as profileSchema from "@/src/db/schema/profiles";
import * as outboxSchema from "@/src/db/schema/outbox";
import * as swipesSchema from "@/src/db/schema/swipes";

/**
 * Single drizzle instance over the app's SQLite file. Opened at module scope
 * like any Expo app: on native/web-runtime this is a real database; during
 * static web export (Node SSR) expo-sqlite swaps in a no-op server module,
 * so nothing here crashes rendering.
 */
export const expoDb = openDatabaseSync("vouch.db", { enableChangeListener: true });

export const schema = { ...profileSchema, ...outboxSchema, ...swipesSchema };

export const db = drizzle(expoDb, { schema });

/** The transaction client handed to a `db.transaction` callback. */
export type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Any client capable of running a query: the shared db or a transaction scope. */
export type DbClient = Db | DbTx;

export type Db = typeof db;