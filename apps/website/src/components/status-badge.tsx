const STATUS_COLORS: Record<string, string> = {
  "in-progress": "#2563eb",
  todo: "#eab308",
  draft: "#eab308",
  proposed: "#eab308",
  done: "#16a34a",
  complete: "#16a34a",
  accepted: "#16a34a",
  approved: "#16a34a",
  blocked: "#dc2626",
  rejected: "#dc2626",
  deprecated: "#6b7280",
  cancelled: "#6b7280",
  superseded: "#6b7280",
};

export function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "#6b7280";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.125rem 0.5rem",
        borderRadius: "9999px",
        fontSize: "0.75rem",
        fontWeight: 500,
        color: "white",
        backgroundColor: color,
      }}
    >
      {status}
    </span>
  );
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#dc2626",
  high: "#ea580c",
  medium: "#eab308",
  low: "#6b7280",
};

export function PriorityBadge({ priority }: { priority: string }) {
  const color = PRIORITY_COLORS[priority] ?? "#6b7280";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.125rem 0.5rem",
        borderRadius: "9999px",
        fontSize: "0.75rem",
        fontWeight: 500,
        color: "white",
        backgroundColor: color,
      }}
    >
      {priority}
    </span>
  );
}
