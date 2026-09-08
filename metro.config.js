// Metro config for expo-sqlite + drizzle: lets Metro resolve and inline `.sql`
// migration files, and treat wa-sqlite's `.wasm` as a bundled asset (the web
// build of expo-sqlite loads it from a worker).
//
// Web + expo-sqlite also needs SharedArrayBuffer (the sync worker channel uses
// `new SharedArrayBuffer(...)` for `openDatabaseSync`), which is only defined
// in a `crossOriginIsolated` context. `expo start --web` wires this
// `enhanceMiddleware` into the dev server so the headers are always present
// here; static hosts must set the same two headers on their own (see
// `serve.json` for `npx serve dist`).
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push("sql");
config.resolver.assetExts.push("wasm");

// Web: point the main-thread import of `expo-sqlite/web/WorkerChannel` (from
// `expo-sqlite/web/SQLiteModule.ts`) at our patched copy
// (src/db/web/worker-channel.ts), which waits a wall-clock deadline (with a
// 30s warn / 90s abort) instead of upstream's ~1M-iteration Atomics.pause spin.
// That spin is far too tight for the FIRST message, when the worker lazily
// compiles the wa-sqlite wasm + inits OPFS, so the module-scope
// `openDatabaseSync("vouch.db")` used to throw "Sync operation timeout".
// src/db/web/worker-diagnostics.ts (imported by db/client.ts) additionally
// surfaces sqlite-worker errors that Expo's blob-wrapped worker would
// otherwise swallow. The worker-thread bundle (worker.ts) stays upstream — it
// never spins.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === "./WorkerChannel" &&
    context.originModulePath.endsWith("node_modules/expo-sqlite/web/SQLiteModule.ts")
  ) {
    return {
      type: "sourceFile",
      filePath: require.resolve("./src/db/web/worker-channel.ts"),
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  // credentialless (not require-corp) so cross-origin seed photos (picsum) and
  // other third-party no-cors resources keep loading while SAB is enabled.
  res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
  middleware(req, res, next);
};

module.exports = config;