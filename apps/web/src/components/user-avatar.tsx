import { userColor } from "@grimoire/core/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * One reader, as initials on their own colour. A reader colour identifies a
 * *person* and appears nowhere else — library data keeps the shell's
 * indigo/amber duotone (docs/features/first-run-setup-wizard.md).
 */
export function UserAvatar({
  name,
  color,
  size = "default",
  title,
  className,
}: {
  name: string;
  /** A USER_COLORS id; anything unknown falls back to the first colour. */
  color: string;
  size?: "sm" | "default" | "lg";
  /** Hover text — the full name, where only initials are shown. */
  title?: string;
  className?: string;
}) {
  return (
    <Avatar size={size} title={title} className={cn("ring-line-strong ring-1", className)}>
      <AvatarFallback
        className="text-[11px] font-bold text-white"
        style={{ backgroundColor: userColor(color).hex }}
      >
        {initialsOf(name)}
      </AvatarFallback>
    </Avatar>
  );
}

/**
 * At most two letters: first letters of the first and last word, so "Ada
 * Lovelace" reads AL and "ada" reads A. Falls back to a rune rather than an
 * empty circle.
 */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "G";
  const first = words[0]!;
  const last = words[words.length - 1]!;
  return (words.length === 1 ? first.slice(0, 1) : first[0]! + last[0]!).toUpperCase();
}
