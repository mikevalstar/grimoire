import type { QueryClient } from "@tanstack/react-query";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { SetupWizard } from "@/components/setup-wizard";
import { needsSetup } from "@/lib/api";
import { setCurrentUserId, useCurrentUser } from "@/lib/current-user";
import { preferencesQuery, usersQuery, useStartSync, useSyncStatus } from "@/lib/queries";

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

/**
 * Every route renders inside this: first-run setup gates the whole app, so it
 * lives above the outlet rather than on a route of its own.
 */
function RootLayout() {
  const queryClient = useQueryClient();
  const { data: preferences, error, isPending } = useQuery(preferencesQuery);
  const { data: users } = useQuery(usersQuery);
  const currentUser = useCurrentUser();

  // Polled here rather than in the header, so one poll serves the indicator and
  // the settings dialog, and so a finished sync invalidates the library once.
  const { data: syncStatus } = useSyncStatus();
  const startSync = useStartSync();

  if (isPending) return <p>Loading…</p>;
  if (error) return <p>Error: {error.message}</p>;

  if (needsSetup(preferences)) {
    return (
      <SetupWizard
        preferences={preferences}
        existingUsers={users}
        onFinished={({ preferences: saved, users: everyone }) => {
          // Both responses are authoritative — the wizard's list carries any
          // Hardcover links made there — so seed the cache rather than
          // refetching straight into a render.
          queryClient.setQueryData(preferencesQuery.queryKey, saved);
          queryClient.setQueryData(usersQuery.queryKey, everyone);
          // Whoever set the app up is using it.
          const first = everyone[0];
          if (first) setCurrentUserId(first.id);
        }}
      />
    );
  }

  return (
    <AppShell
      user={currentUser}
      users={users}
      onPickUser={(user) => setCurrentUserId(user.id)}
      syncStatus={syncStatus}
      onSync={() => startSync.mutate()}
      bookCount={syncStatus?.bookCount}
    >
      <Outlet />
    </AppShell>
  );
}
