import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { BookMissingBadge } from "./book-missing-badge";

const meta = {
  title: "Library/BookMissingBadge",
  component: BookMissingBadge,
} satisfies Meta<typeof BookMissingBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Beside a title in the table, where it follows the theme. */
export const Inline: Story = {};

export const InlineLight: Story = { globals: { theme: "light" } };

/**
 * On a cover in the grid. Covers are images in both themes, so this variant
 * stays dark glass rather than flipping — the same rule the download button
 * follows.
 */
export const Overlay: Story = {
  args: { variant: "overlay" },
  render: (args) => (
    <div className="from-fill-strong to-you-dim relative h-40 w-27 rounded-md bg-gradient-to-br">
      <BookMissingBadge {...args} className="absolute top-1.5 left-1.5" />
    </div>
  ),
};

export const OverlayLight: Story = {
  args: Overlay.args,
  render: Overlay.render,
  globals: { theme: "light" },
};
