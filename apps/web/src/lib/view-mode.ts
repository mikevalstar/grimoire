import { useCallback, useSyncExternalStore } from "react";

/**
 * Which shape the library is drawn in. Per-device like the theme, not a stored
 * preference: a phone browsing the same library may well want covers while the
 * desktop wants the table. See docs/features/book-list.md.
 */
export type ViewMode = "covers" | "list";

const STORAGE_KEY = "grimoire.view";
const DEFAULT: ViewMode = "covers";

const listeners = new Set<() => void>();

function read(): ViewMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === "list" ? "list" : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setViewMode(view: ViewMode) {
  try {
    localStorage.setItem(STORAGE_KEY, view);
  } catch {
    // Private browsing — the choice just won't survive a reload.
  }
  for (const listener of listeners) listener();
}

export function useViewMode(): [ViewMode, (view: ViewMode) => void] {
  const view = useSyncExternalStore(subscribe, read, () => DEFAULT);
  return [view, useCallback(setViewMode, [])];
}
