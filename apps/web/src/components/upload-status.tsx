import { AlertCircle, Check, Copy, Loader2, X } from "lucide-react";
import type { UploadItem } from "@/lib/upload-queue";
import { cn } from "@/lib/utils";

export interface UploadStatusProps {
  items: readonly UploadItem[];
  /** Clear the finished entries. Anything still moving stays. */
  onDismiss: () => void;
  /** Open the book an upload landed in. */
  onOpenBook?: (bookId: number) => void;
  className?: string;
}

const OUTCOME = {
  added: { icon: Check, text: "Added" },
  existing: { icon: Copy, text: "Already in the library" },
  failed: { icon: AlertCircle, text: "Refused" },
} as const;

/**
 * The strip at the bottom of the window while files upload, and after: the
 * one in flight, how many wait behind it, and how each one ended
 * (docs/features/uploading-a-book.md). Nothing while there is nothing to say.
 */
export function UploadStatus({ items, onDismiss, onOpenBook, className }: UploadStatusProps) {
  if (items.length === 0) return null;

  const uploading = items.find((item) => item.status === "uploading");
  const queued = items.filter((item) => item.status === "queued").length;
  const finished = items.filter((item) => item.status !== "queued" && item.status !== "uploading");
  const busy = uploading !== undefined || queued > 0;

  return (
    <section
      aria-label="Uploads"
      aria-live="polite"
      className={cn(
        "border-line bg-header fixed inset-x-3 bottom-3 z-40 mx-auto max-w-lg rounded-xl border shadow-lg backdrop-blur-xl sm:inset-x-5",
        className,
      )}
    >
      {busy && (
        <p className="text-foreground flex items-center gap-2 px-3 py-2 text-[13px]">
          <Loader2 size={14} className="text-you-soft shrink-0 animate-spin" aria-hidden="true" />
          <span className="truncate">
            {uploading ? `Uploading ${uploading.name}` : "Starting…"}
          </span>
          {queued > 0 && (
            <span className="text-muted-foreground shrink-0 text-[11px]">{queued} more</span>
          )}
        </p>
      )}

      {finished.length > 0 && (
        <ul className={cn("max-h-40 overflow-y-auto", busy && "border-line border-t")}>
          {finished.map((item) => {
            const outcome = OUTCOME[item.status as keyof typeof OUTCOME];
            const Icon = outcome.icon;
            const openable = item.bookId !== undefined && onOpenBook;
            return (
              <li key={item.id} className="flex items-start gap-2 px-3 py-1.5 text-[12px]">
                <Icon
                  size={13}
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 shrink-0",
                    item.status === "failed" ? "text-destructive" : "text-you-soft",
                  )}
                />
                <span className="min-w-0 flex-1">
                  {openable ? (
                    <button
                      type="button"
                      onClick={() => item.bookId !== undefined && onOpenBook?.(item.bookId)}
                      className="text-foreground hover:text-you-soft block max-w-full truncate text-left"
                    >
                      {item.name}
                    </button>
                  ) : (
                    <span className="text-foreground block truncate">{item.name}</span>
                  )}
                  <span className="text-muted-foreground block">
                    {item.status === "failed" ? (item.error ?? outcome.text) : outcome.text}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {!busy && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-muted-foreground hover:text-foreground absolute top-1.5 right-1.5 rounded-md p-1"
        >
          <X size={13} />
        </button>
      )}
    </section>
  );
}
