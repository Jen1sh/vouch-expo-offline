import { getControlsSnapshot } from "./devPanelControls";

/**
 * Simulated network request handler (REQUIREMENTS §4.4). Stands in for the
 * backend the outbox drains into: honors the Dev-Panel offline toggle, the
 * write-failure rate, and a random per-request latency. Pure JS module — no
 * platform links — so it behaves identically on native and web export.
 */

export type RequestOptions = {
  path: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
};

export class NetworkOfflineError extends Error {
  constructor() {
    super("Network is offline (simulated).");
    this.name = "NetworkOfflineError";
  }
}

export class WriteFailureError extends Error {
  constructor() {
    super("Write failed (simulated write-failure rate).");
    this.name = "WriteFailureError";
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function latencyMs(controls: ReturnType<typeof getControlsSnapshot>): number {
  const span = controls.latencyMaxMs - controls.latencyMinMs;
  return controls.latencyMinMs + Math.round(Math.random() * span);
}

/**
 * The one way to "talk to the server". Rejects with typed errors when the
 * Dev-Panel knobs say so — `NetworkOfflineError` (offline) or
 * `WriteFailureError` (failure-rate roll) — otherwise resolves after the
 * simulated latency. The outbox drain is the only caller; components never
 * reach this directly.
 */
export async function request(options: RequestOptions): Promise<{ ok: true }> {
  const controls = getControlsSnapshot();
  if (controls.offline) {
    throw new NetworkOfflineError();
  }
  if (options.method !== "GET" && Math.random() < controls.writeFailureRate) {
    throw new WriteFailureError();
  }
  await delay(latencyMs(controls));
  return { ok: true };
}