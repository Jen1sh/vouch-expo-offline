# Requirements

Single source of truth for *what* to build, condensed from the brief into requirements an agent can work against directly. `CONVENTIONS.md` governs *how* code is written, `PROJECT-STRUCTURE.md` governs *where* it goes, `SKILLS.md` governs *the steps* for recurring changes — this doc governs *what's in scope* and *when something counts as done*.

If a requirement here conflicts with something in the other three docs, this doc wins on scope; the other docs win on implementation style.

## 0. Premise

Vouch is a fictional offline-first introductions app. There is no real backend — a simulated network layer (`src/mocks/`) stands in for one, and it must behave identically on native and web. Two account roles exist on the same login: **member** (browses and chats for themself) and **voucher** (browses/shortlists/writes a note on someone else's behalf, and can never open a 1:1 chat — enforced in the service layer, not just hidden in the UI).

## 1. Priority order (build in this order, not screen-by-screen)

Correctness of the systems below outweighs the number of finished screens. If time runs short, cut screens before cutting anything in this list:

1. Persistence layer (expo-sqlite + drizzle: schema, migrations, queries)
2. Outbox (durable queue, optimistic apply, drain, backoff, idempotency)
3. Simulated network layer + Dev Panel
4. Realtime dedupe/reconciliation
5. Screens (Discover and Chat first — they exercise the outbox/realtime hardest; Settings/Profile last)
6. Accessibility, RTL, font scaling
7. Tests and docs (written alongside the above, not after)

## 2. User flows

### 2.1 Member flow
1. Sign in with phone → enter 6-digit code (shown in Dev Panel) → land in onboarding if profile incomplete, else Discover.
2. Onboarding: 4 schema-driven steps (basics → photos → preferences → who can vouch for you), resumable after a kill at any step.
3. Discover: swipe right (like), left (skip), up (ask my voucher to look) → on mutual like, a match appears in Chat.
4. Chat: open a match's thread, send messages (optimistic states: queued → sending → sent, or failed), retry or delete a failed message.
5. Browse: same people as a filterable list; same like/skip actions available inline.
6. Profile: view a person's gallery and details from either Discover or Browse.
7. Settings: toggle theme/language/notifications, switch into voucher mode, or wipe local data.

### 2.2 Voucher flow
1. From Settings, flip "voucher mode" → navigation tree changes to the voucher tree.
2. Voucher browses on behalf of the person they represent, shortlists candidates, writes a vouch note.
3. Voucher can read the three-way thread (voucher + both principals) but **cannot** open or reach a 1:1 chat screen — no route to it exists in the voucher tree, and the underlying send/read action independently rejects the call if attempted directly.
4. Switching back out of voucher mode returns to the member tree with member state intact.

### 2.3 Offline/interruption flow (must hold at every step of 2.1/2.2)
- Any action taken offline is applied optimistically and queued; the UI never blocks on network state.
- App kill at any point does not lose or duplicate a queued action, an onboarding step, or an in-progress message.
- Reconnecting drains the queue in order, one attempt at a time, with backoff on failure.

## 3. Screen requirements

### 3.1 Sign in
- Phone number entry → 6-digit code entry.
- Code is never actually sent; the expected code is visible in the Dev Panel.
- Handles: wrong code (inline error, no crash), resend cooldown (visible countdown, disabled resend button until it elapses), back navigation from code entry to phone entry without losing the phone number.

### 3.2 Onboarding
- 4 steps: basics, photos, preferences, who-can-vouch-for-you.
- Driven by a JSON schema (field list + type + validation + conditional rules), not per-field hardcoded JSX — adding a field should mean editing the schema, not the screen.
- At least 2 fields are conditionally shown based on an earlier answer (e.g., a "wali contact" field appears only if "family involved" was picked in the who-can-vouch-for-you step).
- Photos: pick from device library, store local URIs, no upload step needed.
- **Acceptance:** kill the app on step 3, reopen → lands back on step 3 with every previously entered value intact.

### 3.3 Discover
- Card deck with hand-written pan gesture + spring animation (Reanimated + Gesture Handler, UI thread only). No swipe-deck library of any kind.
- Gestures: right = like, left = skip, up = ask voucher to review.
- Undo: one level (last swipe only).
- Prefetches the next few cards and their images so the stack never shows blank while scrolling through it.
- Explicit empty state when the deck is exhausted (not a blank screen).
- **Acceptance:** a full swipe-through of the seeded deck never shows a loading gap or a blank card; undo restores exactly the last card.

### 3.4 Browse
- Same people as Discover, rendered as a list (FlashList or FlatList — pick one and record why in `docs/TECHNICAL.md`).
- Filters: age range, distance, verified-only.
- **Acceptance:** toggling one row's like state does not re-render sibling rows (prove with a render counter/profiler); leaving and returning to the tab preserves scroll position.

### 3.5 Profile
- Photo gallery, scroll-reactive header, same like/skip/ask-voucher actions as Discover/Browse.

### 3.6 Chat
- Matches list with unread counts.
- Inverted message list with history paging (loads older messages on scroll-up).
- Sending is optimistic; every message shows exactly one of `queued | sending | sent | failed`.
- Failed messages can be retried or deleted.
- Typing indicator driven by the simulated realtime layer (not a fake timeout).
- **Acceptance:** sending at 100% simulated failure rate then dropping to 0% (via Dev Panel) results in the message reaching `sent` with no duplicate rows.

### 3.7 Voucher mode
- One account, two navigation trees (see 2.2). Switch lives in Settings.
- Voucher can: browse, shortlist, write a vouch note, read the three-way thread.
- Voucher cannot: open a 1:1 chat. This is enforced both by the absence of a route in the voucher tree **and** by the underlying chat-send/read action refusing the call for a voucher-mode caller — hiding the button alone does not satisfy this requirement.

### 3.8 Settings
- Theme: light / dark / follow system.
- Language: English / Arabic (Arabic flips the whole app to RTL, gestures and directional icons included).
- Notification toggle, sign out, wipe local data (clears drizzle-backed tables and outbox).

## 4. System requirements

### 4.1 Outbox (durable write path) — see `CONVENTIONS.md` §8–9 and `SKILLS.md` "Add a new outbox action" for implementation rules
- Every mutating action (like, skip, ask-voucher, vouch request, message send, profile edit, shortlist, vouch note) goes through exactly one write path — no direct network calls from a component or feature hook.
- Action lands in the durable outbox table (expo-sqlite via drizzle) before any network attempt; UI updates optimistically from the local mirror, never from a network response.
- Each action carries a client-generated idempotency key created at enqueue time.
- Draining is single-flight and strictly ordered — never two workers pulling from the same queue concurrently.
- Retries use exponential backoff with jitter and a cap; past the cap the item becomes `failed` and visible to the user (not silently dropped or retried forever).
- **Acceptance:** kill the app with 15 items queued, reopen — nothing is lost, nothing is applied twice.
- Conflict rule (e.g. last-write-wins on server timestamp) is decided, written down in `docs/TECHNICAL.md`, and the code matches it — "no stated rule" is not acceptable.

### 4.2 Persistence — expo-sqlite + drizzle
- The outbox and every server-mirrored table live in SQLite, accessed exclusively through drizzle's schema/query builder. No MMKV, no AsyncStorage, no ad hoc key/value storage for anything relational.
- Schema changes go through `drizzle-kit`-generated, committed migrations (see `SKILLS.md` "Add or change a drizzle table/schema").
- Writes that must be atomic (e.g. a message row + its outbox enqueue) happen inside a single drizzle transaction.

### 4.3 Simulated realtime
- Pushes `new match`, `new message`, `typing`, `profile updated` events, deliberately unreliable: it repeats and reorders events.
- Client dedupes by event id before the event reaches any reducer/query, tolerates out-of-order arrival, and reconciles an incoming event against an optimistic local row that may already represent the same thing.
- **Acceptance:** a duplicated match event never produces two match rows or two notifications; an out-of-order event does not overwrite a newer local state with a stale one.

### 4.4 Simulated network layer (`src/mocks/`)
- Built in-repo, behaves identically on native and web export — no local Express server, nothing that only works under one platform.
- Seed data: ≥60 profiles (name, age, city, distance, verified flag, interest tags, ≥3 image URLs).
- Configurable knobs: latency (300–1200ms, random per request), write failure rate (default 20%), duplicate delivery rate (default 5%), out-of-order window (default 2 events), offline toggle (default off).

### 4.5 Dev Panel — required, not optional
- Reachable from inside the app (long-press title, settings row, shake gesture — implementer's choice).
- Exposes: offline toggle, latency slider, write-failure-rate slider, force a match event, force a duplicate event, show the current sign-in code, dump outbox contents, wipe local data.
- **This is the primary grading mechanism.** Missing or half-wired = automatic loss of the associated marks, independent of how good the rest of the app is.

### 4.6 Performance
- Deck gestures run on the UI thread via Reanimated worklets; no `setState` per frame driving animation.
- A single list row's state change does not re-render sibling rows.
- Both claims are backed by actual evidence (render counters, `react-native-performance`, Reanimated frame log, or profiler screenshots) captured and placed in `docs/TECHNICAL.md` — an unverified claim doesn't count.

### 4.7 Interruption safety — the three canonical scenarios (must pass on a clean install)
1. Kill the app during onboarding step 3 → reopen → resumes exactly at step 3 with all entered data intact.
2. Go offline, perform 5 likes and send 3 messages, force-kill, reopen, go back online → all 8 actions present exactly once after drain.
3. Send a message with write-failure-rate at 100%, then drop it to 0% → message reaches `sent`, no duplicates.

### 4.8 Accessibility, RTL, text scaling
- Arabic flips the whole app to RTL, including deck swipe direction and any icon implying direction.
- Every interactive element has a screen-reader label.
- The app is fully usable at the OS's largest font size — nothing clipped, nothing unreachable.

### 4.9 Tests
- Unit tests: outbox ordering, dedupe, backoff, permanent failure, replay after restart.
- ≥3 component tests (Testing Library).
- 1 integration test: go offline → perform 5 actions → come back online → drain → assert final local state.
- ≥80% line coverage on the sync/outbox modules specifically (no coverage target elsewhere).

## 5. Explicit non-goals

- No real backend, no real push notifications, no real SMS — all simulated in-app.
- No business realism beyond what's specified (this is a grading exercise, not a product to ship).
- No third-party swipe-deck library for Discover, under any circumstance.
- No MMKV/AsyncStorage as the persistence layer.

## 6. Definition of done (per feature)

A feature is done only when all of the following are true, not just "renders correctly":
- [ ] Works fully offline and its actions survive an app kill mid-flight.
- [ ] Goes through the single outbox write path if it mutates anything.
- [ ] Uses only theme tokens for styling (no literals) and follows the conditional-rendering/variant rules in `CONVENTIONS.md`.
- [ ] Has a screen-reader label on every interactive element and holds up at the largest OS font size.
- [ ] Has at least one automated test exercising its core behavior.
- [ ] Passed the `mobile-design` skill's review checklist (platform conventions, touch targets, motion, RTL) — see `SKILLS.md` "Performance and UI/UX audit before marking a feature done".
- [ ] Is reflected in the relevant `docs/*.md` file if it changes the write path, schema, or a documented design decision.
