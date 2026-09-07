# System Notes — Auth, Routing, Onboarding Persistence, Dev Panel, Navigation Modes

Operational notes on the sign-in/session layer and the onboarding flow. NOT an
onboarding doc; this is the "why you did it that way" record for debugging and
future edits.

## How auth works

- `app/(auth)/sign-in.tsx` (single screen, per product decision) hosts
  `SignInScreen` from `src/features/auth/components/SignInScreen.tsx`.
- A mock SMS: the 6-digit code is generated locally via
  `generateVerificationCode()` (`expo-crypto` `randomUUID()` → numeric chars),
  persisted to SQLite, and shown in the **Dev Panel** (REQUIREMENTS §3.1 / §4.5)
  — see "Dev Panel & simulated network" below. Submitting the wrong code shows
  an inline error in `critical` red. Correct code → `signIn()` → session token
  persisted → `AuthProvider.status` → `signedIn` → the root gate redirects to
  `app/(protected)/`.

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
- `app/(protected)/_layout.tsx` is the post-auth gate. Order of guards:
  `onboarding (incomplete)`, then **either** `(member)` (mode `member`) **or**
  `(voucher)` (mode `voucher`) — never both. The two trees are genuinely
  separate route groups (REQUIREMENTS §2.2/§3.7): member = 4 tabs (Discover /
  Browse / Chat / Settings) + pushed `profile/[userId]`; voucher = 3 tabs
  (Browse / Shortlist / Settings) + pushed `thread/[vouchId]`. Because the
  `(voucher)` group physically has no chat route, a voucher cannot reach a 1:1
  chat at the navigation level — that is the structural half of the guarantee.
- The swap lives in Settings (`src/features/settings/components/SettingsScreen.tsx`,
  used by BOTH trees — flipping mode back to member is how a voucher exits).
  `mode` is app state (`src/store/mode/AppModeProvider.tsx`), **not persisted**:
  relaunch always starts in member mode.
- `(protected)` is a route group, so its screens sit at the root of the URL
  space: `/` (member tabs home), `/browse`, `/settings`, `/shortlist`,
  `/chat/[matchId]`, `/profile/[userId]`, `/thread/[vouchId]`, `/onboarding`.
  Both trees share `/browse` and `/settings` URLs — only the active tree is
  mounted, so resolution follows the current mode.
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
- `AppModeContext` (`src/store/mode/AppModeProvider.tsx`) + `useAppMode()`:
  `mode: 'member' | 'voucher'`, `setMode(next)`. In-memory only (no layer for
  persistence that isn't relational, and the spec doesn't demand it) — the
  member tree's own UI state comes from SQLite and therefore survives a switch,
  which is what §2.2 actually requires.

## Mode enforcement gap (known, owned)

- Per REQUIREMENTS §3.7 the chat **service layer** must also refuse 1:1
  chat-send/read for a voucher-mode caller, independent of the missing route.
  No chat service exists yet (outbox/chat milestone); this is a documented gap,
  not a code TODO — it will land with the send/read actions and be cross-checked
  against the voucher tree during the interruption-safety pass.

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

## Dev Panel & simulated network

