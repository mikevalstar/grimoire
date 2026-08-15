import type { ComponentPropsWithoutRef } from "react";
import calibreLogo from "@/assets/calibre.png";
import hardcoverLogo from "@/assets/hardcover.svg";
import { cn } from "@/lib/utils";

/**
 * The real marks of the places a book comes from — Calibre's shelf of books and
 * Hardcover's indigo bookmark — drawn the way a lucide icon is drawn, so a
 * source indicator can swap a generic glyph for the logo of the thing it names
 * without the call site changing shape.
 *
 * They are images rather than paths: these are someone else's trademarks, and a
 * `currentColor` silhouette of Calibre's four books is just a books icon again.
 * Colour props therefore do nothing here — that is the point.
 *
 * Both assets are imported rather than served from `/`, because `apps/web`
 * builds with `base: "./"` and the desktop shell loads it from `views://`,
 * where an absolute path resolves to nothing.
 */
export interface BrandIconProps
  extends Omit<ComponentPropsWithoutRef<"img">, "src" | "alt" | "width" | "height"> {
  /** Pixel size of the square, matching lucide's `size`. */
  size?: number;
}

/**
 * The calibre application icon (calibre-ebook.com, GPL v3) at 256px, so it
 * stays sharp on a retina screen at the ~12px a badge gives it.
 */
export function CalibreIcon({ size = 16, className, ...props }: BrandIconProps) {
  return (
    <img
      src={calibreLogo}
      alt=""
      width={size}
      height={size}
      // Decorative: every use pairs it with a visible or screen-reader name.
      className={cn("inline-block shrink-0 object-contain", className)}
      {...props}
    />
  );
}

/** The Hardcover logo (hardcover.app), their trademark, used for attribution. */
export function HardcoverIcon({ size = 16, className, ...props }: BrandIconProps) {
  return (
    <img
      src={hardcoverLogo}
      alt=""
      width={size}
      height={size}
      className={cn("inline-block shrink-0 object-contain", className)}
      {...props}
    />
  );
}
