import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { ReadStatusFilter, type ReadStatusFilterValue } from "./read-status-filter";

const meta = {
  title: "Library/ReadStatusFilter",
  component: ReadStatusFilter,
  args: {
    value: "all",
    onValueChange: () => {},
    counts: { all: 255, "to-read": 163, read: 92 },
  },
} satisfies Meta<typeof ReadStatusFilter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ReadSelected: Story = { args: { value: "read" } };

export const Disabled: Story = { args: { disabled: true } };

export const Light: Story = { globals: { theme: "light" } };

export const Interactive: Story = {
  render: function Interactive(args) {
    const [value, setValue] = useState<ReadStatusFilterValue>(args.value);
    return <ReadStatusFilter {...args} value={value} onValueChange={setValue} />;
  },
};
