// Vendor patched copy of `expo-sqlite/web/WorkerChannel.ts` (SDK 54, expo-sqlite
// 16.x). The only difference is the synchronous spin loop: the upstream version
// aborts after ~1_000_000 `Atomics.pause` iterations (~a few ms), which is far
// too tight for the FIRST message, where the worker lazily compiles the
// wa-sqlite wasm module and init AccessHandlePoolVFS (OPFS) before answering.
// On every web boot the app's module-scope `openDatabaseSync("vouch.db")` is
// that first message, so upstream throws "Sync operation timeout".
//
// We keep the exact same message protocol/SAB layout (the worker side is
// untouched) but spin against a wall-clock deadline instead of an iteration
// count, so a slow first-time init just makes the page freeze briefly instead
// of failing. Metro redirects `expo-sqlite/web/SQLiteModule.ts`'s import here
// via `resolver.resolveRequest` (see metro.config.js).
//
// Keep in sync with `node_modules/expo-sqlite/web/WorkerChannel.ts`.

import { Deferred } from 'expo-sqlite/web/Deferred';
import { serialize, deserialize } from 'expo-sqlite/web/SyncSerializer';
import {
  type SQLiteWorkerMessageType,
  type MessageTypeMap,
  type ResultType,
  type ResultTypeMap,
} from 'expo-sqlite/web/web.types';

let messageId = 0;
const deferredMap = new Map<number, Deferred>();
const PENDING = 1;
const RESOLVED = 2;

let hasWarnedSync = false;

/**
 * For worker to send result to the main thread.
 */
export function sendWorkerResult({
  id,
  result,
  error,
  syncTrait,
}: {
  id: number;
  result: ResultType | null;
  error: Error | null;
  syncTrait?: {
    lockBuffer: SharedArrayBuffer;
    resultBuffer: SharedArrayBuffer;
  };
}) {
  if (syncTrait) {
    const { lockBuffer, resultBuffer } = syncTrait;
    const lock = new Int32Array(lockBuffer);
    const resultArray = new Uint8Array(resultBuffer);
    const resultJson = error != null ? serialize({ error }) : serialize({ result });
    const resultBytes = new TextEncoder().encode(resultJson);
    const length = resultBytes.length;
    resultArray.set(new Uint32Array([length]), 0);
    resultArray.set(resultBytes, 4);
    Atomics.store(lock, 0, RESOLVED);
  } else {
    if (result) {
      self.postMessage({ id, result });
    } else {
      self.postMessage({ id, error });
    }
  }
}

/**
 * For main thread to handle worker messages.
 */
export function workerMessageHandler(event: MessageEvent) {
  const { id, result, error, isSync } = event.data;
  if (!isSync) {
    const deferred = deferredMap.get(id);
    if (deferred) {
      if (error) {
        deferred.reject(new Error(error));
      } else {
        deferred.resolve(result);
      }
      deferredMap.delete(id);
    }
  }
}

/**
 * For main thread to invoke worker function asynchronously.
 */
export async function invokeWorkerAsync<T extends SQLiteWorkerMessageType & keyof ResultTypeMap>(
  worker: Worker,
  type: T,
  data: MessageTypeMap[T]['data']
): Promise<ResultTypeMap[T]> {
  const id = messageId++;
  const deferred = new Deferred<ResultTypeMap[T]>();
  deferredMap.set(id, deferred);
  worker.postMessage({ type, id, data, isSync: false });
  return deferred.getPromise();
}

/**
 * For main thread to invoke worker function synchronously.
 *
 * Patched: spin until `SYNC_TIMEOUT_MS` elapses instead of aborting after a
 * fixed iteration count, so the worker's one-time wasm/OPFS init is allowed to
 * complete. Same transfer protocol and serialization as upstream.
 */
const SYNC_WARN_MS = 30_000;
const SYNC_TIMEOUT_MS = 90_000;
let warnedSlow = false;

export function invokeWorkerSync<T extends SQLiteWorkerMessageType & keyof ResultTypeMap>(
  worker: Worker,
  type: T,
  data: MessageTypeMap[T]['data']
): ResultTypeMap[T] {
  if (__DEV__ && !hasWarnedSync) {
    console.warn(
      'Using synchronous SQLite operations can cause significant performance impact. Consider using async operations instead.'
    );
    hasWarnedSync = true;
  }

  const id = messageId++;
  const lockBuffer = new SharedArrayBuffer(4);
  const lock = new Int32Array(lockBuffer);
  const resultBuffer = new SharedArrayBuffer(1024 * 1024);
  const resultArray = new Uint8Array(resultBuffer);

  Atomics.store(lock, 0, PENDING);
  worker.postMessage({
    type,
    id,
    data,
    isSync: true,
    lockBuffer,
    resultBuffer,
  });

  const useAtomicsPause = typeof Atomics.pause === 'function';
  const warnAt = Date.now() + SYNC_WARN_MS;
  const deadline = Date.now() + SYNC_TIMEOUT_MS;
  while (Atomics.load(lock, 0) === PENDING) {
    if (Date.now() > deadline) {
      throw new Error(
        `Sync operation timeout (worker did not respond within ${SYNC_TIMEOUT_MS}ms). ` +
          `crossOriginIsolated=${typeof crossOriginIsolated !== 'undefined' ? crossOriginIsolated : 'unavailable'}. ` +
          `On first load the wasm + OPFS + dev-server worker build can be slow; ` +
          'if this repeats, the worker script failed to load (check the browser console for "[expo-sqlite] web worker" errors).'
      );
    }
    if (!warnedSlow && Date.now() > warnAt) {
      warnedSlow = true;
      console.warn(
        `[expo-sqlite] sync op still pending after ${SYNC_WARN_MS}ms — the worker may still be cold-building or stuck; a reload once Metro is warm usually fixes it.`
      );
    }
    if (useAtomicsPause) {
      Atomics.pause();
    }
  }

  const length = new Uint32Array(resultArray.buffer, 0, 1)[0];
  const resultCopy = new Uint8Array(length);
  resultCopy.set(new Uint8Array(resultArray.buffer, 4, length));
  const resultJson = new TextDecoder().decode(resultCopy);
  const { result, error } = deserialize<{ result: ResultTypeMap[T]; error?: string }>(resultJson);
  if (error) throw new Error(error);
  return result;
}