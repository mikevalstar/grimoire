import { cn } from "@/lib/utils";

/**
 * The library toolbar's shared control shape — the ViewSwitcher's frame, as a
 * menu trigger. `active` is what a control wears while it is doing something:
 * a chosen grouping, a narrowed set of sources.
 */
export function ToolbarMenuTrigger({
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
