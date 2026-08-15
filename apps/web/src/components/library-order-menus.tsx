import { ArrowDown, ArrowUp, ArrowUpDown, Check, Layers } from "lucide-react";
import type { ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { chooseSort, GROUP_OPTIONS, type LibraryOrder, SORT_OPTIONS } from "@/lib/library-order";
import { cn } from "@/lib/utils";

export interface LibraryOrderMenuProps {
  order: LibraryOrder;
  onOrder: (order: LibraryOrder) => void;
  className?: string;
}

/** The toolbar's shared control shape — the ViewSwitcher's frame, as a menu trigger. */
function MenuTrigger({
  active,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "border-line bg-fill flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium transition-colors",
        active ? "text-you-soft" : "text-muted-foreground hover:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
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
        <MenuTrigger className={className} aria-label={`Sort by ${active?.label}`}>
          <ArrowUpDown size={13} />
          <span className="hidden sm:inline">{active?.label}</span>
          <Dir size={11} className="text-muted-foreground/70" />
        </MenuTrigger>
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
 * Whether — and how — the shelf splits into sections. Read status needs a
 * chosen reader to mean anything, so without one the option says so instead
 * of grouping everything under "Unread".
 */
export function GroupMenu({
  order,
  onOrder,
  readStatusAvailable = true,
  className,
}: LibraryOrderMenuProps & { readStatusAvailable?: boolean }) {
  const active = GROUP_OPTIONS.find((option) => option.key === order.group);
  const grouped = order.group !== "none";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <MenuTrigger
          active={grouped}
          className={className}
          aria-label={grouped ? `Grouped by ${active?.label}` : "Group"}
        >
          <Layers size={13} />
          <span className="hidden sm:inline">{grouped ? active?.label : "Group"}</span>
        </MenuTrigger>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {GROUP_OPTIONS.map((option) => {
          const disabled = option.key === "readstatus" && !readStatusAvailable;
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
