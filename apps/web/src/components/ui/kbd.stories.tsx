import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { Kbd } from "./kbd";

const meta = {
  title: "UI/Kbd",
  component: Kbd,
  args: { children: "K" },
} satisfies Meta<typeof Kbd>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** How shortcuts are written: one cap per key, sitting inline in 13px text. */
export const Shortcut: Story = {
  render: () => (
    <span className="text-muted-foreground flex items-center gap-1.5 text-[13px]">
      Open the palette
      <Kbd>⌘</Kbd>
      <Kbd>K</Kbd>
    </span>
  ),
};
