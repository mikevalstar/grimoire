import { Link2 } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { BookCoverStack } from "@/components/book-cover-stack";
import { BookDownloadButton } from "@/components/book-download-button";
import {
  BookDuplicates,
  type BookDuplicatesProps,
  hasDuplicates,
} from "@/components/book-duplicates";
import { BookLinkPicker } from "@/components/book-link-picker";
import { BookMarks } from "@/components/book-marks";
import { BookReadDates } from "@/components/book-read-dates";
import { StarRating } from "@/components/star-rating";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { bookImageUrl, type Duplicates, isInLibrary, type LibraryBook } from "@/lib/api";
import { publicationYear } from "@/lib/publication";

export interface BookDetailsPanelProps {
  /** The book to show. Null closes the panel. */
  book: LibraryBook | null;
  onClose: () => void;
  /** This reader's stars for it. */
  rating?: number;
  /** Set them. Without it the stars stay a read-out, as everywhere else. */
  onRate?: (rating: number) => void;
  /**
   * Show a different one of this work's covers, by member id. Without it the
   * cover is a picture rather than a stack that can be turned over.
   */
  onChooseCover?: (bookId: number) => void;
  /** Known finish dates, newest read first, at their original precision. */
  readDates?: string[];
  readDatesPending?: boolean;
  readDatesError?: Error | null;
  /**
   * The entries this book is made of and the ones that look like they belong
   * with it, with the answers to either (docs/features/resolving-duplicates.md).
   * Omitted — or with nothing to say — the section isn't drawn at all.
   */
  sameBook?: SameBookProps;
}

/**
 * What the panel needs to resolve duplicates: the suggestions and their
 * answers, plus the two things the manual picker takes — a search over the
 * shelf, and a way to join whatever it turns up
 * (docs/features/resolving-duplicates.md).
 */
export interface SameBookProps extends Omit<BookDuplicatesProps, "duplicates"> {
  /**
   * Undefined until the suggestions arrive — or for good, if that request
   * failed. The manual picker below doesn't wait on them either way.
   */
  duplicates?: Duplicates;
  /** The shelf, filtered in the browser. See `searchBooks`. */
  search?: (query: string) => LibraryBook[];
  /** Join that work to this one. Resolves when the merge lands. */
  onLinkWork?: (workId: number) => Promise<void>;
}

/**
 * Everything Grimoire holds about one book, in a flyout over the shelf —
 * cover, series, your rating, the download, and the metadata a card and a row
 * have no room for. See docs/features/book-details-panel.md.
 *
 * Nothing here is editable but the rating: Grimoire is read-only against
 * Calibre (ADR 0005), so a field that could be typed into would be a promise it
 * couldn't keep.
 */
