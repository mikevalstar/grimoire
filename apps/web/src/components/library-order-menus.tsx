import { ArrowDown, ArrowUp, ArrowUpDown, Check, Layers } from "lucide-react";
import type { ReactNode } from "react";
import { ToolbarMenuTrigger } from "@/components/toolbar-menu-trigger";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  chooseSort,
  GROUP_OPTIONS,
  type LibraryOrder,
  READER_GROUP_KEYS,
  SORT_OPTIONS,
} from "@/lib/library-order";
import { cn } from "@/lib/utils";

export interface LibraryOrderMenuProps {
  order: LibraryOrder;
  onOrder: (order: LibraryOrder) => void;
  className?: string;
}

/**
 * Which key the shelf sorts by. Choosing the active key again flips the
 * direction — the trigger's arrow says which way it currently runs.
 * See docs/features/library-sort-and-group.md.
 */
export function SortMenu({ order, onOrder, className }: LibraryOrderMenuProps) {
  const active = SORT_OPTIONS.find((option) => option.key === order.sort);
  const Dir = order.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ToolbarMenuTrigger className={className} aria-label={`Sort by ${active?.label}`}>
          <ArrowUpDown size={13} />
          <span className="hidden sm:inline">{active?.label}</span>
          <Dir size={11} className="text-muted-foreground/70" />
        </ToolbarMenuTrigger>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {SORT_OPTIONS.map((option) => {
          const isActive = option.key === order.sort;
          return (
            <DropdownMenuItem
              key={option.key}
              onSelect={() => onOrder(chooseSort(order, option.key))}
              className={cn(isActive && "text-foreground font-medium")}
            >
              {option.label}
              {isActive && (
                <span className="text-muted-foreground ml-auto flex items-center gap-1 text-[11px]">
                  <Dir size={11} />
                  {order.dir === "asc" ? "A→Z" : "Z→A"}
                </span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Whether — and how — the shelf splits into sections. The read-state groupings
 * need a chosen reader to mean anything, so without one those options say so
 * instead of filing the whole library under "Unread".
 */
export function GroupMenu({
  order,
  onOrder,
  readerAvailable = true,
  className,
}: LibraryOrderMenuProps & { readerAvailable?: boolean }) {
  const active = GROUP_OPTIONS.find((option) => option.key === order.group);
  const grouped = order.group !== "none";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ToolbarMenuTrigger
          active={grouped}
          className={className}
          aria-label={grouped ? `Grouped by ${active?.label}` : "Group"}
        >
          <Layers size={13} />
          <span className="hidden sm:inline">{grouped ? active?.label : "Group"}</span>
        </ToolbarMenuTrigger>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {GROUP_OPTIONS.map((option) => {
          const disabled = READER_GROUP_KEYS.has(option.key) && !readerAvailable;
          let hint: ReactNode = null;
          if (disabled) {
            hint = <span className="ml-auto text-[10px]">needs a reader</span>;
          } else if (option.key === order.group) {
            hint = <Check size={13} className="ml-auto" />;
          }
          return (
            <DropdownMenuItem
              key={option.key}
              disabled={disabled}
              onSelect={() => onOrder({ ...order, group: option.key })}
              className={cn(option.key === order.group && "text-foreground font-medium")}
            >
              {option.label}
              {hint}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
