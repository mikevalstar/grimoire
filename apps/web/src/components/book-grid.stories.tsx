import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import type { Ratings } from "@/lib/api";
import { SAMPLE_BOOKS, SAMPLE_RATINGS } from "@/lib/sample-books";
import { BookGrid, BookGridSkeleton } from "./book-grid";

/**
 * Covers come from a running Calibre content server, which Storybook has no
 * connection to — every card here shows the no-cover fallback.
 */
const meta = {
  title: "Library/BookGrid",
  component: BookGrid,
  args: { books: SAMPLE_BOOKS },
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="p-5">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BookGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Light: Story = { globals: { theme: "light" } };

/** With somewhere to go, cards become buttons and lift on hover. */
export const Clickable: Story = {
  args: { onOpen: (book) => console.log("open", book.title) },
};

/**
 * Given `onRate`, the stars under each card follow the pointer and commit on
 * click — including the unrated books, whose hollow stars come up on hover.
 */
export const Ratable: Story = {
  render: (args) => {
    const [ratings, setRatings] = useState<Ratings>(SAMPLE_RATINGS);
    return (
      <BookGrid
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

export const Loading: Story = { render: () => <BookGridSkeleton count={12} /> };
