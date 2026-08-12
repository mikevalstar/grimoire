import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

/**
 * Radix tooltip, restyled to the app's tokens. A `TooltipProvider` has to sit
 * above every tooltip — the app puts one in `main.tsx`, Storybook one in
 * `.storybook/preview.tsx`, so stories only need the three parts below.
 */
const meta = {
  title: "UI/Tooltip",
  component: Tooltip,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline">Hover me</Button>
      </TooltipTrigger>
      <TooltipContent>Sync with Calibre</TooltipContent>
    </Tooltip>
  ),
};

export const DefaultLight: Story = {
  render: Default.render,
  globals: { theme: "light" },
};

/** Each side, to check the arrow follows the box. */
export const Sides: Story = {
  render: () => (
    <div className="flex gap-3">
      {(["top", "right", "bottom", "left"] as const).map((side) => (
        <Tooltip key={side}>
          <TooltipTrigger asChild>
            <Button variant="outline">{side}</Button>
          </TooltipTrigger>
          <TooltipContent side={side}>Opens {side}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  ),
};

/**
 * Long, multi-paragraph text — the shape the sync indicator uses for a failure.
 * Needs both a width cap and `whitespace-pre-line` for the blank line to survive.
 */
export const MultiLine: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline">Failed sync</Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-72 whitespace-pre-line">
        {
          "Could not reach the Calibre content server at http://localhost:8080\n\nStart it with `calibre-server`, then check the content server URL in Grimoire's settings."
        }
      </TooltipContent>
    </Tooltip>
  ),
};
