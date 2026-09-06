# Conventions

These are binding rules for any code generated or edited in this repo. If a change would violate one of these, stop and flag it instead of guessing.

## 1. General principles

- Correctness and clarity over cleverness. Prefer boring, explicit code to dense one-liners.
- No dead code, no commented-out blocks, no TODOs without an owner and a reason.
- Every file should be understandable on its own — a reviewer opens it and knows what it does without chasing three other files first.
- Small, focused modules. If a file is doing two unrelated jobs, split it.
- Prefer composition over inheritance, and pure functions over stateful helpers wherever the logic allows it.

## 2. TypeScript

- `strict: true` everywhere. No `any`, no `as any`, no `@ts-ignore` — if a type genuinely can't be known, model it with `unknown` and narrow it.
- No implicit `any` from untyped third-party modules — write a minimal `.d.ts` instead of suppressing.
- Prefer `type` for data shapes and unions, `interface` only when you need declaration merging or you're describing an object that will be extended.
- Discriminated unions for anything with a "kind"/"status"/"type" field (outbox item state, message state, sync result) — never a loose object with optional fields standing in for a state machine.
- No enums for simple string sets — use `as const` string literal unions instead; they're erased at compile time and play nicer with discriminated unions.
- Exhaustiveness: every `switch` over a union ends with a `default: assertNever(x)` helper so a new case fails to compile until it's handled.

## 3. File & naming conventions

- `PascalCase` for components and their files (`ProfileCard.tsx`), `camelCase` for hooks, utils, and non-component modules (`useOutboxQueue.ts`, `formatDistance.ts`).
- One component per file, file name matches the default export.
- Barrel files (`index.ts`) only at feature-folder boundaries, never inside a folder to re-export siblings you could just import directly — they hide real dependencies and slow down tooling.
- Colocate a component's styles, types, and tests next to it (`ProfileCard.tsx`, `ProfileCard.styles.ts`, `ProfileCard.test.tsx`), not in a parallel mirrored tree.
- Absolute imports from a single root alias (`@/`) — no `../../../..` chains.

## 4. Component conventions

- Function components only. No class components anywhere in the app.
- Props typed with an explicit `type Props = {...}` above the component, never inline destructured generics.
- No default exports for anything except the component file itself and route files expo-router requires — utils, hooks, and types use named exports so refactors and auto-imports stay honest.
- Keep components dumb where possible: presentational components take data and callbacks as props; screens/containers own data-fetching, outbox dispatch, and navigation.
- A component that needs more than ~150 lines is a sign it should be split into subcomponents or a container + view pair.

## 5. Conditional rendering

- Never rely on `&&` with a value that can be falsy-but-not-boolean (`0`, `""`, `NaN`). `count && <Badge/>` will render a literal `0` — always coerce first: `count > 0 && <Badge/>`, or better, use a ternary that resolves to `null` explicitly:
  ```tsx
  {isLoading ? <Spinner /> : <Content />}
  {hasError ? <ErrorState /> : null}
  ```
- No nested ternaries in JSX. Two branches, fine. Three or more — extract a small function or an early return above the `return` statement instead of chaining `? :`.
- Prefer early returns at the top of a component for loading/error/empty states over wrapping the whole JSX tree in conditionals:
  ```tsx
  if (isLoading) return <Spinner />;
  if (error) return <ErrorState error={error} />;
  if (items.length === 0) return <EmptyState />;
  return <List items={items} />;
  ```
- List rendering always has a stable, meaningful `key` (an id, never the array index) and an explicit empty-state branch — don't let an empty array silently render nothing with no explanation to the user.

## 6. Styling & theming — react-native-unistyles

This project uses **react-native-unistyles** (v3+) for all styling. Vanilla `StyleSheet.create` habits do not carry over cleanly — follow these rules exactly.

### 6.1 No hardcoded values, ever
- No hex codes, no raw `px`/`rgba()`/`#fff`-style literals inside a component or a style object. Every color, spacing value, radius, font size, and line height comes from the theme's token set (`theme.colors.*`, `theme.spacing.*`, `theme.radius.*`, `theme.typography.*`).
- If a token you need doesn't exist yet, add it to the theme definition first — don't reach for a literal as a shortcut. One source of truth for design values, full stop.
- Light and dark themes are two token maps with identical keys. A new token is added to both at the same time.

### 6.2 Styling API — the themed `StyleSheet.create` function, not the hook
- Default pattern: define styles with unistyles' `StyleSheet.create(theme => ({ ... }))` at module scope, outside the component. This is a compile-time-transformed style sheet — it updates on theme/breakpoint change **without re-rendering the component that uses it**.
  ```tsx
  const styles = StyleSheet.create((theme, rt) => ({
    card: {
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
    },
  }));
  ```
- **Avoid `useUnistyles()` / `useStyles()` at all cost.** That hook subscribes the component to theme changes and forces a re-render on every theme/runtime change. Only reach for it when:
  - the component is a small, pure leaf that renders nothing expensive (no lists, no gestures, no children with their own state), **and**
  - you genuinely need a raw theme value outside of a `style` prop — e.g. passing a color into a non-style prop like an icon's `color`, a chart library, or a native module argument that isn't a style object.
  - Document the reason in a one-line comment above the hook call so a reviewer doesn't "helpfully" convert it back into a themed stylesheet function and vice versa.
