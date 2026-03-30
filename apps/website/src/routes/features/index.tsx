import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchDocuments } from "../../lib/api.ts";
import { DocumentList } from "../../components/document-list.tsx";

export const Route = createFileRoute("/features/")({
  component: FeaturesPage,
});

function FeaturesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["documents", "feature"],
    queryFn: () => fetchDocuments("feature"),
  });

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p style={{ color: "#dc2626" }}>Error: {error.message}</p>;
  if (!data) return null;

  return (
    <div>
      <h2 style={{ margin: "0 0 1rem 0" }}>Features ({data.count})</h2>
      <DocumentList data={data} />
    </div>
  );
}
