# System Notes — Auth, Routing, Onboarding Persistence

Operational notes on the sign-in/session layer and the onboarding flow. NOT an
onboarding doc; this is the "why you did it that way" record for debugging and
future edits.

## How auth works

- `app/(auth)/sign-in.tsx` (single screen, per product decision) hosts
  `SignInScreen` from `src/features/auth/components/SignInScreen.tsx`.
- A mock SMS: the 6-digit code is generated locally via
  `generateVerificationCode()` (`expo-crypto` `randomUUID()` → numeric chars).
  It is **shown on screen** ("Demo code: …") instead of being sent. The Dev
  Panel is the future home for this readout (REQUIREMENTS §3.1 / §4.5).
- Submitting the wrong code shows an inline error in `critical` red. Correct
  code → `signIn()` → session token persisted → `AuthProvider.status` →
  `signedIn` → the root gate redirects to `app/(protected)/`.

## Session token (SecureStore) vs profile (SQLite)

Two persistence layers with different jobs:

- **Session token** → `src/store/auth/token-storage.ts` — expo-secure-store on
  native (Keychain / Keystore / tombstone); `token-storage.web.ts` falls back to
  `localStorage` because SecureStore ships an empty web module. Key:
  `STORAGE_KEYS.sessionToken` (`src/constants/storage-keys.ts` is the single
  source of truth for storage keys). Cleared on sign-out.
- **Profile + onboarding draft** → expo-sqlite + drizzle, explicitly NOT
  SecureStore (relational data, not a secret). Tables in
  `src/db/schema/profiles.ts`: `profiles` (single row `id='me'`, onboarding
  fields as columns, no JSON blobs), `profile_photos`, `profile_preferences`.
  Migrations live in `src/db/migrations/` (generated via drizzle-kit, inlined
  by the `inline-import` babel plugin + `.sql` Metro extension). All reads
  route through `ensureMigrated()` (`src/db/migrate.ts`, single-promise cache).
- **Onboarding survives sign-out** by design: sign-out only clears the session
  token, never the `'me'` profile row. A finished user goes straight to the
  tabs on next sign-in; an in-progress one resumes on the last persisted step.

## Routing

- Root `app/_layout.tsx` uses `Stack.Protected`: `signedIn` → `(protected)`,
  `signedOut` → `(auth)`. There is no global `modal` screen anymore.
- `app/(protected)/_layout.tsx` is the post-auth gate: it reads
  `onboardingStatus` and renders **either** `onboarding` (incomplete) **or**
  `(tabs)` + `modal` (complete) — never both. The onboarding screens are only
  in the navigator while incomplete.
- `(protected)` is a route group, so its screens sit at the root of the URL
  space: `/` (tabs home), `/modal`, `/onboarding`.
- `unstable_settings.anchor` is `(protected)`. Typed routes regenerate only via
  `npx expo start` (not `expo export`).

## Onboarding

- Schema-driven: `src/features/onboarding/schema.ts` is the single
  `onboardingFieldDefs` catalog (4 steps: basics, photos, preferences, who can
  vouch for you). The screen renders strictly from it; adding a field means
  editing the config, never JSX. Step 4 has conditional fields —
  `familyInvolved === "yes"` reveals `waliContact` + `familyRelationship`
  (REQUIREMENTS §3.2). `buildStepZodSchema()` validates exactly the visible
  fields of the current step and `.passthrough()`s the rest.
- `useOnboardingForm` (RHF + `@hookform/resolvers` via a custom zod resolver):
  hydrates from `getMyProfile()`, keeps a debounced autosave (800ms) of the
  whole draft + step, adopts the persisted step on load, and persists the step
  immediately on change. The current step is state (drives re-renders); a ref
  mirrors it for the stable resolver.
- Photos are **local URIs only** (no upload yet). `PhotoPicker` requests
  library permission; a retryable denial shows inline help, and a permanent
  denial (`canAskAgain === false`) raises an Alert that deep-links to Settings
  via `Linking.openSettings()`.
- Photo/preference rows are replaced wholesale on every draft save inside one
  SQLite transaction, so a kill mid-save can't half-persist (the accepted
  "kill on step 3, resume with values" scenario is a hand test: pick some
  fields, force-quit, relaunch).
- Vouch / voucher / trust-graph tables are deliberately NOT created yet —
  deferred to the mocks milestone (data model + seed).

## State

- `AuthContext` (`src/features/auth/context/AuthProvider.tsx`) + `useAuth()`.
  `status: 'unknown' | 'signedOut' | 'signedIn'`; plus the onboarding gate:
  `onboardingStatus: 'unknown' | 'incomplete' | 'complete'`, `onboardingStep`
  (0 = not started), `setOnboardingStep(n)`, `markOnboardingComplete()`.
- When a signed-in user arrives, an effect runs `ensureMigrated()` →
  `getMyProfile()` to derive `onboardingStatus`. `markOnboardingComplete()`
  writes the DB row then flips state; the protected layout then swaps
  onboarding for the tabs.

## Splash screen

- `SplashScreen.preventAutoHideAsync()` at module scope. The root layout hides
  it once fonts are loaded AND auth is resolved; `(protected)/_layout.tsx`
  waits one more beat for `onboardingStatus`, so users never flash the tabs
  before the gate decides between onboarding and home.

## Data flow reminder

- All styles use themed `StyleSheet.create`. Screen-level styles are colocated;
  extract to `<Name>.styles.ts` only past ~20 keys. `FieldRenderer` renders the
  input chips using the secondary/amber tokens and `critical` for errors.
- Everything under `(auth)` is unprotected; everything else requires
  `signedIn`. If the gate misbehaves, start at the `Stack.Protected` guards in
  `app/_layout.tsx` and `app/(protected)/_layout.tsx`.