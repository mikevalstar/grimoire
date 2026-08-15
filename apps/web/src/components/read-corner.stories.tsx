import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { ReadCorner } from "./read-corner";

/** A stand-in cover, with the `group/book` class the grid's cards carry. */
const withCover = (Story: React.ComponentType) => (
  <div className="group/book bg-fill border-line relative h-60 w-40 rounded-md border">
    <Story />
  </div>
);

const meta = {
  title: "Library/ReadCorner",
  component: ReadCorner,
  decorators: [withCover],
  args: { read: true, label: "Dune", onToggle: () => {} },
} satisfies Meta<typeof ReadCorner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A read book wears the filled dog-ear all the time. */
export const Read: Story = {};

/** Unread: invisible until the card is hovered or the corner focused. */
export const UnreadHoverToReveal: Story = {
  args: { read: false },
};

/** Without a handler the corner is a read-out — and an unread one is nothing. */
export const ReadOnly: Story = {
  args: { onToggle: undefined },
};

export const Light: Story = {
  globals: { theme: "light" },
};
