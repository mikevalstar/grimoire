import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchStatus } from "../lib/api.ts";
import { StatusDashboard } from "../components/status-dashboard.tsx";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["status"],
    queryFn: fetchStatus,
  });

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;
  if (error) return <p className="text-destructive">Error: {error.message}</p>;
  if (!data) return null;

  return <StatusDashboard data={data} />;
}
