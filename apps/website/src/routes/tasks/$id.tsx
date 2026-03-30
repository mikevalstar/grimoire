import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchDocument } from "../../lib/api.ts";
import { DocumentDetailView } from "../../components/document-detail.tsx";

export const Route = createFileRoute("/tasks/$id")({
  component: TaskDetailPage,
});

function TaskDetailPage() {
  const { id } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["document", "task", id],
    queryFn: () => fetchDocument("task", id),
  });

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p style={{ color: "#dc2626" }}>Error: {error.message}</p>;
  if (!data) return null;

  return <DocumentDetailView data={data} />;
}
