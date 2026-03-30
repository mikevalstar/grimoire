import { Link } from "@tanstack/react-router";
import type { StatusResponse } from "../lib/api.ts";
import { StatusBadge } from "./status-badge.tsx";

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

function CountCard({ label, count, to }: { label: string; count: number; to: string }) {
  return (
    <Link
      to={to as "/"}
      style={{
        padding: "1rem",
        border: "1px solid #e5e7eb",
        borderRadius: "0.5rem",
        textAlign: "center",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div style={{ fontSize: "2rem", fontWeight: 700 }}>{count}</div>
      <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>{label}</div>
    </Link>
  );
}

function HealthIndicator({ label, value, good }: { label: string; value: number; good: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <span style={{ color: good ? "#16a34a" : "#eab308", fontSize: "1.25rem" }}>
        {good ? "\u2713" : "\u26A0"}
      </span>
      <span>
        {label}: <strong>{value}</strong>
      </span>
    </div>
  );
}

export function StatusDashboard({ data }: { data: StatusResponse }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <h2 style={{ margin: 0 }}>Project Status</h2>

      {/* Document counts */}
      <section>
        <h3 style={{ marginTop: 0 }}>Documents</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "0.75rem",
          }}
        >
          <CountCard label="Features" count={data.counts.features} to="/features" />
          <CountCard label="Requirements" count={data.counts.requirements} to="/requirements" />
          <CountCard label="Tasks" count={data.counts.tasks} to="/tasks" />
          <CountCard label="Decisions" count={data.counts.decisions} to="/decisions" />
        </div>
      </section>

      {/* Status breakdown */}
      <section>
        <h3 style={{ marginTop: 0 }}>By Status</h3>
        {Object.entries(data.by_status).map(([type, statuses]) => (
          <div key={type} style={{ marginBottom: "0.5rem" }}>
            <strong>{TYPE_LABELS[type] ?? type}: </strong>
            {Object.entries(statuses).map(([st, cnt]) => (
              <span key={st} style={{ marginRight: "0.75rem" }}>
                <StatusBadge status={st} /> {cnt}
              </span>
            ))}
          </div>
        ))}
      </section>

      {/* Task health */}
      <section>
        <h3 style={{ marginTop: 0 }}>Task Health</h3>
        <div style={{ display: "flex", gap: "2rem" }}>
          <div>
            Open tasks: <strong>{data.open_tasks}</strong>
          </div>
          {data.blocked_tasks > 0 && (
            <div style={{ color: "#dc2626" }}>
              Blocked: <strong>{data.blocked_tasks}</strong>
            </div>
          )}
        </div>
      </section>

      {/* Health indicators */}
      <section>
        <h3 style={{ marginTop: 0 }}>Health</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <HealthIndicator
            label="Orphaned documents"
            value={data.orphaned_documents}
            good={data.orphaned_documents === 0}
          />
          <HealthIndicator
            label={`Stale documents (>${data.stale_threshold_days}d)`}
            value={data.stale_documents}
            good={data.stale_documents === 0}
          />
        </div>
      </section>

      {/* Recent updates */}
      {data.recent.length > 0 && (
        <section>
          <h3 style={{ marginTop: 0 }}>Recent Updates</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}>
                <th style={{ padding: "0.5rem" }}>Updated</th>
                <th style={{ padding: "0.5rem" }}>Type</th>
                <th style={{ padding: "0.5rem" }}>Title</th>
                <th style={{ padding: "0.5rem" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((doc) => (
                <tr key={doc.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "0.5rem", color: "#6b7280" }}>{doc.updated}</td>
                  <td style={{ padding: "0.5rem", color: "#6b7280" }}>{doc.type}</td>
                  <td style={{ padding: "0.5rem" }}>
                    <Link
                      to={`${TYPE_ROUTES[doc.type] ?? "/"}/${doc.id}` as "/"}
                      style={{ color: "#2563eb", textDecoration: "none" }}
                    >
                      {doc.title}
                    </Link>
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    <StatusBadge status={doc.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
