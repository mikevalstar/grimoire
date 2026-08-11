import { Link } from "@tanstack/react-router";
import { Moon, Search, Settings, Sun } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { Kbd } from "@/components/ui/kbd";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/** Shared shape for the header's square icon buttons. */
const iconButton =
  "flex size-8 items-center justify-center rounded-lg border border-line bg-fill text-muted-foreground transition-colors hover:border-line-strong hover:text-foreground";

export interface AppHeaderProps {
  /** Opens the command palette. Inert until that exists. */
  onOpenSearch?: () => void;
  onOpenSettings?: () => void;
  /** Shown in the search placeholder once we know the library size. */
  bookCount?: number;
  /** The reader this device is using — their initials on their own colour. */
  user?: { name: string; color: string };
  className?: string;
}

export function AppHeader({
  onOpenSearch,
  onOpenSettings,
  bookCount,
  user,
  className,
}: AppHeaderProps) {
  const { theme, toggle } = useTheme();

  const searchLabel = bookCount === undefined
    ? "Search your library or run a command…"
    : `Search ${bookCount.toLocaleString()} books or run a command…`;

  return (
    <header
      className={cn(
        "bg-header border-line sticky top-0 z-30 border-b backdrop-blur-xl",
        className,
      )}
    >
      <div className="flex h-14 items-center gap-3 px-3 sm:px-5">
        <Link
          to="/"
          className="text-foreground hover:text-you-soft shrink-0 text-[15px] font-semibold tracking-tight transition-colors"
        >
          Grimoire
        </Link>

        {/* wide search trigger — the anchor the command palette will hang off */}
        <button
          type="button"
          onClick={onOpenSearch}
          className="border-line bg-fill text-muted-foreground hover:border-line-strong hover:bg-fill-strong mx-auto hidden h-8 w-full max-w-md items-center gap-2.5 rounded-lg border px-3 text-[13px] transition-all sm:flex"
        >
          <Search size={13} />
          <span className="flex-1 truncate text-left">{searchLabel}</span>
          <span className="flex items-center gap-1">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>

        {/* below sm the trigger collapses to an icon and pushes the rest right */}
        <button type="button" onClick={onOpenSearch} aria-label="Search" className={cn(iconButton, "ml-auto sm:hidden")}>
          <Search size={14} />
        </button>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className={iconButton}
          >
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Settings"
            className={cn(iconButton, "hidden sm:flex")}
          >
            <Settings size={14} />
          </button>

          <UserAvatar
            name={user?.name ?? "Grimoire"}
            color={user?.color ?? "indigo"}
            title={user?.name}
          />
        </div>
      </div>
    </header>
  );
}