export function BookDetailsPanel({
  book,
  onClose,
  rating = 0,
  onRate,
  onChooseCover,
  readDates = [],
  readDatesPending = false,
  readDatesError,
  sameBook,
}: BookDetailsPanelProps) {
  // The sheet slides out over a few hundred milliseconds, by which time the
  // caller has already cleared its selection — so keep the last book around to
  // draw during the exit, rather than blanking the panel as it leaves.
  const [lastBook, setLastBook] = useState(book);
  // Searching for a duplicate replaces the body of the panel rather than
  // opening a dialog over it (docs/features/resolving-duplicates.md).
  const [linking, setLinking] = useState(false);

  if (book && book !== lastBook) {
    // A different book, rather than the same one refetched: the search was
    // about the book that has just left.
    if (book.id !== lastBook?.id) setLinking(false);
    setLastBook(book);
  }
  const shown = book ?? lastBook;
  const search = sameBook?.search;
  const onLinkWork = sameBook?.onLinkWork;

  const paragraphs = useMemo(
    () => (shown?.description ? descriptionParagraphs(shown.description) : []),
    [shown?.description],
  );

  return (
    <Sheet open={book !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        // Much wider than the shadcn default: this is a page's worth of
        // metadata, not a form, and it has more to hold yet. It takes a second
        // step up on a large screen, where 680px still leaves the shelf behind
        // it legible. Its own scroll region, so the header art can sit behind it.
        className="w-full gap-0 p-0 sm:max-w-[560px] lg:max-w-[680px]"
      >
        {shown && (
          <>
            {/* The book's own cover, blurred, lighting the top of the panel —
                the shell's ambient backdrop tinted by whatever was clicked.
                Only for books that have an image; a broken one is worse than
                none. */}
            {(shown.coverState === "cached" || shown.coverUrl) && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-56 overflow-hidden"
              >
                <img
                  src={bookImageUrl(shown, 180)}
                  alt=""
                  className="h-full w-full scale-125 object-cover opacity-30 blur-3xl"
                />
                <div className="from-background/0 via-background/60 to-background absolute inset-0 bg-gradient-to-b" />
              </div>
            )}

            <div className="relative flex-1 overflow-y-auto p-5">
              <SheetHeader className="flex-row gap-4 p-0">
                {/* A stack when the work has more than one cover to offer, and
                    the plain cover otherwise (docs/features/book-details-panel.md). */}
                <BookCoverStack
                  book={shown}
                  width={104}
                  onChoose={onChooseCover}
                  className="w-[104px] shrink-0 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.5)]"
                />
                {/* Room on the right for the sheet's own close button. */}
                <div className="min-w-0 flex-1 pr-7">
                  <SheetTitle className="text-[17px] leading-snug tracking-tight">
                    {shown.title}
                  </SheetTitle>
                  <SheetDescription className="mt-0.5 text-[13px]">
                    {shown.authors.length > 0 ? shown.authors.join(", ") : "Unknown author"}
                  </SheetDescription>
                  {shown.series && (
                    <p className="text-you-soft mt-1 text-[12px]">
                      {shown.series}
                      {shown.seriesIndex !== null && ` · Book ${shown.seriesIndex}`}
                    </p>
                  )}
                  <BookMarks book={shown} className="mt-2" />
                </div>
              </SheetHeader>

              {linking && search && onLinkWork ? (
                <div className="mt-5">
                  <BookLinkPicker
                    book={shown}
                    search={search}
                    onPick={async (workId) => {
                      await onLinkWork(workId);
                      setLinking(false);
                    }}
                    onCancel={() => setLinking(false)}
                  />
                </div>
              ) : (
                <>
                  {/* Larger than on the shelf, and always visible — see StarRating.
                  The label still names the book, since the panel's own heading
                  is elsewhere in the reading order. */}
                  {(onRate || rating > 0) && (
                    <div className="mt-5 flex items-center gap-2">
                      <StarRating
                        value={rating}
                        onRate={onRate}
                        label={shown.title}
                        revealed
                        size={17}
                      />
                      <span className="text-muted-foreground text-[11px]">your rating</span>
                    </div>
                  )}

                  <div className="mt-4">
                    {shown.formats.length === 0 ? (
                      <p className="text-muted-foreground text-[12px]">
                        No files — Grimoire has this book's details but nothing to hand over.
                      </p>
                    ) : isInLibrary(shown) ? (
                      <BookDownloadButton book={shown} variant="panel" />
                    ) : (
                      <p className="text-muted-foreground text-[12px]">
                        Calibre no longer lists this book, so there is no file to download. Its
                        details, cover and your rating are Grimoire's own.
                      </p>
                    )}
                  </div>

                  {/* Only for a book that is made of more than one entry, or has
                  something that looks like it belongs with it — which is nearly
                  no books (docs/features/resolving-duplicates.md). No skeleton:
                  a suggestion arriving a moment late is better than a
                  placeholder on every book. */}
                  {sameBook && hasDuplicates(sameBook.duplicates) && (
                    <Section title="Same book">
                      <BookDuplicates {...sameBook} duplicates={sameBook.duplicates} />
                    </Section>
                  )}

                  <BookReadDates
                    dates={readDates}
                    isPending={readDatesPending}
                    error={readDatesError}
                  />

                  <Section title="Details">
                    <dl className="grid grid-cols-[92px_1fr] items-baseline gap-y-1.5 text-[12.5px]">
                      <Field label="Publisher" value={shown.publisher} />
                      <Field
                        label="Published"
                        value={publicationYear(shown.published)?.toString()}
                      />
                      <Field label="Added" value={formatDate(shown.added)} />
                      <Field label="Languages" value={formatLanguages(shown.languages)} />
                      <Field label="Pages" value={shown.pages?.toLocaleString()} />
                      {shown.formats.length > 0 && (
                        <>
                          <dt className="text-muted-foreground">Formats</dt>
                          <dd className="flex flex-wrap gap-1">
                            {shown.formats.map((format) => (
                              <span
                                key={format}
                                className="border-line bg-fill text-muted-foreground rounded border px-1.5 py-px text-[10px] font-semibold tracking-wide"
                              >
                                {format}
                              </span>
                            ))}
                          </dd>
                        </>
                      )}
                      {Object.entries(shown.identifiers).map(([scheme, value]) => (
                        <Field key={scheme} label={identifierLabel(scheme)} value={value} />
                      ))}
                    </dl>
                  </Section>

                  {shown.tags.length > 0 && (
                    <Section title="Tags">
                      <div className="flex flex-wrap gap-1.5">
                        {shown.tags.map((tag) => (
                          <span
                            key={tag}
                            className="border-line bg-fill text-muted-foreground rounded-md border px-2 py-0.5 text-[11px]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </Section>
                  )}

                  {paragraphs.length > 0 && (
                    <Section title="About">
                      {/* Capped to a readable measure rather than the panel's full
                      width, which at this size would be a 100-character line. */}
                      <div className="text-muted-foreground max-w-[68ch] space-y-2 text-[12.5px] leading-relaxed">
                        {paragraphs.map((paragraph, index) => (
                          // biome-ignore lint/suspicious/noArrayIndexKey: paragraphs of one book's description, in order and never reordered — and two identical ones would collide on any content key
                          <p key={index}>{paragraph}</p>
                        ))}
                      </div>
                    </Section>
                  )}

                  {/* Last, and quiet. Suggestions are information and sit high;
                  going looking for a duplicate yourself is deliberate, and this
                  is where you look (docs/features/resolving-duplicates.md). */}
                  {search && onLinkWork && (
                    <div className="border-line mt-6 border-t pt-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setLinking(true)}
                        className="text-muted-foreground w-full justify-start"
                      >
                        <Link2 size={14} aria-hidden="true" />
                        Link a duplicate
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-[0.08em] uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * One row of the details list — dropped entirely when there is nothing to say,
 * because a column of dashes is a form that failed rather than a book.
 */
function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground/85 break-words">{value}</dd>
    </>
  );
}

/** ISO 8601, shown as the day, in the reader's locale. */
function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString();
}

/**
 * Calibre stores ISO 639 codes; readers know language names. `Intl` handles the
 * three-letter ones, and anything it refuses is shown as stored rather than
 * dropped.
 */
function formatLanguages(codes: string[]): string | null {
  if (codes.length === 0) return null;
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames(undefined, { type: "language" });
  } catch {
    names = null;
  }
  return codes
    .map((code) => {
      try {
        return names?.of(code) ?? code;
      } catch {
        return code;
      }
    })
    .join(", ");
}

/** `isbn` is an acronym and `google` is a word; neither wants the same casing. */
function identifierLabel(scheme: string): string {
  if (scheme.length <= 4) return scheme.toUpperCase();
  return scheme.charAt(0).toUpperCase() + scheme.slice(1);
}

/**
 * A description as paragraphs of plain text.
 *
 * Calibre stores comments as HTML and Grimoire mirrors it verbatim, but the
 * panel never injects it: tags are stripped and block boundaries become
 * paragraph breaks. Rendering a library's stored markup for the sake of italics
 * is a hole, and a sanitizer is a dependency this doesn't need. Entities are
 * decoded by parsing the stripped text in a detached document — which runs
 * nothing, since it is never attached.
 */
function descriptionParagraphs(html: string): string[] {
  const text = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|tr|h[1-6]|blockquote)\s*>/gi, "\n\n")
    .replace(/<[^>]*>/g, "");

  const decoded =
    new DOMParser().parseFromString(text, "text/html").documentElement.textContent ?? text;

  return decoded
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}