- If you're tempted to use the hook just to read one color for a `style` prop, don't — express it as a variant or a dynamic function style instead (below).

### 6.3 No inline array styles for conditional styling
- Vanilla RN encourages `style={[styles.base, isActive && styles.active]}`. **Don't do this here.** It re-evaluates the array every render, silently allows falsy values (`false`/`undefined`) to sit in the array, and bypasses unistyles' compile-time optimizations.
- Use unistyles **variants** for discrete conditional style sets:
  ```tsx
  const styles = StyleSheet.create((theme) => ({
    card: {
      backgroundColor: theme.colors.surface,
      variants: {
        active: {
          true: { borderColor: theme.colors.accent },
          false: { borderColor: theme.colors.border },
        },
        size: {
          sm: { padding: theme.spacing.sm },
          md: { padding: theme.spacing.md },
        },
      },
    },
  }));

  styles.useVariants({ active: isActive, size: 'md' });
  ```
- Use a **dynamic function style** for continuous/computed values (an animated offset, a value from props) rather than composing an array:
  ```tsx
  const styles = StyleSheet.create((theme) => ({
    bar: (progress: number) => ({
      width: `${progress}%`,
      backgroundColor: theme.colors.accent,
    }),
  }));
  ```
- If two style objects genuinely need to be merged structurally (rare — e.g. a caller-supplied `style` prop merged with a base style), merge them into a single object explicitly, don't lean on the array shorthand.

### 6.4 Breakpoints & platform
- Responsive/platform differences go through unistyles breakpoints (`theme.breakpoints`) or `rt` (runtime), not `Platform.OS === 'ios' ? ... : ...` scattered through components. Centralize platform-specific tokens in the theme where possible.

## 7. State management

- Server-mirror state (profiles, matches, messages) lives in the persistence layer (expo-sqlite via drizzle) and is read through `db/queries/*` selectors — not duplicated ad hoc into component state.
- Ephemeral UI state (form input, toggle, animation value) stays local (`useState`/reanimated shared values). Don't lift it into global state "just in case."
- Global app state (auth, current mode, theme preference) uses whichever library is chosen for the project (document the choice and why in `SYSTEM-NOTES.md`) — but never two different state libraries doing overlapping jobs.

## 8. Persistence — expo-sqlite + drizzle

This project persists the outbox and every server-mirrored table (profiles, matches, messages, vouches) in **SQLite via expo-sqlite, accessed through drizzle**. No MMKV, no AsyncStorage, no hand-rolled key/value storage standing in for a relational table.

- One drizzle schema file per domain table under `db/schema/`, with explicit column types — no `text` columns silently carrying JSON blobs when a proper column or a related table would do.
- Schema changes always go through `drizzle-kit` to generate a migration file; migrations are committed to the repo and run once on app start via `db/migrate.ts`. Never hand-edit the SQLite file shape outside of a migration.
- All reads and writes go through typed functions in `db/queries/*` built on drizzle's query builder — no raw SQL strings scattered through features, and no query logic inlined into a component or hook.
- Reach for a transaction (drizzle's `db.transaction()`) for any write that touches more than one table or must be atomic with an outbox enqueue — e.g. writing a new message row and enqueuing its outbox action happen in the same transaction, not as two separate calls that could partially fail.
- Prefer indexed lookups over full-table scans for anything read on a list screen (matches by user, messages by match, outbox items by status) — add the index in the schema, don't compensate with in-memory filtering of a full table load.
- The "better data management than fetching from local storage" this gives us cuts both ways: use it. Query only the columns/rows a screen needs (`select` narrow, `where` on indexed columns) rather than loading a whole table into memory and filtering in JS.

## 9. Data & outbox layer

- Every mutation goes through the single outbox write path — no component calls a "network" function directly.
- No `any` in the sync/outbox layer, no exceptions. Every action has a typed discriminated-union shape and a typed idempotency key, and both the outbox queue and its idempotency keys are persisted as real drizzle-backed tables, not an in-memory array.
- Selectors/hooks that read from the local store must not cause a re-render for rows the caller doesn't care about — memoize and select narrowly (e.g. `useOutboxItem(id)` not `useOutboxState()` returning the whole queue into a list row), backed by a narrow drizzle query rather than filtering a full result set in the hook.

## 9. Error handling

- No silent `catch {}`. Every catch either recovers, logs with context, or rethrows a typed error.
- User-facing errors are mapped to a small closed set of UI states (`ErrorState`, inline field error, toast) — never a raw error message rendered straight from an exception.

## 10. Testing

- Co-locate tests next to source (`*.test.ts(x)`).
- Unit test pure logic (outbox ordering, backoff, dedupe) without mounting components.
- Component tests use Testing Library, assert on behavior/output the user can see, not on internal state or implementation details.
- No snapshot tests as the sole assertion for anything with logic — snapshots are fine as a supplement, never as the only check.

## 11. Git & commits

- Small, logically scoped commits with an imperative summary (`Add outbox retry backoff`, not `fix stuff` or `wip`).
- No single "final" commit dumping the whole app. History should read like the work happened incrementally.
