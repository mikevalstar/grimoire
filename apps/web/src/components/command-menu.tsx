import { fold } from "@grimoire/core/matching";
import {
  ArrowUpDown,
  Layers,
  LayoutGrid,
  List,
  Moon,
  RefreshCw,
  Sun,
  UserPlus,
} from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { BookCover } from "@/components/book-cover";
import { SECTIONS, type SettingsSection } from "@/components/settings-dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { UserAvatar } from "@/components/user-avatar";
import type { LibraryBook, User } from "@/lib/api";
import { searchBooks } from "@/lib/book-search";
import { chooseSort, GROUP_OPTIONS, SORT_OPTIONS, useLibraryOrder } from "@/lib/library-order";
import { useTheme } from "@/lib/theme";
import { useViewMode } from "@/lib/view-mode";

/** How many book rows a query surfaces — past that, the answer is more typing. */
const MAX_BOOKS = 6;

interface PaletteCommand {
  id: string;
  /** Group heading — commands with the same section render under one label. */
  section: string;
  label: string;
  icon: ReactNode;
  /** Extra match text beyond the label, e.g. "grid table" for the view flip. */
  keywords?: string;
  /** Trailing marker — the active sort's direction, the active group's dot. */
  detail?: ReactNode;
  run: () => void;
}

export interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The shelf, for the book rows. Absent, the palette is commands-only. */
  books?: LibraryBook[];
  /** For the input placeholder, mirroring the header trigger's wording. */
  bookCount?: number;
  users?: User[];
  currentUser?: User;
  onPickUser?: (user: User) => void;
  onSync?: () => void;
  onOpenSettings?: (section: SettingsSection) => void;
  onOpenBook?: (id: number) => void;
}

/**
 * The Cmd+K palette: search the library and the app's commands at once, from a
 * panel that drops down under the header's search trigger — a dropdown, not a
 * modal takeover, so the overlay is transparent and the library stays visible.
 * See docs/features/command-palette.md.
 *
 * Structurally it is still a dialog (focus trap, Esc, outside-click), and cmdk
 * supplies the keyboard nav — but with `shouldFilter` off: books go through
 * the same ranked search as the duplicate picker (lib/book-search.ts), and
 * commands through the same accent-folding, so both agree with the rest of
 * the app about what matches.
 */
