# Project Structure

Folder layout and the reasoning behind it. New code goes in the matching folder below — don't invent a parallel structure for convenience.

```
.
├── app/                          # expo-router routes only — thin, no business logic
│   ├── (auth)/
│   │   ├── sign-in.tsx
│   │   └── verify-code.tsx
│   ├── (onboarding)/
│   │   └── [step].tsx
│   ├── (member)/                  # navigation tree for regular members
│   │   ├── (tabs)/
│   │   │   ├── discover.tsx
│   │   │   ├── browse.tsx
│   │   │   ├── chat/
│   │   │   │   ├── index.tsx      # matches list
│   │   │   │   └── [matchId].tsx  # thread
│   │   │   └── settings.tsx
│   │   └── profile/[userId].tsx
│   ├── (voucher)/                 # separate navigation tree for voucher mode
│   │   ├── (tabs)/
│   │   │   ├── browse.tsx
│   │   │   ├── shortlist.tsx
│   │   │   └── settings.tsx
│   │   └── thread/[vouchId].tsx   # three-way thread only, no 1:1 chat route exists here
│   └── _layout.tsx
│
├── src/
│   ├── features/                  # one folder per screen-domain, UI + local hooks only
│   │   ├── discover/
│   │   │   ├── components/        # CardDeck, SwipeCard, EmptyState
│   │   │   ├── hooks/              # useDiscoverDeck, usePrefetchImages
│   │   │   └── index.ts
│   │   ├── browse/
│   │   ├── chat/
│   │   ├── profile/
│   │   ├── onboarding/
│   │   ├── voucher/
│   │   └── settings/
│   │
│   ├── components/                # cross-feature shared primitives (Button, Avatar, Sheet)
│   │
│   ├── outbox/                    # the durable write path — the most-graded folder
│   │   ├── actions.ts              # discriminated union of all mutating actions
│   │   ├── queue.ts                 # enqueue/dequeue, persistence-backed
│   │   ├── drain.ts                 # single-flight ordered worker, backoff+jitter
│   │   ├── idempotency.ts
│   │   └── outbox.test.ts
│   │
│   ├── realtime/                  # simulated realtime consumption
│   │   ├── eventTypes.ts
│   │   ├── dedupe.ts
│   │   ├── reconcile.ts             # merges events against optimistic local rows
│   │   └── realtime.test.ts
│   │
│   ├── mocks/                      # the simulated network layer (required by the brief)
│   │   ├── server.ts                # request handler: latency/failure/offline knobs
│   │   ├── realtimeChannel.ts       # duplicate/reorder simulation
│   │   ├── seed/
│   │   │   └── profiles.json        # 60+ seeded profiles
│   │   └── devPanelControls.ts      # knobs exposed to the Dev Panel
│   │
│   ├── db/                        # persistence layer — expo-sqlite + drizzle, single source of truth
│   │   ├── client.ts                # expo-sqlite connection + drizzle() instance, opened once
│   │   ├── schema/                  # drizzle table definitions, one file per domain table
│   │   │   ├── outbox.ts
│   │   │   ├── profiles.ts
│   │   │   ├── matches.ts
│   │   │   ├── messages.ts
│   │   │   └── vouches.ts
│   │   ├── migrations/              # drizzle-kit generated SQL migrations, committed to the repo
│   │   │   └── meta/
│   │   ├── migrate.ts                # runs pending migrations on app start
│   │   ├── queries/                 # typed query/mutation functions built on drizzle, grouped by table
│   │   │   ├── outbox.queries.ts
│   │   │   ├── profiles.queries.ts
│   │   │   ├── matches.queries.ts
│   │   │   └── messages.queries.ts
│   │   └── db.test.ts                # schema + migration sanity tests
│   │
│   ├── store/                     # global app state (auth, mode, theme preference)
│   │   └── ...                     # shape depends on chosen library — document choice in SYSTEM-NOTES.md
│   │
│   ├── theme/                     # unistyles theme definitions — single source of design tokens
│   │   ├── tokens.ts                # raw scales: spacing, radius, typography, durations
│   │   ├── themes/
│   │   │   ├── light.ts
│   │   │   └── dark.ts
│   │   ├── breakpoints.ts
│   │   └── unistyles.ts             # StyleSheet.configure() entry point
│   │
│   ├── i18n/                      # English + Arabic strings, RTL config
│   │   ├── en.json
│   │   ├── ar.json
│   │   └── index.ts
│   │
│   ├── devpanel/                  # the Dev Panel UI — required, not optional
│   │   └── DevPanel.tsx
│   │
│   ├── hooks/                     # cross-feature generic hooks (useNetworkStatus, useAppState)
│   │
│   ├── types/                     # shared domain types (Profile, Match, Message, VouchNote)
│   │
│   └── utils/                     # pure helper functions, no side effects
│
├── docs/
│   ├── TECHNICAL.md
│   ├── USER-GUIDE.md
│   ├── DESIGN-PRINCIPLES.md
│   └── SYSTEM-NOTES.md
│
├── .env.example
├── CONVENTIONS.md
├── SKILLS.md
├── PROJECT-STRUCTURE.md
└── README.md
```

