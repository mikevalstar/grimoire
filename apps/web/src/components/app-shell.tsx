import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { AppHeader, type AppHeaderProps } from "@/components/app-header";
import { CommandMenu } from "@/components/command-menu";
import { SettingsDialog, type SettingsSection } from "@/components/settings-dialog";
import { TooltipHost } from "@/components/ui/tooltip";
import { setOpenBookId } from "@/lib/open-book";
import { booksQuery } from "@/lib/queries";

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
