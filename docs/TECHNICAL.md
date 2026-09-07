# Technical Notes — Discover Deck, Outbox, Browse (FlashList + SQLite pagination), Chat, and Performance (§4.6 evidence)

Design decisions, invariants, and measurement channel for the swipe deck and the
durable write path. Requirements references point at `REQUIREMENTS.md`.

## The durable write path (outbox)

Every mutating user action passes through `src/outbox/` — nothing writes the
`swipes` mirror directly except outbox-specific rolls. Layers:

- `schema/outbox.ts` — `outbox_items`: `{ id (uuid), type, status, payload,
  attempts, createdAt, updatedAt }`. Statuses `queued | sending | done | failed`
  (single word, set by the drain).
- `schema/swipes.ts` — optimistic mirror `swipes`: `{ profileId, direction,
  createdAt }`, written in the same transaction as the enqueue.
- `queries/outbox.queries.ts` — `insertOutboxItem`, `claimNextOutboxItem`
  (transactional `queued → sending`, FIFO by `createdAt`), `markOutboxItemDone`,
  `bumpOutboxItemAttempts`, `failOutboxItem`, `listOutboxItems`,
  `wipeOutbox`. `swipes.queries.ts` — `upsertSwipe`, `deleteSwipe`,
  `getSwipeByProfile`.
- `outbox/actions.ts` — the public API: `enqueueDecision(direction, profile)`
  and `undoDecision(profileId)`. Idempotency keys are `Crypto.randomUUID()`
  (`expo-crypto`) generated at enqueue.
- `outbox/queue.ts` — module-level single-flight scheduler. `isDraining()`
  guards re-entry (no two drains concurrently). Triggers: enqueue, AppState
  `active`, and offline→online edges via `subscribeControls`.
- `outbox/drain.ts` — the worker. Claims one item, calls `request()` from
  `mocks/server.ts` (which throws `NetworkOfflineError` / `WriteFailureError`
  per the Dev Panel knobs), retries with backoff, gives up at the attempt cap.
- `outbox/backoff.ts` — pure schedule, unit-tested.

**Backoff constants** (`backoff.ts`): `BASE_MS = 1000`, `CAP_MS = 30_000`,
`JITTER = 0.2` (±20%), `MAX_ATTEMPTS = 5`. Delay for attempt `n` =
`min(CAP, BASE · 2^(n−1))` then jitter. At attempt 5 (the cap) an item is
permanently marked `failed` and surfaces in the Dev Panel dump. `NetworkOfflineError`
pauses the drain with no retry bookkeeping (offline is not a failure).

**Undo semantics** — exactly one level. `undoDecision(profileId)`:
- If the decision is still `queued` (not yet claimed): delete the outbox item +
  mirror row and roll the deck forward — the same deck as before, nothing sent.
- Else: leave the decision alone and enqueue a compensating `undo_decision`
  action so the server's LWW rule (below) retracts it.
- The deck still restores the swiped-back card to the front immediately in
  either case (UI is instant; the server catches up).

## Conflict rule: last-write-wins on `updatedAt`

Per §4.1 a duplicate/conflicting write is resolved deterministically by the
server: the action with the later `updatedAt` (client clock, monotonic within a
device) wins for a given `profileId`. This is why `undo` is a *compensating
write* rather than a delete when the original already left the device: a delete
has no `updatedAt` to compare, a compensating action does. The rule is
documented here so the (future) realtime reconciliation in §4.3 can depend on
it — the decision's LWW timestamp is the outbox row's `createdAt`, and the
drained POST must carry it (the mock `request()` ignores the body today).

## Discover deck — controls and motion (§3.3, §4.6)

