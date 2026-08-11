import { USER_COLORS, type UserColorId } from "@grimoire/core/types";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The 24 reader colours as a swatch grid. A radiogroup rather than 24 buttons
 * so arrow keys walk it and screen readers announce "Indigo, 1 of 24".
 */
export function UserColorPicker({
  value,
  onChange,
  label = "Colour",
  className,
}: {
  /** A USER_COLORS id; anything else simply leaves nothing selected. */
  value: string;
  onChange: (color: UserColorId) => void;
  /** Accessible name for the group as a whole. */
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("grid grid-cols-8 gap-1.5 sm:grid-cols-12", className)}
    >
      {USER_COLORS.map((color) => {
        const selected = color.id === value;
        return (
          <button
            key={color.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={color.name}
            title={color.name}
            // Only the selected swatch is a tab stop; arrows move within.
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(color.id)}
            onKeyDown={(e) => {
              const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
              if (step === 0) return;
              e.preventDefault();
              const at = USER_COLORS.findIndex((c) => c.id === value);
              const next = USER_COLORS[(at + step + USER_COLORS.length) % USER_COLORS.length]!;
              onChange(next.id);
              // Keep the keyboard on the swatch that just became selected.
              const group = e.currentTarget.parentElement;
              group?.querySelector<HTMLButtonElement>(`[aria-label="${next.name}"]`)?.focus();
            }}
            className={cn(
              "ease-spring flex aspect-square items-center justify-center rounded-full transition-transform duration-200",
              selected ? "scale-110" : "hover:scale-110",
            )}
            // The selection ring is the swatch's own colour, which no Tailwind
            // token knows — drawn as an outline so it sits outside the circle.
            style={{
              backgroundColor: color.hex,
              outline: selected ? `2px solid ${color.hex}` : undefined,
              outlineOffset: "2px",
            }}
          >
            {selected && <Check size={12} strokeWidth={3} className="text-white" />}
          </button>
        );
      })}
    </div>
  );
}
