import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { StarRating } from "./star-rating";

const meta = {
  title: "Library/StarRating",
  component: StarRating,
  args: { value: 4 },
} satisfies Meta<typeof StarRating>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Light: Story = { globals: { theme: "light" } };

/** Every rating a Calibre book can carry. Zero renders nothing at all. */
export const Scale: Story = {
  render: (args) => (
    <div className="space-y-1.5">
      {[0, 1, 2, 3, 4, 5].map((value) => (
        <div key={value} className="flex items-center gap-3">
          <span className="text-muted-foreground w-4 text-[11px] tabular-nums">{value}</span>
          <StarRating {...args} value={value} />
        </div>
      ))}
    </div>
  ),
};
