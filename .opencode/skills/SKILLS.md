# Skills

Playbooks for recurring tasks in this repo. Each skill is the checklist to follow when a request matches its trigger — follow it in order rather than improvising a one-off approach, so the same kind of change always lands the same shape.

## External reference skills

These are installed opencode skills (not written by us) to consult alongside the playbooks below — they don't replace `CONVENTIONS.md`, they inform taste and catch things a checklist alone won't.

| Skill | Consult it when |
|---|---|
| `mobile-design` (RubenGlez) | Any screen/component work touching navigation, forms, gestures, motion, touch targets, RTL, or Dynamic Type/font scaling. This is the primary authority for platform-correct RN/Expo UI — defer to it over any web-oriented skill when they conflict. |
| `api-design` (margelo/react-native-skills) | General TS/React public-API shape. Useful when defining exported hooks/types. |
| `react-native-mmkv` (margelo) | MMKV storage guide — installed for completeness only; this repo uses expo-sqlite/drizzle and bans MMKV per `CONVENTIONS.md` §8. |
| `swift`, `kotlin`, `cpp`, `nitro-fetch`, `build-nitro-modules`, `react-native-vision-camera`, `react-native-vision-camera-realtime` (margelo) | Nitro/native-module skills; not relevant to this managed Expo workflow. Installed as part of the full collection; ignore unless custom native modules are introduced. |
| `frontend-design` | Visual taste — typography, color, motion intent — when a component risks looking generic. Web-flavored; `mobile-design` wins on platform conventions if they disagree. |
| `web-design-guidelines` (Vercel) | Cross-check during a UI audit pass for general UX heuristics (form quality, animation feel, dark-mode contrast) — filter through `mobile-design` for anything platform-specific (touch targets, safe areas, RTL) since this one is written for web. |

Use `mobile-design`'s own review checklist as the basis for the "Performance/UI audit before marking a feature done" skill below, rather than inventing a separate one.

---

## Skill: Add a themed component

**Trigger:** "create a component", "build a [X] screen/card/row", any new visual piece.

1. Before writing markup, run the relevant parts of the `mobile-design` skill's design process for this component (navigation/forms/gestures as applicable) — don't skip straight to code on anything touching layout, touch targets, or motion.
2. Create `ComponentName.tsx` with a typed `Props` type above it, named export for the type, default export for the component.
3. Create `ComponentName.styles.ts` (or a `styles` const in the same file for small components) using `StyleSheet.create(theme => ({...}))`. No literals — pull every value from `theme.*`. If a needed token doesn't exist, add it to the theme first (both light and dark).
4. If the component has discrete style states (active/disabled/size/error), model them as unistyles `variants`, not inline arrays and not `useUnistyles`.
5. Default to a presentational component: it receives data + callbacks as props and renders. Only reach for `useUnistyles()` if you need a raw token for a non-style prop, and only on a small pure leaf — comment why.
6. Add accessibility props (`accessibilityRole`, `accessibilityLabel`) on every interactive element before considering it done — not as a follow-up pass. Cross-check touch target size against `mobile-design`'s accessibility-touch guidance.
7. Add a `ComponentName.test.tsx` with Testing Library covering the states that matter (loading/empty/error/interaction), not a snapshot-only test.
8. Check RTL: if the component uses directional icons/margins (`marginLeft`, arrow icons), confirm they flip correctly under `I18nManager`/theme direction rather than assuming LTR — `mobile-design`'s adaptivity-localization reference covers this directly.

---

## Skill: Add a new outbox action (mutation)

**Trigger:** any new "like", "send message", "edit profile", "vouch note" type action — anything that mutates local + eventually-remote state.

1. Add a new variant to the outbox action discriminated union with a unique `type`, its typed `payload`, and a generated idempotency key at creation time (never at drain time).
2. Write the handler that applies this action optimistically to the relevant drizzle-backed mirror table (`db/schema/*`) the moment it's enqueued — via a `db/queries/*` mutation function, inside a `db.transaction()` alongside the outbox insert — the UI must never wait on the network to reflect the action.
3. The outbox insert and the optimistic mirror-table write happen in the **same transaction**, so a crash between the two can't leave one without the other. Enqueue is synchronous and durable; the network attempt is not.
4. Confirm the drain worker handles the new action type: single-flight, ordered, exponential backoff + jitter on failure, permanent-failure state after the retry cap, with the queue read/written through `db/queries/outbox.queries.ts` rather than an in-memory array.
5. Write a unit test: enqueue → simulate failure N times → assert backoff timing and eventual `failed` state; enqueue → simulate app restart (fresh drizzle client against the same SQLite file) → assert the item survives and is not duplicated on replay.
6. Update `docs/TECHNICAL.md`'s action table and state-machine section with the new action, and add the new drizzle schema/migration if the action introduces a new column or table.

---

## Skill: Add or change a drizzle table/schema

**Trigger:** "add a table", "add a column", "store [X] locally", any change to `db/schema/*`.

