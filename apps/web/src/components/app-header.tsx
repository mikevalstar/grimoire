import { Link } from "@tanstack/react-router";
import { Moon, Plus, Search, Settings, Sun } from "lucide-react";
import { SyncIndicator } from "@/components/sync-indicator";
import { Kbd } from "@/components/ui/kbd";
import { tooltipProps } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/user-avatar";
import { UserMenu } from "@/components/user-menu";
import type { SyncStatus, User } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/** Shared shape for the header's square icon buttons. */
const iconButton =
  "flex size-8 items-center justify-center rounded-lg border border-line bg-fill text-muted-foreground transition-colors hover:border-line-strong hover:text-foreground";

export interface AppHeaderProps {
  /** Opens the command palette. Inert until that exists. */
  onOpenSearch?: () => void;
  /**
   * Opens the add-a-book dialog
   * (docs/features/adding-a-book-from-hardcover.md). Absent for a reader with
   * no linked Hardcover account — there is nowhere to add anything to — and
   * the **+** goes with it.
   */
  onAddBook?: () => void;
  onOpenSettings?: () => void;
  /** Opens settings on its Readers section, from the avatar menu. */
  onAddReader?: () => void;
  /** Shown in the search placeholder once we know the library size. */
  bookCount?: number;
  /** The reader this device is using — their initials on their own colour. */
  user?: User;
  /** Everyone, for the avatar menu. Absent, the avatar is a plain chip. */
  users?: User[];
  onPickUser?: (user: User) => void;
  /** Drives the sync indicator. Absent in Storybook and before the first poll. */
  syncStatus?: SyncStatus;
  onSync?: () => void;
  className?: string;
}

export function AppHeader({
  onOpenSearch,
  onAddBook,
  onOpenSettings,
  onAddReader,
  bookCount,
  user,
  users,
  onPickUser,
  syncStatus,
  onSync,
  className,
}: AppHeaderProps) {
  const { theme, toggle } = useTheme();

  // The wide trigger says this out loud; below `sm` it collapses to an icon and
  // the same sentence becomes the tooltip.
  const searchAction =
    bookCount === undefined
      ? "Search your library or run a command"
      : `Search ${bookCount.toLocaleString()} books or run a command`;
  const searchLabel = `${searchAction}…`;

  const addAction = "Add a book from Hardcover";

  // A two-way flip with no "follow the system" state, so the label can always
  // name the theme the click moves to rather than the one you are in.
  const themeAction = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <header
      className={cn("bg-header border-line sticky top-0 z-30 border-b backdrop-blur-xl", className)}
    >
      <div className="flex h-14 items-center gap-3 px-3 sm:px-5">
        <Link
          to="/"
          className="text-foreground hover:text-you-soft shrink-0 text-[15px] font-semibold tracking-tight transition-colors"
        >
          Grimoire
        </Link>

        {/* wide search trigger — the anchor the command palette hangs off —
            with the add button riding beside it, so the two live together */}
        <div className="mx-auto hidden w-full max-w-md items-center gap-2 sm:flex">
          <button
            type="button"
            onClick={onOpenSearch}
            className="border-line bg-fill text-muted-foreground hover:border-line-strong hover:bg-fill-strong flex h-8 min-w-0 flex-1 items-center gap-2.5 rounded-lg border px-3 text-[13px] transition-all"
          >
            <Search size={13} />
            <span className="flex-1 truncate text-left">{searchLabel}</span>
            <span className="flex items-center gap-1">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
          {onAddBook && (
            <button
              type="button"
              onClick={onAddBook}
              aria-label={addAction}
              {...tooltipProps(addAction, "bottom")}
              className={cn(iconButton, "shrink-0")}
            >
              <Plus size={15} />
            </button>
          )}
        </div>

        {/* below sm both collapse to icons and push the rest right */}
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Search"
          {...tooltipProps(searchAction, "bottom")}
          className={cn(iconButton, "ml-auto sm:hidden")}
        >
          <Search size={14} />
        </button>
        {onAddBook && (
          <button
            type="button"
            onClick={onAddBook}
            aria-label={addAction}
            {...tooltipProps(addAction, "bottom")}
            className={cn(iconButton, "sm:hidden")}
          >
            <Plus size={15} />
          </button>
        )}

        <div className="flex shrink-0 items-center gap-2">
          {/* Stays visible on a phone, unlike the gear below it: this is also
              where a failed sync shows up, and hiding an error is not an option. */}
          <SyncIndicator status={syncStatus} onSync={onSync} />

          <button
            type="button"
            onClick={toggle}
            aria-label={themeAction}
            {...tooltipProps(themeAction, "bottom")}
            className={iconButton}
          >
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Settings"
            {...tooltipProps(
              "Settings — the Calibre server, Hardcover, readers and duplicates",
              "bottom",
            )}
            className={cn(iconButton, "hidden sm:flex")}
          >
            <Settings size={14} />
          </button>

          {/* With a reader list this is the switcher; without one (Storybook,
              first load) it stays a plain chip. */}
          {users && onPickUser ? (
            <UserMenu
              users={users}
              currentUser={user}
              onPickUser={onPickUser}
              onAddReader={onAddReader}
              onOpenSettings={onOpenSettings}
            />
          ) : (
            <UserAvatar
              name={user?.name ?? "Grimoire"}
              color={user?.color ?? "indigo"}
              title={user?.name}
            />
          )}
        </div>
      </div>
    </header>
  );
}
