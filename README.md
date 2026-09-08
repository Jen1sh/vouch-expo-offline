# Vouch

**Vouch** is a fictional, offline-first introductions app built with Expo SDK 54 (React Native 0.81, React 19, TypeScript, New Architecture enabled). There is no real backend — a simulated network layer stands in for one and behaves identically on native and web. The app is a study in offline durability: every mutating action goes through a durable outbox, applies optimistically to local state, and drains to the simulated server once connectivity returns.

## What it does

One account, two roles on the same login:

- **Member** — browses people through a hand-written swipe deck (Reanimated + Gesture Handler on the UI thread) and a filterable list, chats with matches, and sends messages with visible optimistic states (`queued → sending → sent`, or `failed` with retry/delete).
- **Voucher** — browses candidates on someone else's behalf, shortlists them with a vouch note (debounced, 200-char cap), and reads a three-way thread. Vouchers cannot open a 1:1 chat; the route doesn't exist in the voucher tree and the chat service layer refuses a voucher-mode call regardless.

Everything works offline. Actions are queued and drained in strict order, one attempt at a time, with exponential backoff + jitter, a client-generated idempotency key per action, and permanent failure surfaced in the UI.

## Key systems

| System | Where | What it does |
| --- | --- | --- |
| Persistence | `src/db/` | expo-sqlite + drizzle schema, migrations, and queries; the outbox and every server-mirrored table live here |
| Outbox | `src/outbox/` | durable write path — single-flight, ordered drain with backoff and idempotency |
| Simulated network | `src/mocks/` | in-repo server stand-in: 60 seeded profiles, configurable latency / write-failure / duplicate rate, offline toggle |
| Real-time | `src/realtime/` | pushes `new match`, `message`, `typing`, `profile updated` events; client dedupes by event id and reconciles against optimistic rows |
| Dev Panel | `src/devpanel/` | in-app panel exposing network knobs, sign-in code, forced events, auto-reply toggle, outbox dump, and wipe |
| UI | `src/theme/`, `src/features/` | react-native-unistyles theme (Warm Editorial Trust palette), schema-driven onboarding, i18n (English + Arabic with RTL), SF Symbols on iOS / MaterialIcons elsewhere, settings with theme/language/data-wipe |

## Development

Requirements and design decisions are tracked in the docs under `.opencode/` (see `AGENTS.md`) and `docs/TECHNICAL.md`.

```bash
npm install          # install dependencies
npx expo start       # start dev server (also: npm run ios|android|web)
npm run lint         # expo lint
npx tsc --noEmit     # typecheck (no test-era typecheck script exists)
npx jest             # run the test suite (no device needed)
```

The test suite (39 files) covers the outbox, simulated network, realtime dedupe/reconciliation, onboarding schema, and core components — including the offline → 5 actions → online → drain integration test. Coverage is tracked on the sync/outbox modules.