import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { ApiError } from "@/lib/api";
import { SAMPLE_BOOKS } from "@/lib/sample-books";
import { BookLibrary } from "./book-library";

const LARGE_LIBRARY = Array.from({ length: 2_000 }, (_, index) => {
  const sample = SAMPLE_BOOKS[index % SAMPLE_BOOKS.length]!;
  const id = index + 10_000;
  return {
    ...sample,
    id,
    calibreId: null,
    title: `${String(index + 1).padStart(4, "0")} · ${sample.title}`,
    coverState: "none" as const,
    covers: [],
    coverBookId: null,
  };
});

/**
 * The whole library screen. The view it opens in is whatever this browser last
 * chose (localStorage) — flip it with the switcher and reload to see it stick.
 */
const meta = {
  title: "Library/BookLibrary",
  component: BookLibrary,
  args: { books: SAMPLE_BOOKS, isRead: (book) => book.id % 2 === 0 },
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="h-screen px-5 py-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BookLibrary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Light: Story = { globals: { theme: "light" } };

export const Loading: Story = { args: { books: undefined, isPending: true } };

export const Empty: Story = { args: { books: [] } };

/** A shelf large enough to verify that only the visible visual rows are mounted. */
export const VirtualizedLargeLibrary: Story = { args: { books: LARGE_LIBRARY } };

/** The usual failure: the content server isn't running, and says so with a hint. */
export const Unreachable: Story = {
  args: {
    books: undefined,
    error: new ApiError(
      502,
      "Could not reach the Calibre content server at http://localhost:8080",
      "Start it with `calibre-server` (or calibre Preferences → Sharing over the net), then check the content server URL in Grimoire's settings.",
    ),
    onRetry: () => console.log("retry"),
  },
};
