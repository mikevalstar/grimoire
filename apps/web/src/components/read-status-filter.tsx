import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export type ReadStatusFilterValue = "all" | "to-read" | "read";

export interface ReadStatusFilterProps {
  value: ReadStatusFilterValue;
  onValueChange: (value: ReadStatusFilterValue) => void;
  counts?: Record<ReadStatusFilterValue, number>;
  disabled?: boolean;
  className?: string;
}

const OPTIONS: { value: ReadStatusFilterValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "to-read", label: "To read" },
  { value: "read", label: "Read" },
];

/** The current reader's three-way shelf filter. */
export function ReadStatusFilter({
  value,
  onValueChange,
  counts,
  disabled = false,
  className,
}: ReadStatusFilterProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => next && onValueChange(next as ReadStatusFilterValue)}
      aria-label="Filter books by read status"
      disabled={disabled}
      spacing={1}
      className={cn("border-line bg-fill shrink-0 rounded-lg border p-0.5", className)}
    >
      {OPTIONS.map(({ value: option, label }) => (
        <ToggleGroupItem
          key={option}
          value={option}
          className="group/status text-muted-foreground data-[state=on]:bg-fill-strong data-[state=on]:text-foreground h-7 gap-1.5 rounded-md px-2.5 text-[12px] font-medium data-[state=on]:shadow-[inset_0_1px_0_var(--layer-line)] disabled:opacity-45"
        >
          <span>{label}</span>
          {counts && (
            <span className="text-muted-foreground/60 group-data-[state=on]/status:text-you-soft text-[10px] tabular-nums">
              {counts[option].toLocaleString()}
            </span>
          )}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
