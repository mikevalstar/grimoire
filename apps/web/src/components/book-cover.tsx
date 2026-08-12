import { useState } from "react";
import { bookCoverUrl, coverSizeFor, type LibraryBook } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface BookCoverProps {
  book: Pick<LibraryBook, "id" | "title" | "authors">;
  /**
   * Roughly how wide the cover will be drawn, in CSS pixels. Sync cached a
   * fixed set of sizes, so this picks the nearest one rather than asking for
   * arbitrary pixels.
   */
  width?: number;
  /** Override the image URL. Defaults to this book's cached cover. */
  src?: string;
  className?: string;
}

/**
 * A book's cover at the standard 2:3 ratio, from Grimoire's own cover cache —
 * so it draws with the content server stopped (ADR 0011). A book with no cover
 * — or one whose image fails to load, or that sync hasn't reached yet — falls
 * back to its title on a tinted panel, so a coverless library still reads as a
 * shelf. See docs/features/book-list.md.
 */
export function BookCover({ book, width = 180, src, className }: BookCoverProps) {
  const url = src ?? bookCoverUrl(book.id, coverSizeFor(width));

  // Remember *which* image failed, not just that one did: a new book in the
  // same slot (the grid reuses DOM as the list changes) then gets a fresh
  // attempt instead of inheriting the previous book's failure.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = failedUrl === url;

  return (
    <div
      className={cn(
        "border-line bg-fill relative aspect-2/3 w-full overflow-hidden rounded-md border",
        className,
      )}
    >
      {failed ? (
        <div
          aria-hidden="true"
          className="from-fill-strong to-you-dim flex h-full w-full flex-col justify-end bg-gradient-to-br p-2"
        >
          <p className="text-foreground/80 line-clamp-4 text-[11px] leading-tight font-medium">
            {book.title}
          </p>
          {book.authors.length > 0 && (
            <p className="text-muted-foreground mt-1 truncate text-[10px]">
              {book.authors.join(", ")}
            </p>
          )}
        </div>
      ) : (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailedUrl(url)}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}