- `model/deck.ts` is **pure** (fully unit-tested). `createDeck / advance /
  undoDeck / isEmpty / classifySwipe / exitVector`. `DECK_VISIBLE_SLOTS = 3`,
  `HORIZONTAL_SWIPE_THRESHOLD = 110`, `HORIZONTAL_FLING_VELOCITY = 900` (a
  fling halves the distance bar). `classifySwipe` is dominant-axis; the
  "primary" drag alone decides: right→`like`, left→`skip`, up→`askVoucher`,
  small→null. In RTL (`I18nManager.isRTL`) horizontal semantics are mirrored so
  a leftward drag still means `like`.
- `components/CardDeck.tsx`: one top `GestureDetector` card + up to
  `DECK_VISIBLE_SLOTS` `StackedCard` under-cards. **All motion is Reanimated
  shared values driven by `Gesture.Pan` worklets and `withSpring`** — there is
  no `setState` per frame and no gesture package beyond gesture-handler.
  `swipe()` (imperative handle) drives the same dismissal from the toolbar
  buttons, which are the §4.9 accessibility alternative to raw gestures.
- Undo re-entry: `entry { x, y, scale }` on the re-entering slot springs the
  card back from the exact exit vector or from promotion (under-card scale).
- `hooks/useDiscoverDeck.ts` owns deck state + wires every swipe/undo/reset to
  the outbox. `Image.prefetch` warms the next 4 cards. React Compiler is on
  (see `app.config.ts`), so the memoization in the screen is a guard, not a
  dependency.

### §4.6 evidence — what is measured and how (one-time device capture)

- **Architectural (verifiable in this repo by inspection):** no per-frame React
  state. The render counter and the code path prove the only state commits are
  discrete: `advance`/`undoDeck`/`isDraining`-pill toggles. React re-renders do
  not scale with gesture duration or frame rate.
- **Instrumentation channel (ships in the app, dev builds only):**
  - `src/features/discover/performance.tsx` → `DeckFpsOverlay`, a Reanimated
    `PerformanceMonitor` (JS + UI FPS, `smoothingFrames: 20`) overlaid top-right
    of the deck while `__DEV__`.
  - `recordDiscoverRender()` + `logSwipeCost()` console `[discover.perf] re-renders
    between swipes: N` on every dismissal.
- **Reproduction** (native sim/device): open Discover, swipe 8–10 cards
  (gesture and buttons), read the overlay FPS and the console deltas.
  Recorded figures below are the field; measure and paste them in before sign-off.

| Metric | Expected | Measured (fill on device) |
| --- | --- | --- |
| Re-renders between swipes | 1 (the single advance commit) | — |
| UI-thread FPS during swipe | 60 (SpringS.fps max) | — |
| JS-thread FPS during swipe | plateau, no drop during gesture | — |
| Cold deck mount (60-card seed) renders | < 16ms budget | — |

## Seed catalog (§4.4)

`src/mocks/seed/profiles.ts` is a deterministically generated 60-profile catalog
(mulberry32 PRNG, fixed seed → byte-identical order across runs/languages). Each
profile: `{ id: 'seed-01'…, firstName, age, city, distanceKm, verified,
interests[], photos[] }` with ≥3 photos (`https://picsum.photos/seed/vouch-<id>-<a..d>/600/800`).
Asserted by a unit test. It is **seed data, not DB schema** — `ensureMigrated()`
only applies migrations.

## Browse — SQLite catalog mirror + pagination (§3.4)

Discover reads the 60 profiles from the in-memory generator; Browse pages them
out of **SQLite**, so the mirrored data really is the same catalogue.

- **Mirror tables** (`src/db/schema/catalog.ts`, migration `0003_add-catalog-mirror.sql`):
  `catalog_profiles` (+ indexes on `age`, `distance_km`, `verified`),
  `catalog_profile_interests` and `catalog_profile_photos` — normalized child
  tables (CONVENTIONS §8 forbids JSON columns), composite `(profile_id,
  position)` PKs, FK cascade.
- **Seeding** (`seedCatalogIfEmpty` in `src/db/queries/catalog.queries.ts`):
  idempotent, transaction-wrapped, driven by the same `SEED_PROFILES` array as
  the deck. A no-op once `catalog_profiles` is non-empty, so it can run on every
  Browse focus.
