import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** A keycap. Sized to sit inline in 13px text without pushing the line box. */
function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "border-line bg-fill-strong text-muted-foreground inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border px-1.5 font-sans text-[10px] font-medium",
        className,
      )}
      {...props}
    />
  );
}

export { Kbd };
