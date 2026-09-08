# System Notes — Auth, Routing, Onboarding Persistence, Dev Panel, Navigation Modes

Operational notes on the sign-in/session layer and the onboarding flow. NOT an
onboarding doc; this is the "why you did it that way" record for debugging and
future edits.

## How auth works

- `app/(auth)/sign-in.tsx` → `SignInScreen` (phone number only) and
  `app/(auth)/verify.tsx` → `VerifyCodeScreen` (6-digit code), both from
  `src/features/auth/components/`. Two-step flow per REQUIREMENTS §3.1: the phone
  screen pushes `/verify?phone=…`; the verify screen shows the phone and a
  "Change number" link that `router.back()`s — the sign-in screen stays mounted
  under the `(auth)` Stack, so the typed number is never lost.
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

## Mode enforcement (chat service guard)

- Per REQUIREMENTS §3.7 the chat **service layer** refuses 1:1 chat-send/
  delete for a voucher-mode caller, independent of the missing route: the
  (voucher) tree physically has no chat routes, and `src/outbox/messages.ts`
  `assertCanMessage()` throws unless `getModeSnapshot() === 'member'`.
- The snapshot (`src/store/mode/mode-snapshot.ts`) is set to `'member'` by
  default at module load and always kept in sync by `AppModeProvider.setMode()`
  (`setMode('voucher')` flips the snapshot too). So even a future route/url
  trick cannot reach the message enqueue from voucher mode.
- `MessageComposer` also disables itself when the snapshot isn't member
  (defense-in-depth; the route group already blocks navigation).

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

## Chat — matches, threads, outbox, simulated realtime

- **Routes:** `app/(protected)/(member)/(tabs)/chat/_layout.tsx` (stack: header
  hidden list + pushed `[matchId]` whose `Stack.Screen` title is the partner's
  name via the thread hook). `chat/index.tsx` → `MatchesScreen`;
  `chat/[matchId].tsx` → `ThreadScreen`. Feature code lives in
  `src/features/chat/` (`model/`, `store/`, `hooks/`, `realtime/`,
  `components/`).
- **Schema §4.x:** migration `0004_fast_scarecrow.sql` adds `matches`
  (unique `profileId`) and `messages` (`status`, `outboxItemId`, index on
  `(matchId, createdAt)`). Writes route through the outbox only; the mirror
  helpers pair a message row and its `outbox_items` row in one transaction.
- **Writes (§3.6):** `sendMessage(matchId, text)` (member-guarded assert)
  inserts message + outbox item atomically and bumps the single-flight drain.
  Statuses travel `queued → sending → sent/failed`, surfaced per bubble by the
  in-memory mirror (`store/message-status.ts`, `useSyncExternalStore`
  per-message id) so drain progress never re-renders the list. Failed bubbles
  expose Retry (`retryFailedMessage`) and Delete (`deleteMessage`,
  failed/queued only).
- **Matches list:** `ListMatches` join renders avatar/name/verified, the latest
  preview (with `You:` prefix when the newest row is ours — including its
  in-flight transport caption), a relative timestamp, and the unread pill
  (`unreadCount` from a `lastReadAt` watermark sweep). Opening a thread marks it
  read and the pill collapses.
