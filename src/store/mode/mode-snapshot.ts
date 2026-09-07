import type { AppMode } from "@/src/store/mode/AppModeProvider";

/**
 * Module-level snapshot of the active app mode, fed by `AppModeProvider` so a
 * service layer (the outbox) can enforce §3.7's voucher rule without touching
 * React. The provider is the only writer; the primary guard is still that the
 * voucher tree has no chat route — this is defense in depth for the write path.
 */
let mode: AppMode = "member";

export function setModeSnapshot(next: AppMode): void {
  mode = next;
}

export function getModeSnapshot(): AppMode {
  return mode;
}