export function CommandMenu({
  open,
  onOpenChange,
  books,
  bookCount,
  users,
  currentUser,
  onPickUser,
  onSync,
  onOpenSettings,
  onOpenBook,
}: CommandMenuProps) {
  const [query, setQuery] = useState("");
  const [view, setView] = useViewMode();
  const [order, setOrder] = useLibraryOrder();
  const { theme, toggle: toggleTheme } = useTheme();

  // The app-wide shortcut lives with the palette, so it ships with the feature.
  // No focus guard: a modifier chord is always deliberate, even mid-typing.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  const close = () => {
    onOpenChange(false);
    setQuery("");
  };

  const commands = useMemo<PaletteCommand[]>(() => {
    const list: PaletteCommand[] = [];

    list.push({
      id: "view-switch",
      section: "View",
      label: view === "covers" ? "Switch to list view" : "Switch to cover view",
      icon: view === "covers" ? <List size={14} /> : <LayoutGrid size={14} />,
      keywords: "view covers grid list table",
      run: () => setView(view === "covers" ? "list" : "covers"),
    });

    for (const option of SORT_OPTIONS) {
      const active = order.sort === option.key;
      list.push({
        id: `sort-${option.key}`,
        section: "Sort",
        label: `Sort by ${option.label.toLowerCase()}`,
        icon: <ArrowUpDown size={14} />,
        keywords: "sort order",
        // The active key shows its direction; choosing it again flips it,
        // same as the toolbar menu (lib/library-order.ts).
        detail: active ? <Kbd>{order.dir === "asc" ? "↑" : "↓"}</Kbd> : undefined,
        run: () => setOrder(chooseSort(order, option.key)),
      });
    }

    for (const option of GROUP_OPTIONS) {
      // Read-status grouping means nothing without a reader — same gate as
      // the toolbar's group menu.
      if (option.key === "readstatus" && !currentUser) continue;
      list.push({
        id: `group-${option.key}`,
        section: "Group",
        label: option.key === "none" ? "Don't group" : `Group by ${option.label.toLowerCase()}`,
        icon: <Layers size={14} />,
        keywords: "group sections",
        detail: order.group === option.key ? <Kbd>✓</Kbd> : undefined,
        run: () => setOrder({ ...order, group: option.key }),
      });
    }

    if (users && onPickUser) {
      for (const user of users) {
        if (user.id === currentUser?.id) continue;
        list.push({
          id: `reader-${user.id}`,
          section: "Readers",
          label: `Switch to ${user.name}`,
          icon: <UserAvatar name={user.name} color={user.color} size="sm" />,
          keywords: "reader user switch",
          run: () => onPickUser(user),
        });
      }
    }
    if (onOpenSettings) {
      list.push({
        id: "reader-add",
        section: "Readers",
        label: "Add reader",
        icon: <UserPlus size={14} />,
        keywords: "reader user new",
        run: () => onOpenSettings("readers"),
      });
    }

    if (onSync) {
      list.push({
        id: "sync-now",
        section: "Sync",
        label: "Sync now",
        icon: <RefreshCw size={14} />,
        keywords: "calibre refresh update",
        run: onSync,
      });
    }

    if (onOpenSettings) {
      for (const { id, label, icon: Icon } of SECTIONS) {
        list.push({
          id: `settings-${id}`,
          section: "Settings",
          label: `${label} settings`,
          icon: <Icon size={14} />,
          keywords: "settings preferences configure",
          run: () => onOpenSettings(id),
        });
      }
    }

    list.push({
      id: "theme-toggle",
      section: "Theme",
      label: theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
      icon: theme === "dark" ? <Sun size={14} /> : <Moon size={14} />,
      keywords: "theme dark light mode",
      run: toggleTheme,
    });

    return list;
  }, [
    view,
    setView,
    order,
    setOrder,
    theme,
    toggleTheme,
    users,
    currentUser,
    onPickUser,
    onSync,
    onOpenSettings,
  ]);

  // Command matching folds accents exactly like book search does, so "Sòrt"
  // finds sorting the same way "Solāris" finds Solaris.
  const queryWords = fold(query).split(" ").filter(Boolean);
  const visibleCommands =
    queryWords.length === 0
      ? commands
      : commands.filter((command) => {
          const haystack = fold(`${command.section} ${command.label} ${command.keywords ?? ""}`);
          return queryWords.every((word) => haystack.includes(word));
        });

  const bookMatches =
    queryWords.length > 0 && books ? searchBooks(books, query).slice(0, MAX_BOOKS) : [];

  // Bucket into sections while keeping the build order.
  const sections: { title: string; commands: PaletteCommand[] }[] = [];
  for (const command of visibleCommands) {
    const last = sections[sections.length - 1];
    if (last && last.title === command.section) last.commands.push(command);
    else sections.push({ title: command.section, commands: [command] });
  }

  const placeholder =
    bookCount === undefined
      ? "Search your library or run a command…"
      : `Search ${bookCount.toLocaleString()} books or run a command…`;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogPortal>
        {/* Transparent: the point is a dropdown, not a dimmed mode switch. */}
        <DialogOverlay className="bg-transparent" />
        <DialogPrimitive.Content
          data-slot="command-menu"
          aria-describedby={undefined}
          className="border-line bg-popover text-popover-foreground fixed top-16 left-1/2 z-50 w-[min(600px,calc(100vw-1.5rem))] -translate-x-1/2 overflow-hidden rounded-xl border shadow-2xl outline-none duration-150 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-2"
        >
          <DialogTitle className="sr-only">Command palette</DialogTitle>
          <Command shouldFilter={false}>
            <CommandInput value={query} onValueChange={setQuery} placeholder={placeholder} />
            <CommandList>
              <CommandEmpty>No results.</CommandEmpty>
              {bookMatches.length > 0 && (
                <CommandGroup heading="Books">
                  {bookMatches.map((book) => (
                    <CommandItem
                      key={book.id}
                      value={`book-${book.id}`}
                      onSelect={() => {
                        close();
                        onOpenBook?.(book.id);
                      }}
                    >
                      <BookCover book={book} width={40} className="w-7 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="text-foreground block truncate font-medium">
                          {book.title}
                        </span>
                        <span className="text-muted-foreground block truncate text-[11px]">
                          {book.authors.join(", ")}
                          {book.series &&
                            ` · ${book.series}${book.seriesIndex !== null ? ` #${book.seriesIndex}` : ""}`}
                        </span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {sections.map((section) => (
                <CommandGroup key={section.title} heading={section.title}>
                  {section.commands.map((command) => (
                    <CommandItem
                      key={command.id}
                      value={command.id}
                      onSelect={() => {
                        close();
                        command.run();
                      }}
                    >
                      <span className="border-line bg-fill flex size-6 shrink-0 items-center justify-center rounded-md border">
                        {command.icon}
                      </span>
                      <span className="flex-1 truncate">{command.label}</span>
                      {command.detail}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
            <div className="border-line text-muted-foreground flex items-center gap-3 border-t px-4 py-2 text-[11px]">
              <span className="flex items-center gap-1">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> navigate
              </span>
              <span className="flex items-center gap-1">
                <Kbd>↵</Kbd> select
              </span>
              <span className="ml-auto flex items-center gap-1">
                <Kbd>esc</Kbd> close
              </span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