## Reasoning

- **`app/` stays thin.** expo-router files only handle routing/layout and wire a feature's container to the URL — they never contain the outbox logic, styling detail, or business rules. This keeps route files short and makes the actual logic testable without mounting navigation.
- **`(member)` and `(voucher)` are separate route groups**, not one tree with conditional rendering of a chat tab. The brief requires role enforcement below the UI — having genuinely separate navigation trees means there is no 1:1 chat route for a voucher to reach in the first place, and the service layer refuses the underlying action independently as a second line of defense.
- **`features/*` vs `components/`**: anything specific to one screen's domain (a swipe card, a message bubble) lives in that feature folder; anything reused across features (a themed `Button`, an `Avatar`) lives in the shared `components/` folder. This avoids the common failure mode of a "shared" folder slowly absorbing everything.
- **`outbox/` and `realtime/` are top-level, not nested under a feature.** They're the most heavily graded part of the app and are consumed by every feature — treating them as shared infrastructure (with their own tests colocated) keeps the write path singular, per the "one write path" requirement.
- **`mocks/` is real application code, not a dev-only stub folder** — it has to behave identically on native and web export, so it's built and shipped like any other module rather than swapped via a bundler alias trick.
- **`db/` is isolated from `store/`.** `db/` is the durable mirror, built on **expo-sqlite + drizzle** — the single source of truth for the outbox and every server-mirrored table (profiles, matches, messages, vouches). `store/` is transient app-level state only (current mode, theme preference, in-memory UI flags) — it never holds a second copy of anything that belongs in a table. Server-mirrored data is always read through typed `db/queries/*` functions, never duplicated into `store/` or fetched ad hoc from a component.
- **`db/schema/` and `db/migrations/` are both committed.** Drizzle schema files are the source of truth for table shape; `drizzle-kit` generates the SQL migrations from them, and migrations are checked into the repo (not regenerated on every machine) so the schema history is reviewable like any other code change. `db/migrate.ts` runs pending migrations once on app start, before any query touches the database.
- **`db/queries/` is the only place raw SQL/drizzle query builders are written.** Features and the outbox drain worker call these typed functions — they never construct a query inline in a component or hook. This keeps the query surface auditable and makes it straightforward to reason about indexes, transactions, and the conflict rule in one place.
- **`theme/` is the only place a color, spacing, radius, or type value is defined.** Every component consumes tokens from here; nothing hardcodes a hex code or a raw pixel value. Light/dark are two parallel files with identical keys so a missing token in one theme is immediately obvious.
- **`devpanel/` is top-level and required**, matching the brief's framing that it isn't a bonus — it's the primary way the app gets graded/broken, so it isn't buried inside `settings/`.
- Tests are colocated with the module they test (`outbox/outbox.test.ts`, `ComponentName.test.tsx`) rather than mirrored in a separate `__tests__` tree, so a file and its test move together during refactors.
