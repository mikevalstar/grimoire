import { Search, X } from "lucide-react";
import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface LibraryQuickFilterProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/** The filter bar's immediate, browser-side metadata search. */
export function LibraryQuickFilter({ value, onChange, className }: LibraryQuickFilterProps) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className={cn("relative min-w-32 flex-1 sm:max-w-72", className)}>
      <Search
        aria-hidden="true"
        size={14}
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
      />
      <Input
        ref={input}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Quick filter books"
        placeholder="Filter books…"
        autoComplete="off"
        spellCheck={false}
        className="border-line bg-fill h-8 rounded-lg pr-8 pl-8 text-[12px] shadow-none"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear quick filter"
          title="Clear quick filter"
          onClick={() => {
            onChange("");
            input.current?.focus();
          }}
          className="text-muted-foreground hover:bg-layer-fill-strong hover:text-foreground absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm transition-colors"
        >
          <X aria-hidden="true" size={13} />
        </button>
      )}
    </div>
  );
}
