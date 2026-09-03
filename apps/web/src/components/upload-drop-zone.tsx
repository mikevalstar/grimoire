import { FileUp } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Whether a drag carries files at all, as opposed to text or a link out of the page. */
function carriesFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

export interface UploadDropOverlayProps {
  /** Shown while a file is held over the window. */
  active: boolean;
  className?: string;
}

/**
 * What the whole window turns into while a file is dragged over it: one
 * sentence saying what letting go will do (docs/features/uploading-a-book.md).
 * Presentational, so Storybook can show it without a drag.
 */
export function UploadDropOverlay({ active, className }: UploadDropOverlayProps) {
  if (!active) return null;
  return (
    <div
      aria-hidden="true"
      className={cn(
        "bg-background/80 pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-sm",
        className,
      )}
    >
      <div className="border-you text-foreground flex max-w-sm flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-10 py-8 text-center">
        <FileUp size={32} className="text-you-soft" />
        <p className="text-[15px] font-semibold tracking-tight">Drop to add to Grimoire</p>
        <p className="text-muted-foreground text-[13px]">
          EPUB files only, for now. Each one becomes a book on the shelf.
        </p>
      </div>
    </div>
  );
}

export interface UploadDropZoneProps {
  /** The files let go of, in the order they were dropped. */
  onFiles: (files: File[]) => void;
}

/**
 * Listens for files dragged onto the window and shows the overlay while one
 * is held there. Window-level rather than a target box: "drag it into the
 * app" should mean anywhere in the app.
 *
 * The counter is the standard cure for `dragleave` firing every time the
 * pointer crosses a child element — the drag is over only when as many
 * leaves as enters have fired, or a drop lands.
 */
export function UploadDropZone({ onFiles }: UploadDropZoneProps) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let depth = 0;

    const enter = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      depth++;
      setActive(true);
    };
    const over = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      // Without this the browser navigates to the file on drop.
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    };
    const leave = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setActive(false);
    };
    const drop = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setActive(false);
      onFiles(Array.from(event.dataTransfer?.files ?? []));
    };

    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [onFiles]);

  return <UploadDropOverlay active={active} />;
}
