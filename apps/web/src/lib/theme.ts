import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "grimoire.theme";

const listeners = new Set<() => void>();

/**
 * Which theme the document is currently showing. The class on <html> is the
 * source of truth — index.html sets it before first paint so there's no flash,
 * and this module only ever moves it.
 */
function read(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private browsing or a locked-down origin — the theme still applies, it
    // just won't survive a reload.
  }
  for (const listener of listeners) listener();
}

export function useTheme() {
  // Storybook and the desktop shell both render client-side only, but
  // useSyncExternalStore wants a server snapshot regardless.
  const theme = useSyncExternalStore(subscribe, read, () => "dark" as Theme);
  const toggle = useCallback(() => {
    setTheme(read() === "dark" ? "light" : "dark");
  }, []);
  return { theme, setTheme, toggle };
}
