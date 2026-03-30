import { Link } from "@tanstack/react-router";
import type { DocumentListResponse } from "../lib/api.ts";
import { StatusBadge, PriorityBadge } from "./status-badge.tsx";

const TYPE_ROUTES: Record<string, string> = {
  feature: "/features",
  requirement: "/requirements",
  task: "/tasks",
  decision: "/decisions",
};

export function DocumentList({ data }: { data: DocumentListResponse }) {
  const basePath = TYPE_ROUTES[data.type] ?? "/";

  if (data.documents.length === 0) {
    return <p style={{ color: "#6b7280" }}>No documents found.</p>;
  }

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
      <thead>
        <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}>
          <th style={{ padding: "0.5rem" }}>Title</th>
          <th style={{ padding: "0.5rem" }}>Status</th>
          <th style={{ padding: "0.5rem" }}>Priority</th>
          <th style={{ padding: "0.5rem" }}>Updated</th>
        </tr>
      </thead>
      <tbody>
        {data.documents.map((doc) => (
          <tr key={doc.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
            <td style={{ padding: "0.5rem" }}>
              <Link
                to={`${basePath}/${doc.id}` as "/"}
                style={{ color: "#2563eb", textDecoration: "none" }}
              >
                {doc.title}
              </Link>
            </td>
            <td style={{ padding: "0.5rem" }}>
              <StatusBadge status={doc.status} />
            </td>
            <td style={{ padding: "0.5rem" }}>
              <PriorityBadge priority={doc.priority} />
            </td>
            <td style={{ padding: "0.5rem", color: "#6b7280" }}>{doc.updated}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
