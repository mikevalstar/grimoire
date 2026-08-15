import { Check, Plus, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user-avatar";
import type { User } from "@/lib/api";

/**
 * The header avatar as a menu: every reader, with the current one marked —
 * picking switches this device's reader on the spot (a convenience, not a
 * credential, ADR 0008) — plus a way into settings. On narrow screens this is
 * the *only* way in: the header sheds the gear below `sm`.
 * See docs/features/application-shell.md.
 */
export function UserMenu({
  users,
  currentUser,
  onPickUser,
  onAddReader,
  onOpenSettings,
}: {
  users: User[];
  /** Who this device is reading as; undefined before anyone has been picked. */
  currentUser?: User;
  onPickUser: (user: User) => void;
  /** Opens settings on its Readers section. */
  onAddReader?: () => void;
  onOpenSettings?: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={currentUser ? `Reading as ${currentUser.name}` : "Choose a reader"}
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <UserAvatar
          name={currentUser?.name ?? "Grimoire"}
          color={currentUser?.color ?? "indigo"}
          className="transition-transform hover:scale-105"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-muted-foreground text-[11px] tracking-wide uppercase">
          Reading as
        </DropdownMenuLabel>
        {users.map((user) => {
          const current = user.id === currentUser?.id;
          return (
            <DropdownMenuItem
              key={user.id}
              onSelect={() => onPickUser(user)}
              className="gap-2.5"
              aria-checked={current}
              role="menuitemradio"
            >
              <UserAvatar name={user.name} color={user.color} size="sm" />
              <span className="flex-1 truncate">
                {user.name}
                {user.hardcoverUsername && (
                  <span className="text-muted-foreground block truncate text-[11px]">
                    Hardcover · {user.hardcoverUsername}
                  </span>
                )}
              </span>
              {current && <Check className="text-you-soft size-4" />}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        {onAddReader && (
          <DropdownMenuItem onSelect={onAddReader}>
            <Plus />
            Add reader
          </DropdownMenuItem>
        )}
        {onOpenSettings && (
          <DropdownMenuItem onSelect={onOpenSettings}>
            <Settings />
            Settings
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
