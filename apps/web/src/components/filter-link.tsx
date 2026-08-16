import type { FilterField } from "@/lib/book-filter";
import { cn } from "@/lib/utils";

export interface FilterLinkProps {
  field: FilterField;
  /** The name as the book carries it — what the reader sees and what gets filtered on. */
  value: string;
  /**
   * Narrow the shelf to it. Without this the name is plain text, which is what
   * a surface with nowhere to send the click wants.
   */
  onFilter?: (field: FilterField, value: string) => void;
  className?: string;
}

/**
 * An author or series name that filters the library when clicked
 * (docs/features/library-quick-filter.md).
 *
 * A button rather than a link: it changes how the shelf behind it is narrowed,
 * and the URL it produces is written by whoever owns that state — the name
 * itself doesn't know the route. It inherits its type from the line it sits
 * in, because it *is* that line; only the hover says it can be clicked.
 *
 * No tooltip: an underlined author's name under a cover is the oldest link on
 * the web, and a box saying so on every card is noise.
 */
export function FilterLink({ field, value, onFilter, className }: FilterLinkProps) {
  if (!onFilter) return <>{value}</>;
  return (
    <button
      type="button"
      onClick={() => onFilter(field, value)}
      className={cn(
        "hover:text-foreground focus-visible:ring-ring/50 rounded-xs underline-offset-2 transition-colors hover:underline focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
    >
      {value}
    </button>
  );
}
