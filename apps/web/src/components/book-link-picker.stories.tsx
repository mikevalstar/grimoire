import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { searchBooks } from "@/lib/book-search";
import { SAMPLE_BOOKS } from "@/lib/sample-books";
import { BookLinkPicker } from "./book-link-picker";

const BOOK = SAMPLE_BOOKS[0];

/**
 * The real search, over the fixture shelf — so typing in these stories ranks
 * results the way the app does. Storybook has no cover cache, so every result
 * falls back to its title.
 */
const meta = {
  title: "Library/BookLinkPicker",
  component: BookLinkPicker,
  args: {
    book: BOOK,
    search: (query: string) => searchBooks(SAMPLE_BOOKS, query, { exclude: BOOK.id }),
    onPick: async () => {},
    onCancel: () => {},
  },
  decorators: [
    (Story) => (
      <div className="max-w-[560px] p-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BookLinkPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Opens seeded with the book's own title, which is usually the query wanted. */
export const Default: Story = {};

export const Light: Story = { ...Default, globals: { theme: "light" } };

/**
 * Searching by author, which is half of how anyone finds the other copy —
 * and the fixture that is already two entries says so in its row.
 */
export const ByAuthor: Story = {
  args: { book: { ...BOOK, title: "Clarke" } },
};

/** A query nothing matches: said plainly rather than left as an empty box. */
export const NoMatches: Story = {
  args: { book: { ...BOOK, title: "a title no fixture has" } },
};

/** The box cleared. There is nothing to list until something is typed. */
export const Empty: Story = {
  args: { book: { ...BOOK, title: "" } },
};

/** A join the server refused — the search stays open, holding the reason. */
export const Failing: Story = {
  args: {
    onPick: () => Promise.reject(new Error("Those aren't two different books to join.")),
  },
};
