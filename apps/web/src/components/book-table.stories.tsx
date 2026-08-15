import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import type { Ratings } from "@/lib/api";
import { orderLibrary } from "@/lib/library-order";
import { SAMPLE_BOOKS, SAMPLE_RATINGS } from "@/lib/sample-books";
import { BookTable, BookTableSkeleton } from "./book-table";

const meta = {
  title: "Library/BookTable",
  component: BookTable,
  args: { sections: orderLibrary(SAMPLE_BOOKS, { sort: "title", dir: "asc", group: "none" }) },
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

/**
 * The rating column becomes a control. Clicking a star rates the book without
 * also firing the row's own click — try it with Clickable's `onOpen` on.
 */
export const Ratable: Story = {
  args: { onOpen: (book) => console.log("open", book.title) },
  render: (args) => {
    const [ratings, setRatings] = useState<Ratings>(SAMPLE_RATINGS);
    return (
      <BookTable
        {...args}
        ratings={ratings}
        onRate={(book, rating) =>
          setRatings((current) => {
            const next = { ...current };
            if (rating <= 0) delete next[String(book.id)];
            else next[String(book.id)] = rating;
            return next;
          })
        }
      />
    );
  },
};

/** Grouped by author: full-width header rows under the sticky column header. */
export const Grouped: Story = {
  args: { sections: orderLibrary(SAMPLE_BOOKS, { sort: "title", dir: "asc", group: "author" }) },
};

export const Loading: Story = { render: () => <BookTableSkeleton count={10} /> };
