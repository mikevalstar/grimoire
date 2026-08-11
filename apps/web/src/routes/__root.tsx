import type { QueryClient } from "@tanstack/react-query";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { SetupWizard } from "@/components/setup-wizard";
import { needsSetup } from "@/lib/api";
import { setCurrentUserId, useCurrentUser } from "@/lib/current-user";
import { preferencesQuery, usersQuery } from "@/lib/queries";

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

  if (isPending) return <p>Loading…</p>;
  if (error) return <p>Error: {error.message}</p>;

  if (needsSetup(preferences)) {
    return (
      <SetupWizard
        preferences={preferences}
        existingUsers={users}
        onFinished={({ preferences: saved, users: created }) => {
          // Both responses are authoritative, so seed the cache rather than
          // refetching straight into a render.
          queryClient.setQueryData(preferencesQuery.queryKey, saved);
          queryClient.setQueryData(usersQuery.queryKey, [...(users ?? []), ...created]);
          // Whoever set the app up is using it.
          const first = users?.[0] ?? created[0];
          if (first) setCurrentUserId(first.id);
        }}
      />
    );
  }

  return (
    <AppShell user={currentUser}>
      <Outlet />
    </AppShell>
  );
}
