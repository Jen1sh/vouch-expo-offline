// Web-only diagnostics for the expo-sqlite SQLiteModule web worker.
//
// expo-sqlite's `getWorker()` attaches only a `message` listener. When the
// worker fails to load (or errors at runtime), the browser fires `error`
// events that expo-sqlite ignores, so the failure is invisible and instead
// surfaces much later as a misleading "Sync operation timeout" from the main
// thread's spin loop. Metro also wraps the worker in a blob shim
// (`makeWorkerContent` + `importScripts`), which hides the real script URL.
//
// This module wraps `Worker.prototype.addEventListener` so that the FIRST
// sqlite worker (detected by its `message` listener registration) also gets
// `error`/`messageerror` listeners that log to the browser console. Import for
// side effect BEFORE any SQLite open (see src/db/client.ts). No-op on native.

type WorkerListener = (event: Event) => void;

type BoundAddEventListener = (
  this: Worker,
  type: string,
  listener: WorkerListener,
  ...rest: unknown[]
) => void;

let diagnosticsAttached = false;

if (typeof Worker !== "undefined" && typeof Worker.prototype.addEventListener === "function") {
  const originalAddEventListener = Worker.prototype.addEventListener.bind(
    Worker.prototype
  ) as unknown as BoundAddEventListener;

  Worker.prototype.addEventListener = function (
    type: string,
    listener: WorkerListener,
    ...rest: unknown[]
  ): void {
    if (!diagnosticsAttached && type === "message") {
      diagnosticsAttached = true;
      originalAddEventListener.call(this, "error", (event) => {
        const detail = (event as ErrorEvent).message ?? event;
        console.error("[expo-sqlite] web worker failed to load or errored:", detail);
      });
      originalAddEventListener.call(this, "messageerror", (event) => {
        const detail = (event as { data?: unknown }).data ?? event;
        console.error("[expo-sqlite] web worker messageerror:", detail);
      });
    }
    return originalAddEventListener.call(this, type, listener, ...rest);
  };
}