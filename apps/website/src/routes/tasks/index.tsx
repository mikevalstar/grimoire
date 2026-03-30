import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodSearchValidator } from "@tanstack/router-zod-adapter";
import { useQuery } from "@tanstack/react-query";
import { fetchDocuments } from "../../lib/api.ts";
import { documentSearchSchema, type DocumentSearch } from "../../lib/search-schema.ts";
import { DocumentList } from "../../components/document-list.tsx";
import { DocumentFilters } from "../../components/document-filters.tsx";

export const Route = createFileRoute("/tasks/")({
  validateSearch: zodSearchValidator(documentSearchSchema),
  component: TasksPage,
});

function TasksPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data, isLoading, error } = useQuery({
    queryKey: ["documents", "task", search],
    queryFn: () => fetchDocuments("task", search),
  });

  function handleUpdate(next: DocumentSearch) {
    void navigate({ search: next, replace: true });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
        <p className="text-sm text-muted-foreground">
          {data ? `${data.count} documents` : "Loading..."}
        </p>
      </div>
      <DocumentFilters type="task" search={search} onUpdate={handleUpdate} />
      {isLoading && <p className="text-muted-foreground">Loading...</p>}
      {error && <p className="text-destructive">Error: {error.message}</p>}
      {data && <DocumentList data={data} search={search} onSort={handleUpdate} />}
    </div>
  );
}
