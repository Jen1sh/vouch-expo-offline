import { eq } from "drizzle-orm";

import { db } from "@/src/db/client";
import { verificationCodes } from "@/src/db/schema/verification-codes";

/** The single active code lives in this row (REQUIREMENTS §3.1). */
export const CURRENT_CODE_ID = "current";

export type VerificationCode = {
  code: string;
  issuedAt: Date;
};

export async function getCurrentVerificationCode(): Promise<VerificationCode | null> {
  const [row] = await db
    .select()
    .from(verificationCodes)
    .where(eq(verificationCodes.id, CURRENT_CODE_ID))
    .limit(1);
  if (!row) {
    return null;
  }
  return { code: row.code, issuedAt: row.issuedAt };
}

export async function saveCurrentVerificationCode(code: string, issuedAt = new Date()): Promise<void> {
  await db
    .insert(verificationCodes)
    .values({ id: CURRENT_CODE_ID, code, issuedAt })
    .onConflictDoUpdate({
      target: verificationCodes.id,
      set: { code, issuedAt },
    });
}