- **Pagination is in the DB** (`listCatalogPage`): `LIMIT/OFFSET` over
  `ORDER BY distance_km ASC, id ASC` (deterministic ⇒ offset never drifts across
  pages), page size 15. `hasMore` comes from fetching `limit + 1` rows — one
  query, no second `COUNT`. The thumbnail (`position = 0`) and interests are
  filled with two narrow indexed lookups per page.
- **Filters compile to SQL** (`buildCatalogWhere`, indexed columns):
  `age_from`/`age_to` → `gte`/`lte`, `max_distance_km` → `lte`, `verified_only`
  → `eq true`. The pure filter model in
  `src/features/browse/model/browseFilters.ts` is the single source of truth for
  both the UI steppers/chips/switch and the WHERE builder.
- **Hook:** `useBrowseFeed` owns first-page load, filter-change reset (epoch
  guard discards stale responses), `onEndReached` append, tail-page retry, and
  re-hydration of the per-row like mirror from `swipes` whenever the tab refocuses.

### FlashList over FlatList — why

- **RecyclerListView cell recycling**: FlashList recycles native cells instead
  of keeping a virtualized window of mounted rows, so 60 expo-image thumbnails
  cost constant memory even when paged to the full catalogue.
- **No `estimatedItemSize` obligation in 2.0.2**: unlike 1.x, v2 auto-estimates
  layout, so row height changes (one-line vs two-line names) don't require a
  fixed estimate — and the pinned `@shopify/flash-list@2.0.2` dep keeps behavior
  the same across platforms (mobile + web).
- Row identity (`keyExtractor = id`) + memoized `BrowseRow` sits fine with cell
  recycling; each cell's per-row subscription is keyed by `profile.id`.

## Browse — bottom-sheet filter modal (§3.4)

Filters live inside `BrowseFilterPanel` (the pure control body: age steppers,
distance chips, verified switch, reset row). `BrowseFilterBar` renders a compact
trigger pill (`slider.horizontal.3` icon + "Filters" + live summary text + active-
count badge) that opens a slide-up RN `Modal` containing the panel. The sheet
is `transparent` with `animationType="slide"` and respects the safe-area inset
via `useSafeAreaInsets().bottom`.

**Live apply**: every stepper/chip/switch interaction calls `onChange`, which
immediately re-queries the FlashList behind the sheet. The list scrolls to top
on any filter change (`scrollToOffset(0)`). Closing via the "Done" button or
the scrim `Pressable` simply sets `open = false` — no confirm step.

**Scroll preservation**: the sheet `Modal` renders over the existing screen; the
underlying `FlashList` and its scroll offset remain mounted and unchanged, so
closing the sheet returns the user to exactly where they were.

**`accessibilityViewIsModal`** is intentionally not set on the sheet View.
The RN `Modal` host already provides native modal semantics on iOS/Android.
Adding the prop on an inner View causes RNTL's accessibility matcher to hide
the scrim sibling (modal sibling rule), breaking tests without improving
device accessibility. This is a known RNTL behaviour — see
`node_modules/@testing-library/react-native/build/helpers/accessibility.js`
`isSubtreeInaccessible` → `getHostSiblings` → `computeAriaModal` path.

## Browse — FlashList blank-space fixes (all platforms, §3.4)

