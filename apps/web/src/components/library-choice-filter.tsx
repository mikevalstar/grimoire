import type { LucideIcon } from "lucide-react";
import { useMemo } from "react";
import type { MarkIcon } from "@/components/book-marks";
import { ToolbarMenuTrigger } from "@/components/toolbar-menu-trigger";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Which options the shelf is narrowed to. Empty means *all* rather than none:
 * a filter nobody has touched shows everything, and so does one whose last
 * checkbox was just cleared (docs/features/library-source-filter.md).
 */
export type ChoiceFilterValue = readonly string[];

export interface ChoiceOption {
  value: string;
  label: string;
  icon?: MarkIcon;
}

export interface LibraryChoiceFilterProps {
  /** What is being chosen between, singular and plural: "source" / "sources". */
  noun: { one: string; many: string };
  icon: LucideIcon;
  /** The options present in the library — never a fixed list. */
  options: readonly ChoiceOption[];
  value: ChoiceFilterValue;
  onValueChange: (value: string[]) => void;
  className?: string;
}

/**
 * The filter bar's multi-select shape, shared by the source and format
 * filters: a dropdown of checkboxes over the options the library actually
 * holds, with an "All …" reset on top. Renders nothing at all when there is
 * only one option — there is no choice to offer
 * (docs/features/library-source-filter.md, docs/features/library-format-filter.md).
 */
export function LibraryChoiceFilter({
  noun,
  icon: Icon,
  options,
  value,
  onValueChange,
  className,
}: LibraryChoiceFilterProps) {
  // Only options still present can be selected, so one that leaves the
  // library can't keep filtering it out invisibly.
  const selected = useMemo(
    () => value.filter((one) => options.some((option) => option.value === one)),
    [value, options],
  );
  const filtered = selected.length > 0 && selected.length < options.length;

  if (options.length < 2) return null;

  const toggle = (choice: string, checked: boolean) => {
    const next = checked ? [...selected, choice] : selected.filter((one) => one !== choice);
    // Clearing the last one means "all" again — an empty shelf is never what
    // unchecking a box was asking for.
    onValueChange(next.length === options.length ? [] : next);
  };

  const labelOf = (choice: string) =>
    options.find((option) => option.value === choice)?.label ?? choice;
  const capitalise = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
  const label = filtered
    ? selected.length === 1
      ? labelOf(selected[0])
      : `${selected.length} ${noun.many}`
    : capitalise(noun.one);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ToolbarMenuTrigger
          active={filtered}
          className={cn(filtered && "border-you/40 bg-you-dim", className)}
          aria-label={
            filtered
              ? `${capitalise(noun.many)}: ${selected.map(labelOf).join(", ")}`
              : `Filter by ${noun.one}`
          }
        >
          <Icon size={13} />
          <span className="hidden sm:inline">{label}</span>
        </ToolbarMenuTrigger>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuCheckboxItem
          checked={!filtered}
          onSelect={(event) => event.preventDefault()}
          onCheckedChange={() => onValueChange([])}
          className={cn(!filtered && "text-foreground font-medium")}
        >
          All {noun.many}
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {options.map(({ value: choice, label: name, icon: OptionIcon }) => {
          const checked = selected.includes(choice);
          return (
            <DropdownMenuCheckboxItem
              key={choice}
              checked={checked}
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={(next) => toggle(choice, next === true)}
              className={cn(checked && "text-foreground font-medium")}
            >
              {OptionIcon && (
                <OptionIcon size={13} aria-hidden="true" className="text-muted-foreground" />
              )}
              {name}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
