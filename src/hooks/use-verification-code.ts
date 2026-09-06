import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import {
  ensureCode,
  getSnapshot,
  resendVerificationCode,
  subscribe,
} from "@/src/store/verification/verification-code-store";

export const RESEND_COOLDOWN_SECONDS = 30;

/**
 * Live verification-code state for any screen: the current code, when it was
 * issued, and the remaining resend cooldown derived from `issuedAt` (so a
 * resend from the Dev Panel resets the sign-in cooldown and vice versa).
 * Triggers the one-time hydration (which generates + persists a code on
 * first run) on mount.
 */
export function useVerificationCode() {
  const { code, issuedAt } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    void ensureCode();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const issuedAtMs = issuedAt?.getTime() ?? 0;
  const cooldownEndsAt = issuedAtMs + RESEND_COOLDOWN_SECONDS * 1000;
  const cooldownRemaining = Math.max(0, Math.ceil((cooldownEndsAt - now) / 1000));

  const resend = useCallback(() => resendVerificationCode(), []);

  return {
    code,
    cooldownRemaining,
    isCooldown: cooldownRemaining > 0,
    resend,
  };
}