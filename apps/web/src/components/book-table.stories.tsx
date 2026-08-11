import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { SAMPLE_BOOKS } from "@/lib/sample-books";
import { BookTable, BookTableSkeleton } from "./book-table";

const meta = {
  title: "Library/BookTable",
  component: BookTable,
  args: { books: SAMPLE_BOOKS },
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="overflow-x-auto p-5">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BookTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Light: Story = { globals: { theme: "light" } };

export const Clickable: Story = {
  args: { onOpen: (book) => console.log("open", book.title) },
};

export const Loading: Story = { render: () => <BookTableSkeleton count={10} /> };
