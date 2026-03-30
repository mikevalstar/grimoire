import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchDocuments } from "../../lib/api.ts";
import { DocumentList } from "../../components/document-list.tsx";

export const Route = createFileRoute("/decisions/")({
  component: DecisionsPage,
});

function DecisionsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["documents", "decision"],
    queryFn: () => fetchDocuments("decision"),
  });

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;
  if (error) return <p className="text-destructive">Error: {error.message}</p>;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Decisions</h1>
        <p className="text-sm text-muted-foreground">{data.count} documents</p>
      </div>
      <DocumentList data={data} />
    </div>
  );
}