- **Entry point:** a persistent "DEV" floating action button
  (`src/devpanel/DevPanelFab.tsx`) mounted in `app/_layout.tsx` outside the
  auth `Stack.Protected`s — it overlays every screen (sign-in, onboarding,
  tabs) and pushes `/dev-panel`; it hides itself while the panel is open. No
  gesture/package needed; works on web too. The route is `app/dev-panel.tsx`
  (`Stack.Screen name="dev-panel"` with `presentation: "modal"`, declared
  outside the auth guards so it's reachable pre- and post-sign-in). UI lives in
  `src/devpanel/DevPanel.tsx`.
- **Verification code store:** `src/db/schema/verification-codes.ts` — a single
  row `id='current'` holding the code + `issuedAt` (ms). Read/write through
  `src/db/queries/verification.queries.ts`; the reactive façade is
  `src/store/verification/verification-code-store.ts` (plain module +
  `useSyncExternalStore`; `ensureCode()` hydrates/gen-creates once,
  `resendVerificationCode()` persists then notifies, `verify()` strips
  non-digits, requires 6, exact-matches). Consumers never touch the DB.
- **Cooldown is global by construction:** `useVerificationCode`
  (`src/hooks/use-verification-code.ts`, `RESEND_COOLDOWN_SECONDS = 30`)
  derives the remaining seconds from `issuedAt`, so a resend in the Dev Panel
  resets the sign-in button's countdown and vice versa.
- **Mock network (`src/mocks/`):** `devPanelControls.ts` is the live knob store
  (module + `useSyncExternalStore`; defaults latency 300–1200ms,
  `writeFailureRate` 0.2, `duplicateRate` 0.05, `outOfOrderWindow` 2, offline
  off). `server.ts` is the single "request" entry the future outbox drain calls:
  throws `NetworkOfflineError` / `WriteFailureError` per the knobs, else resolves
  after random latency. `realtimeChannel.ts` emits the `RealtimeEvent`
  discriminated union, honoring the duplicate rate + out-of-order window;
  `src/realtime/dedupe.ts` is the consumer-side seen-id reducer. The Dev Panel's
  "Force a match / duplicate" buttons drive both, and the event feed line shows
  received vs applied (the visible proof dedupe works).
- **Scope note:** every knob is live. Seed data (e.g. the 60-profile catalog)
  is NOT in the DB — it is mocks-milestone seed (deterministic, asserted by a
  unit test); `ensureMigrated()` only applies schema.
- Web bundling still works (wasm assetExts + no-dependency mocks); verified via
  `npx expo export --platform web`.

## Discover deck, outbox, and undoing swipes

- **Deck (§3.3):** `app/(protected)/(member)/(tabs)/index.tsx` renders
  `src/features/discover/components/DiscoverScreen.tsx` (not a placeholder
  anymore). Hand-written gesture/spring deck in `CardDeck.tsx` — no third-party
  swipe lib, no `setState` per frame; all motion is Reanimated shared values.
  Right=like, left=skip, up=ask-voucher, small drag springs back; "fling" lowers
  the distance bar. `undo` restores exactly one card. Explicit empty state
  (`DeckEmptyState`) with "Browse again" and an undo of the last card. Toolbar
  buttons are the a11y alternative to gestures (icons: `heart.fill`,
  `xmark`, `arrow.up`, `arrow.uturn.backward`, `verified-user` in
  `components/ui/icon-symbol.tsx`). RTL mirrors horizontal swipe semantics via
  `I18nManager.isRTL` in both `model/deck.ts` and the render exit.
  `git grep DECK_VISIBLE_SLOTS` → 3 under-cards.
- **Catalog (§4.4):** `src/mocks/seed/profiles.ts` deterministically seeds 60
  profiles with ≥3 photos each (asserted in `profiles.test.ts`). It is seed, not
  DB; `useDiscoverDeck` builds `profilesById` from it and prefetches the next 4
  `Image.prefetch` links.
- **Outbox (§4.1) — now live:** every swipe/undo writes `outbox_items` +
  `swipes` mirror atomically (`src/outbox/actions.ts`); the drain
  (`src/outbox/drain.ts`, single-flight, FIFO `queued→sending` claim) replays
  through `mocks/server.ts` `request()` with exponential backoff (`backoff.ts`:
  1s base, 30s cap, ±20% jitter, 5 attempts → `failed`). The walker triggers on
  enqueue, AppState foreground, and offline→online. Offline just pauses (Pill:
  "Offline — swipes queued"). Dev Panel's **Dump outbox contents** now lists
  items + statuses (Refresh), and **Wipe local data** clears outbox + swipes via
  a confirm Alert. Design details + conflict rule + measured §4.6 numbers live
  in `docs/TECHNICAL.md`.
- **Perf evidence channel:** `src/features/discover/performance.tsx` overlays a
  Reanimated `PerformanceMonitor` (JS/UI FPS) on the deck in `__DEV__` and logs
  `[discover.perf] re-renders between swipes` — the numbers go into
  `TECHNICAL.md`'s measured table. Archive/copy them any time you re-run the
  deck.