import type { QueryClient } from "@tanstack/react-query";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { SetupDialog } from "@/components/setup-dialog";
import { needsSetup } from "@/lib/api";
import { preferencesQuery } from "@/lib/queries";

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

  if (isPending) return <p>Loading…</p>;
  if (error) return <p>Error: {error.message}</p>;

  if (needsSetup(preferences)) {
    return (
      <SetupDialog
        preferences={preferences}
        // The PUT response is the full new set, so seed the cache with it
        // instead of refetching.
        onSaved={(saved) => queryClient.setQueryData(preferencesQuery.queryKey, saved)}
      />
    );
  }

  return <Outlet />;
}
