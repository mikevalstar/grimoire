import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { SAMPLE_BOOKS } from "@/lib/sample-books";
import { BookCoverStack } from "./book-cover-stack";

/**
 * Storybook has no cover cache behind it, so every sheet in the stack draws the
 * same placeholder — the shape and the interaction are what these stories show.
 * The matched fixture is the only one with two covers: one work, a Calibre
 * member and a Hardcover one, each with its own jacket.
 */
const MATCHED = SAMPLE_BOOKS[13];

const meta = {
  title: "Library/BookCoverStack",
  component: BookCoverStack,
  args: { book: MATCHED, width: 104 },
  decorators: [
    (Story) => (
      <div className="p-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BookCoverStack>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Click it: the next cover comes to the front and the old one tucks behind. */
export const Default: Story = {
  render: (args) => {
    const [book, setBook] = useState(args.book);
    return (
      <BookCoverStack
        {...args}
        book={book}
        onChoose={(bookId) => setBook((current) => ({ ...current, coverBookId: bookId }))}
      />
    );
  },
};

export const Light: Story = { ...Default, globals: { theme: "light" } };

/** Three sources would tilt alternately rather than fanning one way. */
export const Three: Story = {
  ...Default,
  args: {
    book: {
      ...MATCHED,
      covers: [
        { bookId: 14, source: "calibre" },
        { bookId: 114, source: "hardcover" },
        { bookId: 214, source: "grimoire" },
      ],
    },
  },
};

/** At shelf size, where a stack has to read at a glance. */
export const Small: Story = { ...Default, args: { width: 60 } };

/** One cover is not a stack: no tilt, no badge, and nothing to click. */
export const SingleCover: Story = { args: { book: SAMPLE_BOOKS[0] } };

/** Without `onChoose` it is a picture, however many covers the work has. */
export const ReadOnly: Story = { args: { book: MATCHED } };
