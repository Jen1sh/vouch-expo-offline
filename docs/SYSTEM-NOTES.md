# System Notes — Auth

Operational notes on the sign-in/session layer. NOT an onboarding doc; this is
the "why you did it that way" record for debugging and future edits.

## How auth works

- `app/(auth)/sign-in.tsx` (single screen, per product decision) hosts
  `SignInScreen` from `src/features/auth/components/SignInScreen.tsx`.
- A mock SMS: the 6-digit code is generated locally via
  `generateVerificationCode()` (`expo-crypto` `randomUUID()` → numeric chars).
  It is **shown on screen** ("Demo code: …") instead of being sent. The Dev
  Panel is the future home for this readout (REQUIREMENTS §3.1 / §4.5).
- Submitting the wrong code shows an inline error in `critical` red. Correct
  code → `signIn()` → session token persisted → `AuthProvider.status` →
  `signedIn` → the gate in `app/_layout.tsx` redirects to `(tabs)`.
- Resend regenerates the code and starts a 30s countdown
  (`src/hooks/use-countdown.ts`) with a visible "Resend code in 0:30" and a
  polite "Code re-sent" notice (live region).

## Session token

- Value: `randomUUID()` from `expo-crypto` (CSPRNG, RFC 4122). It is a
  stand-in for whatever a real backend would issue; there is no backend yet.
- Persisted under the storage key `STORAGE_KEYS.sessionToken`
  (`src/constants/storage-keys.ts` — the single source of truth for storage
  keys; don't hardcode the string elsewhere).
- Written/read/deleted via `src/store/auth/token-storage.ts`:
  - Native: `expo-secure-store` (Keychain / Keystore / tombstone).
  - Web: `token-storage.web.ts` — **SecureStore ships an empty web module**, so
    web falls back to `localStorage` with the same async API. The `.web.ts`
    suffix is resolved automatically by Metro/Expo; do not import the native
    file explicitly.

## State

- `AuthContext` (`src/features/auth/context/AuthProvider.tsx`) + `useAuth()`
  (`src/features/auth/context/use-auth.ts`). `status: 'unknown' | 'signedOut' |
  'signedIn'`. Token restore runs once on mount; `signOut()` deletes the token
  and flips to `signedOut` again.
- Redirect logic is centralized in ONE effect inside `AppNavigator`
  (`app/_layout.tsx`): `signedOut` + not in `(auth)` → `/(auth)/sign-in`;
  `signedIn` + in `(auth)` → `/(tabs)`. Everything else cascades from provider
  state — no screen navigates itself based on auth.

## Splash screen

- `SplashScreen.preventAutoHideAsync()` at module scope; the root layout hides
  it only when fonts are loaded AND auth status is resolved (`status !==
  'unknown'`), so app users never flash the signed-in UI.

## Data flow reminder

- `use-styles`/theming: all styles here use themed `StyleSheet.create`.
  `SignInScreen` styles are colocated in the component file (it's one file of
  styles); extract to `<Name>.styles.ts` only if a component grows past ~20
  style keys.
- Everything under `(auth)` is unprotected; everything else requires
  `signedIn`. If the gate misbehaves, start at the effect in `app/_layout.tsx`.