import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchDocument } from "../../lib/api.ts";
import { DocumentDetailView } from "../../components/document-detail.tsx";

export const Route = createFileRoute("/features/$id")({
  component: FeatureDetailPage,
});

function FeatureDetailPage() {
  const { id } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["document", "feature", id],
    queryFn: () => fetchDocument("feature", id),
  });

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p style={{ color: "#dc2626" }}>Error: {error.message}</p>;
  if (!data) return null;

  return <DocumentDetailView data={data} />;
}
