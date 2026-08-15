import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { Button } from "./button";
import { TooltipHost, tooltipProps } from "./tooltip";

/**
 * One tooltip serves the whole app
 * ([ADR 0016](/docs/adrs/0016-react-tooltip-for-hover-affordances.md)): a
 * single `<TooltipHost />` lives in the app shell — and, for stories, in
 * `.storybook/preview.tsx` — while targets opt in by spreading
 * `tooltipProps(text)` onto themselves.
 *
 * That is what makes tooltips free in the virtualized library views: a row
 * scrolling past mounts three data attributes, not a tooltip component. It also
 * means a tooltip is never a target's accessible name — every target below
 * keeps its own.
 */
const meta = {
  title: "UI/Tooltip",
  component: TooltipHost,
  parameters: { layout: "centered" },
} satisfies Meta<typeof TooltipHost>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Button variant="outline" {...tooltipProps("Sync with Calibre")}>
      Hover me
    </Button>
  ),
};

export const DefaultLight: Story = {
  render: Default.render,
  globals: { theme: "light" },
};

/** Each side, off the one instance — the place travels with the target. */
export const Places: Story = {
  render: () => (
    <div className="flex gap-3 p-16">
      {(["top", "right", "bottom", "left"] as const).map((place) => (
        <Button key={place} variant="outline" {...tooltipProps(`Opens ${place}`, place)}>
          {place}
        </Button>
      ))}
    </div>
  ),
};

/**
 * Long, two-paragraph text — the shape the sync indicator uses for a failure.
 * The host caps the width and keeps the blank line, so call sites pass a plain
 * string and get this for free.
 */
export const MultiLine: Story = {
  render: () => (
    <Button
      variant="outline"
      {...tooltipProps(
        "Could not reach the Calibre content server at http://localhost:8080\n\nStart it with `calibre-server`, then check the content server URL in Grimoire's settings.",
        "bottom",
      )}
    >
      Failed sync
    </Button>
  ),
};

/** Many targets, one instance — the point of the whole arrangement. */
export const ManyTargets: Story = {
  render: () => (
    <div className="grid grid-cols-6 gap-2">
      {Array.from({ length: 24 }, (_, index) => index + 1).map((n) => (
        <Button key={n} variant="outline" size="sm" {...tooltipProps(`Book ${n}`)}>
          {n}
        </Button>
      ))}
    </div>
  ),
};
