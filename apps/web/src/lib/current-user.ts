import { useCallback, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@/lib/api";
import { usersQuery } from "@/lib/queries";

/**
 * Who is using this device. Per ADR 0008 this is a convenience, not a
 * credential: it lives in localStorage, anyone can change it, and the API
 * trusts whoever the header names.
 */

const STORAGE_KEY = "grimoire.user";

const listeners = new Set<() => void>();

function read(): number | null {
  try {
    const stored = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isInteger(stored) && stored > 0 ? stored : null;
  } catch {
    return null;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setCurrentUserId(id: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(id));
  } catch {
    // Private browsing — the choice just won't survive a reload.
  }
  for (const listener of listeners) listener();
}

export function useCurrentUserId(): number | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

/**
 * The stored reader, resolved against the user list — falling back to the
 * first reader when the stored id is missing or points at someone who's gone.
 */
export function useCurrentUser(): User | undefined {
  const id = useCurrentUserId();
  const { data: users } = useQuery(usersQuery);
  return users?.find((user) => user.id === id) ?? users?.[0];
}

/** Stable identity for callers that only want the setter. */
export function useSetCurrentUser() {
  return useCallback((user: User) => setCurrentUserId(user.id), []);
}
