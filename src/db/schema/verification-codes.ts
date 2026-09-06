import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * The current, expected 6-digit sign-in code — the thing the "SMS" would
 * carry, shown in the Dev Panel instead of being sent (REQUIREMENTS §3.1).
 *
 * Single row keyed by the constant `CURRENT_CODE_ID`. Persisting it (rather
 * than keeping it in memory) makes the code survive an app kill mid-sign-in
 * and lets the 30s resend cooldown derive from `issuedAt`, so a resend from
 * either the Dev Panel or the sign-in screen changes it globally.
 */
export const verificationCodes = sqliteTable("verification_codes", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  issuedAt: integer("issued_at", { mode: "timestamp_ms" }).notNull(),
});

export type VerificationCodeRow = typeof verificationCodes.$inferSelect;