- **Thread UX:** newest-first state + `scaleY(-1)`-flipped FlashList (FlashList
  2.0.2 dropped `inverted`) so index 0 is the visual bottom; scroll-to-top pages
  older history via keyset `(createdAt, id)`. `maintainVisibleContentPosition`
  keeps the view pinned while chatting; the partner typing indicator renders in
  the flipped header. Dev Panel buttons drive arrivals ("Force incoming
  message") and a 3.5 s typing bubble ("Simulate typing").
- **Matches also materialize from likes:** after a `like` drains,
  `src/mocks/reciprocity.ts` deterministically "likes back" a fixed subset and
  emits a real `matches:new` through the realtime channel; the chat subscriber
  (`src/features/chat/realtime/chatRealtime.ts`, started once in
  `app/_layout.tsx`) reconciles it exactly like a server push.
- **Auto-reply (Dev Panel knob, default off):** when on, each drained message
  schedules a partner `messages:new` (sender omitted on the wire; the consumer
  resolves it from the match) after a 2.5–6 s delay. It travels the real
  unreliable channel (dedupe/duplicate/out-of-order), never a direct DB write.
- **Demo seed:** `seedChatIfEmpty()` guarantees three conversations re-created
  after **Wipe local data**: `match-seed-treasure` (55 messages → paging),
  `match-seed-saturday` (2 unread), `match-seed-book` (read).
- Details, the outbox/drain pairing, and the test sweep live in
  `docs/TECHNICAL.md`.

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
  after random latency. `src/realtime/publishes.ts` owns the `RealtimeEvent`
  discriminated union + the `emit`/`subscribeToRealtime` surface (honoring the
  duplicate rate + out-of-order window); `realtimeChannel.ts` re-exports it and
  adds the Dev-Panel helpers. The mock engines (`partnerReply.ts`,
  `reciprocity.ts`) emit through `publishes` only, so the module graph stays
  acyclic (no realtimeChannel ⇄ mocks require cycle);
  `src/realtime/dedupe.ts` is the consumer-side seen-id reducer. The Dev Panel's
  "Force a match / duplicate" buttons drive both, and the event feed line shows
  received vs applied (the visible proof dedupe works).
- **Real connectivity** (`src/network/connectivity.ts`): NetInfo (via
  `@react-native-community/netinfo`) feeds the same offline channel as the Dev
  Panel toggle — `useOffline()`/`isOffline()`/`subscribeOffline()` are true when
  the manual toggle is ON **or** the device actually has no internet
  (`isConnected === false || isInternetReachable === false`; an unknown
  reachability reads as online to avoid a false-offline flash). `server.ts`
  rejects with `NetworkOfflineError`, `drain.ts` wakes on offline→online, and
  the realtime `emit`/auto-replies go silent when offline. Boot resilience
  (REQUIREMENTS §4.7-2): the start/foreground/reconnect triggers route through
  a self-healing `scheduleDrainAttempt` that re-schedules any thrown run on the
  wake timer until it succeeds — so actions queued offline and left behind a
  hard kill auto-drain on relaunch once online (with a "Synced N queued
  actions" toast when a lifecycle drain actually flushes them). Jest mocks
  NetInfo via `jest.setup.js` (official `netinfo-mock.js`); the toggle remains
  a manual override so offline can still be exercised while online.
- **Scope note:** every knob is live. Seed data is the deterministic 60-profile
  catalog (asserted by a unit test); Discover reads it from the in-memory
  generator, while Browse mirrors it **into SQLite** idempotently
  (`seedCatalogIfEmpty`, migration `0003`) because its list paginates from the
  database — both feature trees are literally the same people. `ensureMigrated()`
  only applies schema (including `0003`).
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
  `git grep DECK_VISIBLE_SLOTS` → 3 under-cards. A plain tap on the front card
  opens the profile (`Gesture.Exclusive(press, pan)`); the tap worklet reads the
  one-shot swipe lock from a **shared value** (never a ref, and the press
  callback is read on the JS thread via `runOnJS`) so no `.current` object is
  ever captured-and-mutated by a worklet. **Only the front card owns a
  `GestureDetector`**, remounting with the card, so undo-restored cards always
  get a freshly attached pan (no gesture object is shared between detectors).
  Under-cards are plain views keyed by `profileId` with per-card seat `progress`
  springs — an advance re-seats smoothly and the card shown while rising is the
  same profile (no content swap / pop-in), so undo → re-swipe can't skip a
  person. The one-shot swipe lock is held for the whole flight on **both** the
  pan and the button paths (plus a per-dismissal `dispatchFired` latch) to stop
  overlapping or double-fired dismissals from double-advancing the deck.
- **Catalog (§4.4):** `src/mocks/seed/profiles.ts` deterministically seeds 60
  profiles with ≥3 photos each (asserted in `profiles.test.ts`). It is seed, not
  DB; `useDiscoverDeck` builds `profilesById` from it and prefetches the next 4
  `Image.prefetch` links.
- **Outbox (§4.1) — now live:** every swipe/undo writes `outbox_items` +
  `swipes` mirror atomically (`src/outbox/actions.ts`); the drain
  (`src/outbox/drain.ts`, single-flight, FIFO `queued→sending` claim) replays
  through `mocks/server.ts` `request()` with exponential backoff (`backoff.ts`:
  1s base, 30s cap, ±20% jitter, 5 attempts → `failed`). The walker triggers on
  enqueue, AppState foreground, and offline→online (Dev Panel toggle or real
  connectivity), and every trigger is self-healing (see below). Offline just
  pauses (Pill: "Offline — swipes queued"). Dev
  Panel's **Dump outbox contents** now lists
  items + statuses (Refresh), and **Wipe local data** clears outbox + swipes via
  a confirm Alert. Design details + conflict rule + measured §4.6 numbers live
  in `docs/TECHNICAL.md`.

- **Boot auto-drain after a kill (§4.7-2):** swipes/messages queued in an
  offline session survive a force-kill in SQLite; the next launch's
  `startOutboxWatcher` immediately drains them (recovering anything the kill
  left `sending` first), and `subscribeOffline` wakes the drain again the moment
  connectivity returns. Because every lifecycle trigger flows through
  `scheduleDrainAttempt` in `drain.ts`, a cold-start drain that throws is
  re-scheduled on the wake timer (exponential, 30s cap) instead of going
  silent — the queue self-heals even if nothing else ever fires. When such a
  run actually flushes items a "Synced N queued actions" toast appears; the Dev
  Panel offline *toggle* is session-only (not persisted across a relaunch), so
  reproducing the cross-kill pause uses real airplane mode, while the toggle
  remains the quick online-device lever. `drain.test.ts` covers recovery,
  offline pause/reconnect, FIFO/backoff/cap, the toast, and the self-healing
  retry at the drain boundary (REQUIREMENTS §4.9).
- **Perf evidence channel:** `src/features/discover/performance.tsx` overlays a
  Reanimated `PerformanceMonitor` (JS/UI FPS) on the deck in `__DEV__` and logs
  `[discover.perf] re-renders between swipes` — the numbers go into
  `TECHNICAL.md`'s measured table. Archive/copy them any time you re-run the
  deck.

## Browse tab (member) — FlashList, filters, row isolation, pagination

- **Route:** `app/(protected)/(member)/(tabs)/browse.tsx` →
  `src/features/browse/components/BrowseScreen.tsx` (line in the member tab
  layout already existed; the file did not). Feature code lives under
  `src/features/browse/` (`model/`, `store/`, `hooks/`, `components/`).
- **Same people as Discover:** the 60 `SEED_PROFILES` are mirrored into SQLite
  once (`src/db/queries/catalog.queries.ts` `seedCatalogIfEmpty`, migration
  `0003_add-catalog-mirror.sql`). Discover stays on the in-memory generator;
  Browse paginates the SQLite mirror (`listCatalogPage`, `LIMIT/OFFSET`,
  `ORDER BY distance_km ASC, id ASC`, `hasMore` via `limit + 1`).
- **Filters (§3.4)** are pure model functions (`model/browseFilters.ts`,
  unit-tested) feeding `buildCatalogWhere` — age steppers keep `from ≤ to`,
  distance chips Any/≤10/≤25/≤50km, verified switch. Changing a filter re-queries
  page 1 (epoch-guarded by `useBrowseFeed`) and `scrollToOffset(0)`s.
- **Like toggles** (`BrowseScreen` handler): optimistic flip in
  `store/user-swipes.ts` → `enqueueDecision('like')` / `undoDecision(id)` — the
  same outbox path as the deck, so Discover and Browse agree on `swipes`
  (re-hydrated into the mirror on every tab focus). A row press pushes the
  existing typed `/profile/[userId]` route.
- **Row isolation (the requirement, with proof):** each `BrowseRow` subscribes
  to its own `useUserSwipe(id)`; a toggle re-renders exactly that cell. Dev
  builds show a per-row `×N` render badge (`performance.tsx`) and log
  `[browse.perf]`, and `BrowseRow.test.tsx` asserts a sibling's count stays `×1`.
- **Scroll preservation:** react-navigation keeps the tab mounted across
  switches, so the `FlashList` retains its offset with no saved state.
- **Why FlashList over FlatList** and the measured §4.6 evidence table live in
  `docs/TECHNICAL.md`.
- **Bottom-sheet filters:** `BrowseFilterBar` is a trigger pill +
  `@lodev09/react-native-true-sheet` (`name="browse-filters"`,
  `detents={["auto"]}`, themed `backgroundColor`/`cornerRadius`, native grabber)
  containing `BrowseFilterPanel` (extracted controls). Filters apply live on
  every interaction; closing is the "Done" button or the native scrim/gesture
  (via `dismiss()`/`onDidDismiss`). The sheet keeps the `FlashList` mounted,
  preserving scroll position. This replaced the hand-rolled RN `Modal` sheet
  (scrim + `useSafeAreaInsets` padding), which was dropped.
- **FlashList blank-space fixes (all platforms):** row thumbnail uses
  `recyclingKey={profile.id}` + `cachePolicy="memory-disk"` to prevent
  recycled-cell ghost images; the footer is a stable `minHeight: 64` shell
  (spinner / "end" / retry swap changes content without changing outer height).
  `estimatedItemSize` is not set — FlashList v2 dropped the prop.

## Profile screen (member) — gallery, scroll-reactive header, action bar

- **Route:** `app/(protected)/(member)/profile/[userId].tsx` (pushed, hides the
  tab bar). Thin container rendering `src/features/profile/components/ProfileScreen.tsx`.
- **Entry points:** Browse rows (→ profile id), Discover cards
  (`CardDeck.onPressCard`, tap is an exclusive gesture layered with the pan so a
  tap-to-open doesn't fight swipe-to-dismiss), and the chat thread's tappable
  partner header — each pushes the same typed route.
- **Data:** `useProfile` (in `src/features/profile/hooks/`) loads
  `getCatalogProfileDetail` (photos ordered by catalog `position`, interests,
  bio) plus `getMatchByProfileId` for the matched-thread id. It re-hydrates its
  decision mirror from `listAllSwipes` on focus, so a like made in Browse or
  Discover is already pressed when the profile opens.
- **Layout (§3.5):** paging `FlatList` gallery with a scrimmed dot indicator
  and next-photo prefetch; an editorial header (Newsreader name/age + verified
  seal) that collapses against the top on scroll using Reanimated shared values
  only (no per-frame React state, §4.6); italic bio + verified pill + interest
  chips; and the Discover-style circular Skip / Ask-your-voucher / Like bar. The
  bar reuses the exact outbox toggle semantics (re-press retracts, or
  enqueues), and a matched profile shows a primary **Message** CTA →
  `/chat/[matchId]`.
- **Non-goal:** no vouch-count block on the profile — the seed has no voucher
  rows for the member's catalog, so the section is omitted rather than faked.

## Settings — preferences, RTL, theme (§3.8)

- **One shared screen:** `src/features/settings/components/SettingsScreen.tsx`
  renders in both trees (`member/(tabs)/settings.tsx` and
  `voucher/(tabs)/settings.tsx`). It's the single place to flip the account
  between member and voucher navigation (§3.7).
- **Durable write path:** `settings/writes.ts` persists to `app_settings`
  (new table, migration `0005_calm_king_bedlam.sql`) then patches the reactive
  store — SQLite stays the source of truth, like the swipes mirror.
- **Bridges:** `useSettingsBridge()` (root layout) hydrates the store once from
  `getSettingsSnapshot()`, drives `UnistylesRuntime` from `themeMode`
  (fixed light/dark or adaptive-system), and re-arms `I18nManager.allowRTL/
  forceRTL` for the chosen language on iOS/Android only. The root
  `<Stack key={language}>` remounts navigation on a language flip so layouts
  reflow RTL. Theme/language/notification changes toast a confirmation.
- **Wipe:** "Wipe local data" confirms with `Alert`, calls `wipeLocalData()`
  (now clears outbox + swipes + matches + messages + `shortlisted_profiles` +
  `app_settings`), resets the in-memory settings/shortlist/swipe mirrors, and
  toasts. Chat reseeds on the next launch.
- **i18n:** `src/i18n/{en,ar}.ts` lock their key sets via the `Translations`
  type; `t()` interpolates `{name}`/`{count}`. Translated so far: tab bars,
  Settings, voucher Browse, Shortlist, candidate screen — older screens stay
  English until they adopt `t()`.

## Voucher mode — Browse, Shortlist, candidate detail (§3.9)

- **Tree:** `app/(protected)/(voucher)/` = Browse / Shortlist / Settings tabs
  plus two pushed routes: `candidate/[userId]` (named `candidate`, never
  `profile`, so it can't collide with the member tree's dynamic route) and the
  placeholder three-way `thread/[vouchId]`.
- **Browse:** reuses the member SQLite feed + filter sheet; the row action is a
  bookmark. Each row subscribes to only its own shortlist state
  (`useUserShortlist`), so a toggle re-renders exactly one row (dev `×N` badge
  proves it). Toggles are optimistic through the mirror, durable via the outbox
  (`enqueueShortlist`/`removeShortlist`), and toasted.
- **Candidate detail:** `VoucherCandidateScreen` = member gallery/header/body +
  a single Shortlist toggle bar (primary button, plus a "open Shortlist to
  write your note" hint once added).
- **Shortlist:** `ShortlistScreen` reads `listShortlistItems()` (mirror joined
  to catalog) newest-first, offline-safe. Each row carries `VouchNoteEditor`:
  800 ms debounce → `enqueueUpdateVouchNote` (outbox + mirror in one
  transaction), 200-char cap, depth hint at 140. Removal confirms via `Alert`
  and compensates through the outbox.
- **DB:** migration 0005 adds `shortlisted_profiles` (PK profile id, note,
  `outboxItemId`, timestamps, index on `createdAt`) and `app_settings` (key PK,
  value, `updatedAt`). Mirror rows are added inside the same transaction as
  their outbox item.
- **Remove cascade:** if the add is still queued, the add item + mirror row are
  deleted and any queued note-updates for that profile are cancelled
  (`deleteQueuedNoteUpdates`); once sent, a compensating `unshortlist` is
  enqueued so drain order leaves the server "not shortlisted".