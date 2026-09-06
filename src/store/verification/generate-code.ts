import * as Crypto from 'expo-crypto';

/**
 * Random 6-digit verification code, derived from a UUID so it uses a proper
 * CSPRNG rather than Math.random. Stands in for the SMS that never actually
 * gets sent (REQUIREMENTS.md §3.1) — the Dev Panel will expose this later.
 */
export function generateVerificationCode(): string {
  const digits = Crypto.randomUUID().replace(/[^0-9]/g, '');
  return digits.slice(0, 6).padEnd(6, '0');
}