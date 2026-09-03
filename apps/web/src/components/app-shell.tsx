import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useCallback, useRef, useState } from "react";
import { AppHeader, type AppHeaderProps } from "@/components/app-header";
import { CommandMenu } from "@/components/command-menu";
import { HardcoverAddDialog } from "@/components/hardcover-add-dialog";
import { SettingsDialog, type SettingsSection } from "@/components/settings-dialog";
import { TooltipHost } from "@/components/ui/tooltip";
import { UploadDropZone } from "@/components/upload-drop-zone";
import { UploadStatus } from "@/components/upload-status";
import { searchHardcover } from "@/lib/api";
import { setOpenBookId } from "@/lib/open-book";
import { booksQuery, useAddHardcoverBook } from "@/lib/queries";
import { UPLOAD_ACCEPT, useUploadQueue } from "@/lib/upload-queue";

/**
 * The frame every screen renders inside: ambient backdrop, sticky header, and
 * a full-width scrolling content region. No max-width clamp — the library owns
 * the whole window. See docs/features/application-shell.md.
 */
export function AppShell({
  children,
  onOpenSettings,
  ...header
}: AppHeaderProps & { children: ReactNode }) {
  // The shell owns the settings dialog so every screen has it, unless a caller
  // takes the gear over for something of its own. Where it opens depends on
  // who asked: the gear lands on Calibre, the avatar menu's "Add reader" on
  // Readers.
  const [settings, setSettings] = useState<{ open: boolean; section: SettingsSection }>({
    open: false,
    section: "calibre",
  });

  // The command palette likewise — Cmd+K should work on every screen, and its
  // book rows need the shelf, which the root loader has already prefetched.
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { data: books } = useQuery(booksQuery);

  // Adding a book from Hardcover, likewise: the + and the palette both open it,
  // and both live up here (docs/features/adding-a-book-from-hardcover.md).
  // Offered only to a reader whose Hardcover account is linked — without a
  // token there is no catalogue to search and no shelf to add to.
  const [addOpen, setAddOpen] = useState(false);
  const readerId = header.user?.hardcoverUsername ? header.user.id : undefined;
  const addBook = useAddHardcoverBook(readerId);
  // Stable, so the dialog's debounced search effect doesn't re-arm per render.
  const addSearch = useCallback(
    (query: string) =>
      readerId === undefined
        ? Promise.resolve([])
        : searchHardcover(readerId, query).then((found) => found.results),
    [readerId],
  );
  const openAdd = useCallback(() => setAddOpen(true), []);
  const onAddBook = readerId === undefined ? undefined : openAdd;

  // Uploading a file (docs/features/uploading-a-book.md): the add menu's other
  // entry, the palette's, and the whole window as a drop target. One queue
  // behind all three, and a lone upload opens its book the way a Hardcover add
  // does — a batch leaves the shelf alone and reports in the strip instead.
  const fileInput = useRef<HTMLInputElement>(null);
  const uploads = useUploadQueue(header.user?.id, (bookId, batchSize) => {
    if (batchSize === 1) setOpenBookId(bookId);
  });
  const openUpload = useCallback(() => fileInput.current?.click(), []);

  return (
    <div className="bg-background text-foreground flex h-screen flex-col overflow-hidden font-sans">
      {/* you lighting the room from the top-left, the crowd from the bottom-right */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(1000px 500px at 18% -12%, var(--backdrop-you), transparent 60%), radial-gradient(900px 520px at 108% 108%, var(--backdrop-hc), transparent 60%)",
        }}
      />

      <div className="relative z-10 flex h-full min-h-0 flex-col">
        <AppHeader
          {...header}
          onOpenSearch={() => setPaletteOpen(true)}
          onUploadBook={openUpload}
          onAddBook={onAddBook}
          onOpenSettings={onOpenSettings ?? (() => setSettings({ open: true, section: "calibre" }))}
          onAddReader={() => setSettings({ open: true, section: "readers" })}
        />
        <main className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">{children}</main>
      </div>

      <CommandMenu
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        books={books}
        bookCount={header.bookCount}
        users={header.users}
        currentUser={header.user}
        onPickUser={header.onPickUser}
        onSync={header.onSync}
        onOpenSettings={(section) => setSettings({ open: true, section })}
        onOpenBook={setOpenBookId}
        onAddBook={onAddBook}
        onUploadBook={openUpload}
      />

      <input
        ref={fileInput}
        type="file"
        accept={UPLOAD_ACCEPT}
        multiple
        hidden
        onChange={(event) => {
          uploads.enqueue(Array.from(event.target.files ?? []));
          // So picking the same file again after a refusal fires a change.
          event.target.value = "";
        }}
      />
      <UploadDropZone onFiles={uploads.enqueue} />
      <UploadStatus items={uploads.items} onDismiss={uploads.dismiss} onOpenBook={setOpenBookId} />

      <HardcoverAddDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        readerName={header.user?.name}
        search={addSearch}
        onAdd={async (add) => {
          const { bookId } = await addBook.mutateAsync(add);
          setAddOpen(false);
          // The book itself is the answer to "did that work?" — when its work
          // id came back. A lagging replica means it lands on the next sweep,
          // with nothing to open yet.
          if (bookId !== null) setOpenBookId(bookId);
        }}
      />

      <SettingsDialog
        open={settings.open}
        section={settings.section}
        onOpenChange={(open) => setSettings((current) => ({ ...current, open }))}
      />

      {/* One tooltip for every screen, rather than one per target — the shelf
          is virtualized, so a per-row tooltip would mount and unmount with the
          row (ADR 0016). */}
      <TooltipHost />
    </div>
  );
}
