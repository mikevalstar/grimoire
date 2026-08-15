import { useSyncExternalStore } from "react";

/**
 * Which book the details panel is showing, as a tiny global store so anything
 * — a shelf card, the command palette — can open a book without threading a
 * callback down to it. In-memory only: transient UI state, not a preference,
 * so unlike view-mode.ts nothing touches localStorage.
 * See docs/features/command-palette.md and docs/features/book-details-panel.md.
 */

let openId: number | null = null;

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setOpenBookId(id: number | null) {
  openId = id;
  for (const listener of listeners) listener();
}

export function useOpenBookId(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => openId,
    () => null,
  );
}