1. Edit or add the table definition under `db/schema/<table>.ts` first — this is the source of truth, not a query written against an imagined shape.
2. Add explicit indexes for any column the app filters or joins on regularly (foreign keys, `status`, `matchId`, `createdAt` for ordering) — don't rely on a full scan and in-memory filtering.
3. Run `drizzle-kit generate` to produce the migration, and commit the generated SQL under `db/migrations/` — never hand-edit a migration after it's generated, and never skip committing one.
4. Update `db/migrate.ts` only if the migration runner itself needs to change — normal schema changes should need no runner code changes, just a new migration file.
5. Add or update the corresponding functions in `db/queries/<table>.queries.ts` — this is the only place other code should read/write this table.
6. If the table backs the outbox or a mirror used by the sync layer, add/adjust the relevant unit test asserting the new shape survives a restart and doesn't break replay.
7. Note the schema change in `docs/TECHNICAL.md`'s "where state lives and why" section.

---

## Skill: Add a new screen/route

**Trigger:** "add a screen", "add a route", anything under `app/` (expo-router).

1. Place the file under `app/` following existing folder grouping (e.g. `(tabs)`, `(voucher)`) — don't introduce a new top-level group without checking `PROJECT-STRUCTURE.md` first.
2. Screen file is a thin container: it wires data (selectors/hooks) and navigation, and delegates rendering to a presentational component from `src/features/<feature>/components`.
3. If the screen is reachable differently depending on account mode (member vs voucher), gate it at the route/layout level — and independently confirm the underlying action/service also refuses the call, per the role-enforcement rule in `CONVENTIONS.md`.
4. Add loading/error/empty states via early returns, not nested ternaries.
5. Confirm the screen respects the theme (no hardcoded colors), scales with the largest OS font setting, and has accessible labels on its interactive elements.

---

## Skill: Add or modify a theme token

**Trigger:** "add a color", "new spacing value", any hardcoded value appearing during review.

1. Add the token key to **both** the light and dark theme objects — same key, appropriate value for each.
2. Never introduce a one-off literal "just this once" — if the existing token set doesn't fit, that's a sign a new token is needed, not an excuse to hardcode.
3. Update `docs/DESIGN-PRINCIPLES.md`'s token table if the token represents a new semantic concept (not just a new shade of an existing one).
4. Grep the diff for stray hex codes / raw numbers in `style`/`StyleSheet.create` blocks before considering the change done.

---

## Skill: Handle a realtime event type

**Trigger:** "handle the new match event", "wire up typing indicator", any simulated-realtime event.

1. Define the event's shape in the realtime event union, including its `id` (for dedupe).
2. Dedupe by event id at the ingestion boundary — before it touches any reducer — so a duplicated event physically cannot reach application logic twice.
3. Reconcile against optimistic local state: check whether a local row already represents this event (e.g. an optimistic match/message) before creating a new one.
4. Handle out-of-order arrival explicitly — sort/merge by a logical ordering field, don't assume events arrive in send order.
5. Add a unit test that feeds the same event twice and out of order, and asserts no duplicate rows/notifications result.

---

## Skill: Write the honest system notes

**Trigger:** any milestone, or when asked to update `docs/SYSTEM-NOTES.md`.

1. Write it as you go, not retroactively at submission time.
2. For every corner cut: name it plainly, say what the correct version would look like, don't soften it into vague language.
3. List known bugs as a literal list, not folded into prose.
4. Keep the conflict-resolution rule, the state library choice, and any architectural assumption explicitly written down here even if it's also in `TECHNICAL.md` — this doc is graded on honesty and specificity, not completeness of coverage elsewhere.

---

## Skill: Performance and UI/UX audit before marking a feature done

**Trigger:** finishing the Discover deck, Browse list, any list/gesture-heavy feature, or any screen before calling it done.

1. For gesture-driven UI: confirm the pan/spring logic runs via Reanimated worklets on the UI thread — no `setState` per frame driving the animation.
2. For lists: confirm a single row's state change doesn't re-render sibling rows — verify with a render counter or profiler, not by assumption.
3. Capture the evidence (profiler screenshot, render counter output, frame log) and drop it into `docs/TECHNICAL.md`'s performance section immediately — don't leave evidence-gathering for the end.
4. Run the `mobile-design` skill's review checklist against the finished screen (platform conventions, touch targets, accessibility, motion, RTL) before considering it done — this is the audit pass, not an optional polish step.
5. Where `web-design-guidelines` and `mobile-design` disagree on something platform-specific, `mobile-design` wins.

---

## Skill: Verify an interruption-safety scenario

**Trigger:** after any change to onboarding persistence, the outbox, or realtime handling.

1. Re-run the three canonical scenarios manually: kill mid-onboarding step 3; offline + 5 likes + 3 messages + force kill + reconnect; message at 100% failure dropped to 0%.
2. Confirm final state has no duplicates and no loss in all three before considering the change safe to commit.
3. If a scenario newly fails, treat it as a blocking regression, not a follow-up item.
