import { generateVerificationCode } from "./generate-code";

import { ensureMigrated } from "@/src/db/migrate";
import {
  getCurrentVerificationCode,
  saveCurrentVerificationCode,
} from "@/src/db/queries/verification.queries";

/**
 * Global, reactive single source of truth for the expected 6-digit sign-in
 * code (REQUIREMENTS §3.1). Persisted in SQLite so it survives an app kill,
 * and exposed through `useSyncExternalStore` so a resend anywhere — Dev Panel
 * or sign-in screen — updates every consumer at once.
 *
 * The snapshot is memoized: `getSnapshot()` returns the same reference until
 * the code changes, so subscribers only re-render on a real change.
 */
export type VerificationSnapshot = {
  code: string | null;
  issuedAt: Date | null;
};

export type VerificationResult =
  | { ok: true }
  | { ok: false; reason: "format" | "mismatch" };

const EMPTY_SNAPSHOT: VerificationSnapshot = { code: null, issuedAt: null };

let snapshot: VerificationSnapshot = EMPTY_SNAPSHOT;
let hydrationPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function setSnapshot(next: VerificationSnapshot): void {
  if (next.code === snapshot.code && next.issuedAt?.getTime() === snapshot.issuedAt?.getTime()) {
    return;
  }
  snapshot = next;
  emit();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): VerificationSnapshot {
  return snapshot;
}

async function persistGenerated(): Promise<void> {
  const code = generateVerificationCode();
  const issuedAt = new Date();
  await saveCurrentVerificationCode(code, issuedAt);
  setSnapshot({ code, issuedAt });
}

/**
 * Loads the durable code exactly once per process, generating one if none
 * exists yet (first run, or after a wipe). Safe to call from anywhere; the
 * promise is shared so concurrent callers hydrate together. On crash-prone
 * static-export SSR the SQLite call throws and we fall back to the default
 * snapshot without failing the render.
 */
export function ensureCode(): Promise<void> {
  if (hydrationPromise === null) {
    hydrationPromise = (async () => {
      try {
        await ensureMigrated();
        const current = await getCurrentVerificationCode();
        if (current) {
          setSnapshot({ code: current.code, issuedAt: current.issuedAt });
        } else {
          await persistGenerated();
        }
      } catch {
        // No-op database module during static export / SSR — snapshot stays
        // null and the sign-in screen renders its entry UI normally.
      }
    })();
  }
  return hydrationPromise;
}

/**
 * Generates a fresh code and persists it, notifying every subscriber (Dev
 * Panel readout included). 30s cooldown derives from the new `issuedAt`.
 */
export async function resendVerificationCode(): Promise<void> {
  try {
    await persistGenerated();
  } catch {
    // Persistence unavailable (SSR/no-op DB): still regenerate in memory so
    // the flow keeps working; the value is provisional.
    const code = generateVerificationCode();
    setSnapshot({ code, issuedAt: new Date() });
  }
}

export function verify(input: string): VerificationResult {
  const received = input.replace(/\D/g, "");
  if (received.length !== 6) {
    return { ok: false, reason: "format" };
  }
  return received === snapshot.code ? { ok: true } : { ok: false, reason: "mismatch" };
}