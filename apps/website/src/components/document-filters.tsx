import type { DocumentSearch } from "../lib/search-schema.ts";

const STATUS_OPTIONS: Record<string, string[]> = {
  feature: ["proposed", "in-progress", "complete", "deprecated"],
  requirement: ["draft", "approved", "in-progress", "done", "rejected"],
  task: ["todo", "in-progress", "done", "blocked", "cancelled"],
  decision: ["proposed", "accepted", "rejected", "superseded", "deprecated"],
};

const PRIORITY_OPTIONS = ["critical", "high", "medium", "low"];

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function DocumentFilters({
  type,
  search,
  onUpdate,
}: {
  type: string;
  search: DocumentSearch;
  onUpdate: (search: DocumentSearch) => void;
}) {
  const statuses = STATUS_OPTIONS[type] ?? [];

  return (
    <div className="flex flex-wrap items-center gap-4">
      <FilterSelect
        label="Status"
        value={search.status ?? ""}
        options={[
          { value: "", label: "All statuses" },
          ...statuses.map((s) => ({ value: s, label: s })),
        ]}
        onChange={(status) => onUpdate({ ...search, status: status || undefined })}
      />
      <FilterSelect
        label="Priority"
        value={search.priority ?? ""}
        options={[
          { value: "", label: "All priorities" },
          ...PRIORITY_OPTIONS.map((p) => ({ value: p, label: p })),
        ]}
        onChange={(priority) => onUpdate({ ...search, priority: priority || undefined })}
      />
    </div>
  );
}
