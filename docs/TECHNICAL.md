# Technical Notes — Discover Deck, Outbox, and Performance (§4.6 evidence)

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

## Test suite (jest-expo)

- `src/features/discover/model/deck.test.ts` — deck state machine, threshold
  classification, RTL flip, exit geometry.
- `src/outbox/backoff.test.ts` — exponential schedule, cap, jitter band, retry
  cap.
- `src/mocks/seed/profiles.test.ts` — catalog size, shape, uniqueness,
  determinism.

Run with `npm test`. (Integration tests for the drain's ordering and the
`=FailedOutboxItems` stream are deferred to the realtime/reconciliation pass — a
documented gap, not an omission: the drain is only exercised on device today.)