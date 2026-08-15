import type { PlacesType } from "react-tooltip";
import { Tooltip as ReactTooltip } from "react-tooltip";

/**
 * The one tooltip in the app. Every target points at this id
 * ([ADR 0016](../../../../../docs/adrs/0016-react-tooltip-for-hover-affordances.md)).
 */
export const TOOLTIP_ID = "grimoire-tooltip";

/** Which side of the target the box opens on. */
export type TooltipPlace = PlacesType;

/**
 * What a target spreads onto itself to opt in. Only ever produced by
 * {@link tooltipProps} — the attribute names are react-tooltip's contract, not
 * a call site's business.
 */
export interface TooltipTargetProps {
  "data-tooltip-id"?: string;
  "data-tooltip-content"?: string;
  "data-tooltip-place"?: TooltipPlace;
}

/**
 * The props that give an element a tooltip:
 *
 * ```tsx
 * <button {...tooltipProps("Download EPUB")} aria-label="Download EPUB">
 * ```
 *
 * Empty for empty content, so a conditional tooltip is three absent attributes
 * rather than an empty box. Never the only way to read a control: the target
 * keeps its own accessible name.
 */
export function tooltipProps(
  content: string | null | undefined,
  place?: TooltipPlace,
): TooltipTargetProps {
  if (!content) return {};
  return {
    "data-tooltip-id": TOOLTIP_ID,
    "data-tooltip-content": content,
    ...(place ? { "data-tooltip-place": place } : {}),
  };
}

export interface TooltipHostProps {
  /** How long a pointer has to rest before the box appears, in ms. */
  delayShow?: number;
}

/**
 * The single instance, mounted once by the app shell and once by Storybook's
 * global decorator. One set of listeners and one floating element for the whole
 * screen — which is what makes tooltips free in the virtualized library views
 * ([ADR 0015](../../../../../docs/adrs/0015-virtualize-library-views-with-tanstack-virtual.md)),
 * where a per-target tooltip component would mount and unmount with every row
 * that crosses the viewport.
 *
 * Portalled to the body and positioned `fixed` so it clears the shell's
 * `overflow-hidden` and paints above the details panel's sheet.
 */
export function TooltipHost({ delayShow = 250 }: TooltipHostProps = {}) {
  return (
    <ReactTooltip
      id={TOOLTIP_ID}
      // react-tooltip's own look is dropped (its positioning styles are kept)
      // so the box is dressed in the app's popover tokens and flips with the
      // theme like every other floating surface.
      disableStyleInjection
      opacity={1}
      delayShow={delayShow}
      delayHide={80}
      offset={7}
      positionStrategy="fixed"
      portalRoot={typeof document === "undefined" ? null : document.body}
      // No pointer: the box is a label, and the marks it labels are small
      // enough that an arrow would be most of the picture.
      noArrow
      // `pre-line` because the sync indicator's failure text is two paragraphs
      // — error, then hint — and the blank line between them has to survive.
      className="border-line bg-popover text-popover-foreground z-[60] w-max max-w-72 rounded-md border px-2 py-1 text-[11px] leading-snug font-medium whitespace-pre-line shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)]"
    />
  );
}
