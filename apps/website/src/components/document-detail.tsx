import { Link } from "@tanstack/react-router";
import type { DocumentDetail } from "../lib/api.ts";
import { StatusBadge, PriorityBadge } from "./status-badge.tsx";

const TYPE_LABELS: Record<string, string> = {
  feature: "Features",
  requirement: "Requirements",
  task: "Tasks",
  decision: "Decisions",
};

const TYPE_ROUTES: Record<string, string> = {
  feature: "/features",
  requirement: "/requirements",
  task: "/tasks",
  decision: "/decisions",
};

function str(val: unknown): string {
  return typeof val === "string" ? val : "";
}

function strArr(val: unknown): string[] {
  return Array.isArray(val) ? (val as string[]) : [];
}

export function DocumentDetailView({ data }: { data: DocumentDetail }) {
  const fm = data.frontmatter;
  const backPath = TYPE_ROUTES[data.type] ?? "/";
  const backLabel = TYPE_LABELS[data.type] ?? data.type;
  const title = str(fm.title);
  const status = str(fm.status);
  const priority = str(fm.priority);
  const created = str(fm.created);
  const updated = str(fm.updated);
  const assignee = str(fm.assignee);
  const tags = strArr(fm.tags);
  const featureId = str(fm.feature);
  const requirementId = str(fm.requirement);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>
        <Link to={backPath as "/"} style={{ color: "#2563eb", textDecoration: "none" }}>
          {backLabel}
        </Link>
        {" / "}
        <span>{title}</span>
      </div>

      {/* Title and badges */}
      <div>
        <h2 style={{ margin: "0 0 0.5rem 0" }}>{title}</h2>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {status && <StatusBadge status={status} />}
          {priority && <PriorityBadge priority={priority} />}
        </div>
      </div>

      {/* Metadata */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: "0.25rem 1rem",
          fontSize: "0.875rem",
          padding: "0.75rem",
          backgroundColor: "#f9fafb",
          borderRadius: "0.5rem",
        }}
      >
        <span style={{ color: "#6b7280" }}>ID</span>
        <span style={{ fontFamily: "monospace", fontSize: "0.8125rem" }}>{data.id}</span>

        {created && (
          <>
            <span style={{ color: "#6b7280" }}>Created</span>
            <span>{created}</span>
          </>
        )}
        {updated && (
          <>
            <span style={{ color: "#6b7280" }}>Updated</span>
            <span>{updated}</span>
          </>
        )}
        {assignee && (
          <>
            <span style={{ color: "#6b7280" }}>Assignee</span>
            <span>{assignee}</span>
          </>
        )}
        {tags.length > 0 && (
          <>
            <span style={{ color: "#6b7280" }}>Tags</span>
            <span>{tags.join(", ")}</span>
          </>
        )}
        {featureId && (
          <>
            <span style={{ color: "#6b7280" }}>Feature</span>
            <Link
              to={`/features/${featureId}` as "/"}
              style={{ color: "#2563eb", textDecoration: "none" }}
            >
              {featureId}
            </Link>
          </>
        )}
        {requirementId && (
          <>
            <span style={{ color: "#6b7280" }}>Requirement</span>
            <Link
              to={`/requirements/${requirementId}` as "/"}
              style={{ color: "#2563eb", textDecoration: "none" }}
            >
              {requirementId}
            </Link>
          </>
        )}
      </div>

      {/* Related documents */}
      <RelatedLinks label="Requirements" ids={strArr(fm.requirements)} type="requirements" />
      <RelatedLinks label="Tasks" ids={strArr(fm.tasks)} type="tasks" />
      <RelatedLinks label="Decisions" ids={strArr(fm.decisions)} type="decisions" />
      <RelatedLinks label="Features" ids={strArr(fm.features)} type="features" />
      <RelatedLinks label="Dependencies" ids={strArr(fm.depends_on)} type="" />

      {/* Body */}
      {data.body && (
        <div
          style={{
            whiteSpace: "pre-wrap",
            fontFamily: "system-ui, sans-serif",
            lineHeight: 1.6,
            fontSize: "0.9375rem",
            borderTop: "1px solid #e5e7eb",
            paddingTop: "1rem",
          }}
        >
          {data.body}
        </div>
      )}
    </div>
  );
}

function RelatedLinks({ label, ids, type }: { label: string; ids: string[]; type: string }) {
  if (ids.length === 0) return null;

  return (
    <div style={{ fontSize: "0.875rem" }}>
      <strong>{label}: </strong>
      {ids.map((id, i) => (
        <span key={id}>
          {i > 0 && ", "}
          {type ? (
            <Link to={`/${type}/${id}` as "/"} style={{ color: "#2563eb", textDecoration: "none" }}>
              {id}
            </Link>
          ) : (
            <span style={{ fontFamily: "monospace" }}>{id}</span>
          )}
        </span>
      ))}
    </div>
  );
}
