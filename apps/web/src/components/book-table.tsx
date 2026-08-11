import { BookCover } from "@/components/book-cover";
import { StarRating } from "@/components/star-rating";
import { Skeleton } from "@/components/ui/skeleton";
import type { LibraryBook } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface BookTableProps {
  books: LibraryBook[];
  /** Opening a book. Rows are only clickable when this is given — see BookGrid. */
  onOpen?: (book: LibraryBook) => void;
  className?: string;
}

/** Calibre dates are ISO 8601; show the day, in the reader's locale. */
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

const TH =
  "bg-background/95 text-muted-foreground sticky top-0 z-10 border-line border-b px-3 py-2 text-left text-[10px] font-semibold tracking-[0.08em] uppercase backdrop-blur";

/** The dense view: one row per book, columns fixed until a column picker exists. */
export function BookTable({ books, onOpen, className }: BookTableProps) {
  return (
    <table className={cn("w-full min-w-[720px] border-collapse text-[13px]", className)}>
      <thead>
        <tr>
          <th className={cn(TH, "w-10")}>
            <span className="sr-only">Cover</span>
          </th>
          <th className={TH}>Title</th>
          <th className={TH}>Author</th>
          <th className={TH}>Series</th>
          <th className={TH}>Rating</th>
          <th className={TH}>Formats</th>
          <th className={TH}>Added</th>
        </tr>
      </thead>
      <tbody>
        {books.map((book) => (
          <tr
            key={book.id}
            onClick={onOpen ? () => onOpen(book) : undefined}
            className={cn(
              "border-line/60 border-b transition-colors",
              onOpen && "hover:bg-fill cursor-pointer",
            )}
          >
            <td className="py-1.5 pr-3 pl-3">
              <BookCover book={book} width={28} className="w-7 rounded-[3px]" />
            </td>
            <td className="text-foreground max-w-[420px] truncate px-3 py-1.5 font-medium">
              {book.title}
            </td>
            <td className="text-muted-foreground max-w-[220px] truncate px-3 py-1.5">
              {book.authors.length > 0 ? book.authors.join(", ") : "—"}
            </td>
            <td className="text-muted-foreground max-w-[200px] truncate px-3 py-1.5">
              {book.series ? (
                <>
                  {book.series}
                  {book.seriesIndex !== null && (
                    <span className="text-muted-foreground/60"> #{book.seriesIndex}</span>
                  )}
                </>
              ) : (
                "—"
              )}
            </td>
            <td className="px-3 py-1.5">
              {book.rating > 0 ? (
                <StarRating value={book.rating} />
              ) : (
                <span className="text-muted-foreground/50">—</span>
              )}
            </td>
            <td className="px-3 py-1.5">
              <span className="flex gap-1">
                {book.formats.length === 0 && <span className="text-muted-foreground/50">—</span>}
                {book.formats.map((format) => (
                  <span
                    key={format}
                    className="border-line bg-fill text-muted-foreground rounded border px-1 py-px text-[9px] font-semibold tracking-wide"
                  >
                    {format}
                  </span>
                ))}
              </span>
            </td>
            <td className="text-muted-foreground px-3 py-1.5 text-xs whitespace-nowrap tabular-nums">
              {formatDate(book.added)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Placeholder rows in the table's own shape. */
export function BookTableSkeleton({ count = 14 }: { count?: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholder rows, never reordered
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 w-7 rounded-[3px]" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-1/5" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}
