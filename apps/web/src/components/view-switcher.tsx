import { LayoutGrid, Rows3 } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { ViewMode } from "@/lib/view-mode";

export interface ViewSwitcherProps {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  className?: string;
}

const VIEWS: { value: ViewMode; label: string; icon: typeof LayoutGrid }[] = [
  { value: "covers", label: "Covers", icon: LayoutGrid },
  { value: "list", label: "List", icon: Rows3 },
];

/**
 * Covers or list — the shape the library is drawn in. Marked with the user
 * accent because which view you're in is your own state, not the library's.
 */
export function ViewSwitcher({ view, onViewChange, className }: ViewSwitcherProps) {
  return (
    <ToggleGroup
      type="single"
      value={view}
      // Radix reports "" when the active item is pressed again; a view is
      // always on, so ignore the deselect rather than render nothing.
      onValueChange={(next) => next && onViewChange(next as ViewMode)}
      aria-label="Library view"
      // spacing keeps each segment its own rounded pill inside the group's
      // frame, instead of the joined-button default.
      spacing={1}
      className={cn("border-line bg-fill rounded-lg border p-0.5", className)}
    >
      {VIEWS.map(({ value, label, icon: Icon }) => (
        <ToggleGroupItem
          key={value}
          value={value}
          aria-label={label}
          className="text-muted-foreground data-[state=on]:bg-you-dim data-[state=on]:text-you-soft h-7 gap-1.5 rounded-md px-2.5 text-[12px] font-medium"
        >
          <Icon size={13} />
          <span className="hidden sm:inline">{label}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
