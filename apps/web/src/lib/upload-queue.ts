import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, UPLOAD_FORMATS } from "@/lib/api";
import { useUploadBook } from "@/lib/queries";

/** One file's journey through the queue (docs/features/uploading-a-book.md). */
export interface UploadItem {
  id: number;
  name: string;
  status: "queued" | "uploading" | "added" | "existing" | "failed";
  /** The work it landed in, for the two outcomes that have one. */
  bookId?: number;
  /** Why it was refused, for the one that was. */
  error?: string;
}

/** The extensions the file picker offers, e.g. `.epub`. */
export const UPLOAD_ACCEPT = Object.values(UPLOAD_FORMATS)
  .map((format) => format.extension)
  .join(",");

let nextId = 1;

/**
 * Files upload one after another, and the strip at the bottom of the window
 * reports on each (docs/features/uploading-a-book.md). Sequential on purpose:
 * the API does a parse, a cover scale and a matcher pass per file, and a
 * dropped folder of fifty books should not be fifty of those at once.
 *
 * `onLanded` fires once per finished upload with the work it landed in, so the
 * shell can open a lone upload's panel.
 */
export function useUploadQueue(
  userId: number | undefined,
  onLanded?: (bookId: number, batchSize: number) => void,
) {
  // mutateAsync is stable across renders, unlike the mutation object; the
  // drop zone re-subscribes its window listeners whenever `enqueue` changes.
  const { mutateAsync: upload } = useUploadBook(userId);
  const [items, setItems] = useState<UploadItem[]>([]);
  // The files themselves stay out of state: a File is not something to render.
  const pending = useRef<{ id: number; file: File }[]>([]);
  const running = useRef(false);
  // Read through a ref so the drain loop, which outlives renders, sees the
  // latest handler without being restarted.
  const landed = useRef(onLanded);
  useEffect(() => {
    landed.current = onLanded;
  }, [onLanded]);

  const patch = useCallback(
    (id: number, change: Partial<UploadItem>) =>
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, ...change } : item)),
      ),
    [],
  );

  const drain = useCallback(
    async (batchSize: number) => {
      if (running.current) return;
      running.current = true;
      try {
        for (let next = pending.current.shift(); next; next = pending.current.shift()) {
          patch(next.id, { status: "uploading" });
          try {
            const result = await upload(next.file);
            patch(next.id, {
              status: result.existing ? "existing" : "added",
              bookId: result.bookId,
            });
            landed.current?.(result.bookId, batchSize);
          } catch (err) {
            patch(next.id, {
              status: "failed",
              error:
                err instanceof ApiError
                  ? err.message
                  : "Could not reach Grimoire to upload this file.",
            });
          }
        }
      } finally {
        running.current = false;
      }
    },
    [upload, patch],
  );

  const enqueue = useCallback(
    (files: readonly File[]) => {
      if (files.length === 0) return;
      const added = files.map((file) => ({ id: nextId++, file }));
      setItems((current) => [
        ...current,
        ...added.map(({ id, file }) => ({ id, name: file.name, status: "queued" as const })),
      ]);
      pending.current.push(...added);
      void drain(files.length);
    },
    [drain],
  );

  /** Clear the finished entries; anything still moving stays. */
  const dismiss = useCallback(() => {
    setItems((current) =>
      current.filter((item) => item.status === "queued" || item.status === "uploading"),
    );
  }, []);

  return { items, enqueue, dismiss };
}
