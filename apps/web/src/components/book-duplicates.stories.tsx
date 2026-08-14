import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { SAMPLE_BOOKS } from "@/lib/sample-books";
import { BookDuplicates } from "./book-duplicates";

/**
 * Storybook has no cover cache behind it, so every candidate draws the title
 * placeholder — which is also what a real duplicate looks like before its cover
 * has been fetched. `bookFor` reads the same fixtures the shelf would.
 */
const bookFor = (workId: number) => SAMPLE_BOOKS.find((book) => book.id === workId);

const meta = {
  title: "Library/BookDuplicates",
  component: BookDuplicates,
  args: {
    bookFor,
    onLink: () => {},
    onDismiss: () => {},
    onSeparate: () => {},
    duplicates: {
      members: [
        {
          bookId: 13,
          source: "hardcover",
          title: "The Blade Itself",
          authors: ["Joe Abercrombie"],
        },
      ],
      candidates: [{ workId: 1, bookId: 13, otherBookId: 101, reason: "exact" }],
    },
  },
  decorators: [
    (Story) => (
      <div className="max-w-[520px] p-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BookDuplicates>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The common case: one entry, and one thing that looks like the same book. */
export const Default: Story = {};

export const Light: Story = { ...Default, globals: { theme: "light" } };

/** All three reasons at once, in the order they are offered. */
export const EveryReason: Story = {
  args: {
    duplicates: {
      members: [
        {
          bookId: 13,
          source: "hardcover",
          title: "The Blade Itself",
          authors: ["Joe Abercrombie"],
        },
      ],
      candidates: [
        { workId: 1, bookId: 13, otherBookId: 101, reason: "exact" },
        { workId: 2, bookId: 13, otherBookId: 102, reason: "subtitle" },
        { workId: 3, bookId: 13, otherBookId: 103, reason: "title" },
      ],
    },
  },
};

/** One work, two entries — the shape a merge leaves behind. */
const MERGED_MEMBERS = [
  { bookId: 14, source: "calibre", title: "Piranesi", authors: ["Susanna Clarke"] },
  { bookId: 114, source: "hardcover", title: "Piranesi: A Novel", authors: ["Susanna Clarke"] },
];

/**
 * After a merge: the entries the book is made of, each with its own title —
 * the difference between them is the reason the list is worth reading.
 */
export const Merged: Story = {
  args: { duplicates: { members: MERGED_MEMBERS, candidates: [] } },
};

/** Both at once — merged, and something else still looks related. */
export const MergedWithCandidate: Story = {
  args: {
    duplicates: {
      members: MERGED_MEMBERS,
      candidates: [{ workId: 12, bookId: 14, otherBookId: 104, reason: "subtitle" }],
    },
  },
};

/** Without handlers it is a read-out: what this book is made of, and nothing to press. */
export const ReadOnly: Story = {
  args: { onLink: undefined, onDismiss: undefined, onSeparate: undefined },
};

/** A write in flight — every answer stops taking clicks until it lands. */
export const Busy: Story = { args: { busy: true } };

/**
 * A candidate naming a work the shelf hasn't heard of is dropped rather than
 * drawn as an empty row. Here that leaves the single entry, and so nothing.
 */
export const UnknownCandidate: Story = {
  args: {
    duplicates: {
      members: [
        {
          bookId: 13,
          source: "hardcover",
          title: "The Blade Itself",
          authors: ["Joe Abercrombie"],
        },
      ],
      candidates: [{ workId: 9_999, bookId: 13, otherBookId: 199, reason: "exact" }],
    },
  },
};
