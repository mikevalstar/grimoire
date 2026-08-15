import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { BookReadDates } from "./book-read-dates";

const meta = {
  title: "Library/BookReadDates",
  component: BookReadDates,
  args: { dates: ["2026-07-19", "2021-03", "2018"] },
  decorators: [
    (Story) => (
      <div className="w-full max-w-lg p-5">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BookReadDates>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MultipleReads: Story = {};

export const Loading: Story = { args: { dates: [], isPending: true } };

export const Failed: Story = { args: { dates: [], error: new Error("Hardcover unavailable") } };

export const Light: Story = { globals: { theme: "light" } };
