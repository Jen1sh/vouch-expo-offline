# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

## Stack (verify before assuming)

- Expo SDK **54**, React Native **0.81**, React **19**, TypeScript **5.9**.
- **New Architecture** (`newArchEnabled: true`) and **React Compiler** (`experiments.reactCompiler: true`) are ON.
- Managed workflow: no `android/` or `ios/` dirs committed (gitignored, generated). Config lives in `app.config.ts`.
- Reanimated **4** + `react-native-worklets`; there is **no `babel.config.js`** — the Reanimated Babel plugin is provided automatically via `babel-preset-expo`. Don't add a manual config unless you know why.

## Commands

- Start: `npx expo start` (also `npm run ios|android|web`, `npm start`).
- Lint: `npm run lint` (`expo lint`, flat config in `eslint.config.js`). Run this before finishing changes.
- No typecheck/test script exists; use `npx tsc --noEmit` to typecheck (tsconfig extends `expo/tsconfig.base`, `strict: true`).

## Routing & code layout

- File-based routing via **expo-router** (`main: "expo-router/entry"`). Entry is `app/_layout.tsx`; `app/(tabs)/` is a route group with a tab layout. Typed routes are enabled (`.expo/types` generated; `expo-env.d.ts` is gitignored and regenerated).
- **Path alias**: `@/*` maps to repo root (e.g. `@/components/...`, `@/constants/theme`). Use it for imports.
- **Platform-specific files**: identical basename with platform suffix is resolved by platform (`icon-symbol.ios.tsx` vs `icon-symbol.tsx`; `use-color-scheme.web.ts` vs `use-color-scheme.ts`). iOS/Android/web select the right file automatically.
- App uses native **SF Symbols on iOS** and **MaterialIcons on Android/web**. `components/ui/icon-symbol.tsx` holds a `MAPPING` that must be extended to add new SF Symbol → Material icon pairs.

## Conventions

- Theming is set up via **react-native-unistyles** in `src/theme/` (`tokens.ts`, `themes/light.ts` + `dark.ts`, `breakpoints.ts`, `unistyles.ts` config, barrel `index.ts`). Fonts (Newsreader + Plus Jakarta Sans) load in `app/_layout.tsx` via `expo-font`. Use themed `StyleSheet.create(theme => …)`; use `useTheme()` only for raw tokens passed to non-style props. `constants/theme.ts` and `hooks/use-theme-color.ts` were removed — don't reintroduce them.
- Starter files (hello-wave, parallax-scroll-view, explore tab, modal) were default template code and have been removed — they were never real features. Don't treat template remnants as canonical.
- `CLAUDE.md` just imports `@AGENTS.md`; keep their guidance in sync.

## Work references (authoritative for this repo)

These four files are the source of truth for what to build and how. Read them before any feature work; they override generic Expo defaults.

- **`.opencode/rules/CONVENTIONS.md`** — binding code rules: TS strictness (no `any`), file/naming, component conventions, conditional-rendering, theming via react-native-unistyles (no hardcoded values, themed `StyleSheet.create(theme => ...)`, no `useUnistyles()` except on pure leaves), state/persistence/outbox rules, testing, commits.
- **`.opencode/rules/PROJECT-STRUCTURE.md`** — target folder layout: thin `app/` routes, `src/features/*`, `src/outbox/` (durable write path), `src/realtime/`, `src/mocks/` (simulated network), `src/db/` (expo-sqlite + drizzle), `src/store/`, `src/theme/`, `src/devpanel/`, `docs/*`. New code goes in the matching folder.
- **`.opencode/skills/SKILLS.md`** — step-by-step playbooks for recurring tasks (themed components, outbox actions, drizzle schema, screens/routes, theme tokens, realtime events, os notes, audits, interruption-safety). Follow the matching skill in order.
- **`.opencode/skills/REQUIREMENTS.md`** — single source of truth for scope and definition of done: offline-first intro app, member/voucher roles, outbox + simulated network + Dev Panel, three canonical interruption-safety scenarios. Wins on scope when it conflicts with the others.
- **`.opencode/skills/DESIGN.md`** — the design system: "Warm Editorial Trust" palette/tokens (slate charcoal, warm amber, emerald), typography (Newsreader serif + Plus Jakarta Sans), spacing/radius/elevation, and component specs (swipe cards, vouches, member/voucher mode, offline sync pill, Dev Panel). Source of truth for visual style; translate its tokens into the unistyles theme per `CONVENTIONS.md` §6.

Note: these describe the target architecture (expo-sqlite + drizzle outbox, unistyles, `src/` layout) that is **not yet present** in the current starter-template code — build toward it rather than assume it exists.

## External skills

Installed design/RN reference skills live in **`.agents/skills/`** (project-level, auto-discovered by opencode): `mobile-design` (RubenGlez), `frontend-design` (anthropics), and the 9-skill `margelo/react-native-skills` collection. `mobile-design` is the authority for platform-correct RN/Expo UI; the margelo native-module skills (swift/kotlin/cpp/nitro/vision-camera/mmkv) don't apply to this managed Expo + drizzle stack — ignore them unless custom native modules are added. Manage them via `npx skills` (see `skills-lock.json`).
