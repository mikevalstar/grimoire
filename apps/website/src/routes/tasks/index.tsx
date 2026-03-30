import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchDocuments } from "../../lib/api.ts";
import { DocumentList } from "../../components/document-list.tsx";

export const Route = createFileRoute("/tasks/")({
  component: TasksPage,
});

function TasksPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["documents", "task"],
    queryFn: () => fetchDocuments("task"),
  });

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p style={{ color: "#dc2626" }}>Error: {error.message}</p>;
  if (!data) return null;

  return (
    <div>
      <h2 style={{ margin: "0 0 1rem 0" }}>Tasks ({data.count})</h2>
      <DocumentList data={data} />
    </div>
  );
}