Three root causes identified (FlashList GH #1630 / #1751 / #1827 / #1847):

1. **Recycled cells with `expo-image`**: FlashList reuses the same host
   component for a new row; `expo-image` keeps the old URI or shows a blank
   frame until the new URI loads. Fix: `recyclingKey={profile.id}` forces
   a fresh image slot per profile, and `cachePolicy="memory-disk"` avoids
   redundant network hits on rapid scroll.
2. **Footer height oscillation on pagination append** (#1847): the footer
   swaps between spinner / "end" / retry, changing height and triggering a
   re-measure that briefly clips the bottom of the list. Fix: a single
   `footerShell` View with a fixed `minHeight: 64` is always rendered when
   `items.length > 0`; only the inner content (spinner / label / retry button)
   changes, keeping the outer shell height stable.
3. **Dev-build artifact on New Architecture** (#1751): cells that have
   finished recycling briefly flash blank on real devices only in development
   builds; not reproducible in tests. Confirm on a preview or release build
   before recording §4.6 numbers.

**Test conventions kept**: no `key` props on row elements (breaks FlashList
recycling); `keyExtractor={item.id}` + memo'd rows + stable `renderItem`
ref remain the correct primitives. `estimatedItemSize` is not used — FlashList
v2 dropped the prop entirely (verified in `@shopify/flash-list@2.0.2` types).

## Browse — per-row like isolation (§3.4, §4.6 evidence)

The requirement: toggling one row's like must not re-render the list. Two layers:

1. **Storage** (`src/features/browse/store/user-swipes.ts`): a module-level
   `Map<profileId, decision>` mirror fed from `listAllSwipes()` and kept in sync
   with the outbox write path (`enqueueDecision` / `undoDecision`, same calls the
   deck uses). Exposes `useUserSwipe(id)` via `useSyncExternalStore`, so each
   `BrowseRow` subscribes to exactly one profile (CONVENTIONS §9 narrow
   selector). A toggle notifies only that profile's single subscriber — the list
   `data` prop never changes.
2. **Evidence channel** (`src/features/browse/performance.tsx`): dev-only per-row
   `×N` render badge + `[browse.perf]` log of every mounted row's count on each
   like toggle. `src/features/browse/components/BrowseRow.test.tsx` asserts the
   isolation in jest: with two rows mounted, toggling row A leaves row B's
   render count at exactly 1.

| Metric (device capture) | Expected | Measured (fill on device) |
| --- | --- | --- |
| Rows re-rendered by one like toggle | 1 | — |
| Sibling row render counts after one like | unchanged (still `×1`) | — |
| `[browse.perf]` mount→toggle row counts | only toggled id advances | — |

## Browse — scroll position across tab switches

react-navigation bottom tabs keep inactive tab screens mounted by default, so the
`FlashList` instance (and its scroll offset) survives leaving and returning to
the tab — no state to save or restore. The only explicit scroll call is
`scrollToOffset(0)` when filters change, so a narrowed result set doesn't park
the user mid-list. Verified on device during the QA pass.

## Chat — matches, threads, outbox, simulated realtime (§3.6, §4.3)

Chat is build on the same durable-write + simulated-realtime rails as Browse:
the SQLite mirror is the source of truth, the outbox is the only write path, and
"the server" is `src/mocks` + `src/realtime`.

### Durable layers

- **Migration `0004_fast_scarecrow.sql`** adds `matches` and `messages`.
  `matches`: `{ id, profileId (FK catalog_profiles), lastReadAt, createdAt }`,
  unique `profileId` (one match per profile). `messages`:
  `{ id, matchId (FK → matches, cascade delete), senderId, body, status,
  outboxItemId (nullable FK), createdAt, updatedAt }` with index on
  `(matchId, createdAt)` — the keyset-paging column pair. Message statuses are
  `queued | sending | sent | failed`, set only by the drain helpers (below).
- **Mirror queries** (`src/db/queries/messages.queries.ts`): `insertMessage`,
  `listMessagesPage` (key/none — NEWEST-FIRST keyset by `(createdAt, id)` with
  `before`), `getMessage`, `getMessageForOutboxItem(outboxItemId)`,
  `transitionMessageToSending`, and the paired atomic helpers
  `markMessageSent` / `failMessageSend` / `rescheduleMessageSend` /
  `requeueMessageSend` / `deleteMessageWithOutbox` — each flips the outbox item
  and the message row inside the **same transaction** (CONVENTIONS single-write
  rule; a message can never show `sent` while its outbox row is still `queued`).
- **Matches queries** (`matches.queries.ts`): `upsertMatch`,
  `setMatchRead` (the `lastReadAt` watermark), and `listMatches` — one ordered
  sweep over `messages` computes each row's `unreadCount` (incoming rows
  `senderId != 'me'` with `createdAt > lastReadAt`), the latest preview +
  `lastMessageSenderId` (+ its transport status for the "You: sending…" caption),
  and the partner photo from `catalog_profile_photos` (position 0). Client-side
  JS on one sorted loop — fine at demo scale.

### The chat write path

- `outbox/actions.ts` gains `sendMessage { matchId, messageId, body }`.
  `src/outbox/messages.ts` is the feature-facing API: `sendMessage(matchId,
  body)` asserts member mode (`getModeSnapshot()` from the voucher guard, §3.7),
  inserts the message row + outbox item in one transaction, sets the UI status
  mirror to `queued`, and bumps the drain. `retryFailedMessage` (re-write the
  message row to `queued` + its outbox item to `queued` again) and
  `deleteMessage` (failed/queued only) complete the set.
- `src/outbox/drain.ts` learns `sendMessage`: on claim it flips the linked
  message to `sending` (mirror + row, transactional `onClaimed` callback); on
  success it calls `markMessageSent` + mirror `sent`; on network-offline it
  leaves the item **`sending`** and the next drain start recovers stale in-flight
  items to `queued` first (`recoverInFlightItems` in `outbox.queries.ts`); on
  failure it backoffs then gives up → `failMessageSend` + mirror `failed`, which
  surfaces the bubble's Retry/Delete. `attemptDrain` ordering stays strict FIFO.
- **UI status mirror** (`src/features/chat/store/message-status.ts`): a
  `Map<messageId, status>` written by enqueue, drain outcome, retry, and delete.
  `useMessageStatus(id)` uses `useSyncExternalStore` with a per-message listener
  set, so a single bubble re-renders when *its* status changes — the same
  narrow-selector isolation as `useUserSwipe`. The per-`messageId` subscription
  means the inverted FlashList never re-renders on drain progress.

### Thread UX

- **Inverted layout without `inverted`**: FlashList 2.0.2 removed the `inverted`
  prop (verified in its `.d.ts`). The thread instead flips the list with
  `transform: scaleY(-1)` and each rendered cell/Hartheader/footer back with
  `scaleY(-1)`, so index 0 is the visual bottom, `scrollToOffset(0)` is "scroll
  to latest", and `maintainVisibleContentPosition` (default on) keeps the
  finally-pinned read position while older pages append behind.
- **Paging** (`src/features/chat/hooks/useThread.ts`): `THREAD_PAGE_SIZE = 30`,
  newest-first state. Realtime/message writes bump a revision counter
  (`thread-revision.ts`); the hook re-fetches the newest page and merges with
  `mergeNewest` (incoming rows win the front, held rows kept behind — older pages
  never drop). Scrollup triggers `loadOlder` → `listMessagesPage(before = oldest
  held)` → `appendOlder` (older never overrides an in-view row). Model is pure
  (`src/features/chat/model/thread.ts`), fully unit-tested.
- **Mark-read on focus**: opening/examining a thread calls `setMatchRead` and
  refreshes the matches list (the unread pill collapses); it is safe to call
  repeatedly. `watchMatches` mirrors the list so the tab reads reactively.
- **Send → UI**: `sendMessage` → optimistic row (queued) appears at the bottom via
  the revision merge, the mirror drives `Sending…` → `Sent`/`Not delivered`
  without touching the list, and `MessageComposer` clears immediately.

### Simulated realtime (chat half, §4.3)

- `src/realtime/realtimeChannel.ts` now emits `matches:new { matchId, profileId }`,
  `messages:new { messageId, senderId?, body, matchId }` (sender `optional` — the
  partner reply lleaves it out so the consumer resolves it), `typing { matchId }`,
  and `profiles:updated`. All events carry `id` for the dedupe.
- `src/features/chat/realtime/chatRealtime.ts` is the single subscriber owning
  the chat tables, started once from `app/_layout.tsx`, idempotent. It
  `ensureMigrated` + `seedChatIfEmpty` first (guaranteed demo threads), then
  dedupes every event by `id` before touching the DB. `messages:new` skips rows
  that already exist — the optimistic echo of our own sent — and drops events
  whose `matchId` isn't in `matches` (no orphan rows). `typing` goes to
  `src/features/chat/store/typing.ts` (auto-clear after 3500 ms).
- **Match creation**: after a `like` drains, `src/mocks/reciprocity.ts` decides
  deterministically (`seedIndex % 3 === 0 || % 5 === 0`) whether the profile
  "likes back" and emits a real `matches:new` through the channel — the same path
  a genuine backend would use, so the client reconciles uniformly.
- **Partner reply**: the Dev Panel `autoReply` toggle (default **off**) gates
  `src/mocks/partnerReply.ts`; when on, each drained `sendMessage` schedules a
  `messages:new` after a 2.5–6 s delay. So incoming messages travel the real,
  deliberately-unreliable channel (dedupe, out-of-order window, duplicate rate)
  rather than a fake timer writing to the DB directly. Manual "Force incoming
  message" / "Simulate typing" buttons in the Dev Panel emit to the newest match.

### Demo seed

`seedChatIfEmpty` (`src/db/queries/chat.queries.ts`) is idempotent and always
present after wipe: `match-seed-treasure` (55 messages over ~14 days → exercises
paging), `match-seed-saturday` (6 messages, 2 unread), `match-seed-book`
(4 messages, read). Partners are `SEED_PROFILES[0..2]`, all rows `status =
'sent'`, no outbox linkage.

## Test suite (jest-expo)

- `src/features/discover/model/deck.test.ts` — deck state machine, threshold
  classification, RTL flip, exit geometry.
- `src/outbox/backoff.test.ts` — exponential schedule, cap, jitter band, retry
  cap.
- `src/mocks/seed/profiles.test.ts` — catalog size, shape, uniqueness,
  determinism.
- `src/features/browse/model/browseFilters.test.ts` — filter transitions,
  bounds, from ≤ to invariant, active-count badge.
- `src/features/browse/model/feed.test.ts` — `mergePage` append, de-dupe by id,
  `hasMore` carry-through.
- `src/features/browse/store/user-swipes.test.ts` — per-row notifications
  (`renderHook` against the public `useUserSwipe`), hydrate/clear semantics.
- `src/features/browse/components/BrowseRow.test.tsx` — the §3.4 isolation proof
  (two rows, one toggle, sibling render count stays `×1`), persisted-like mount
  state, row press → profile id.
- `src/features/browse/components/BrowseFilterBar.test.tsx` — trigger opens
  bottom sheet, age steppers, distance chip select/reset, verified switch
  inside the modal, Done and scrim close.
- Chat: `src/features/chat/model/thread.test.ts` (merge/paging ordering + dedupe),
  `store/message-status.test.ts` + `store/typing.test.ts` + `store/matches.test.ts`
  (mirror isolation, 3500 ms auto-clear, store hydrate), `realtime/chatRealtime.test.ts`
  (dedupe, optimistic-echo skip, unknown-match drop, matches/typing reconcile),
  `mocks/reciprocity.test.ts` (determinism) and `mocks/partnerReply.test.ts`
  (auto-reply gate), plus component tests for `MatchRow`, `MessageBubble` (4
  transport states), and `MessageComposer`.

Run with `npm test`. (Integration tests for the drain's ordering while a chat
thread is live and the `=FailedOutboxItems` stream are deferred — the drain is
only exercised on device today; unit tests cover each outcome branch via the
paired mirror helpers.)