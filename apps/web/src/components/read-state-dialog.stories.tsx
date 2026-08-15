import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { SAMPLE_BOOKS } from "@/lib/sample-books";
import { ReadStateDialog } from "./read-state-dialog";

const meta = {
  title: "Library/ReadStateDialog",
  component: ReadStateDialog,
  parameters: { layout: "fullscreen" },
  args: {
    pending: {
      book: SAMPLE_BOOKS[0]!,
      read: true,
      shelfState: "shelved",
      currentRating: 0,
      offerRating: true,
    },
    readerName: "Mike Valstar",
    onConfirm: () => {},
    onCancel: () => {},
  },
} satisfies Meta<typeof ReadStateDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Marking read on Hardcover: finished-when, plus the optional stars. */
export const MarkRead: Story = {};

/** The local flavour — read state kept in grimoire.db. */
export const MarkReadLocal: Story = {
  args: {
    pending: {
      book: SAMPLE_BOOKS[0]!,
      read: true,
      shelfState: null,
      currentRating: 0,
      offerRating: true,
    },
  },
};

/** A book Hardcover doesn't have on their shelves yet — adding is part of it. */
export const MarkReadUnshelved: Story = {
  args: {
    pending: {
      book: SAMPLE_BOOKS[0]!,
      read: true,
      shelfState: "unshelved",
      currentRating: 0,
      offerRating: true,
    },
  },
};

/** Unmarking a rated book: keep the stars, or take them too. */
export const UnmarkWithRating: Story = {
  args: {
    pending: {
      book: SAMPLE_BOOKS[0]!,
      read: false,
      shelfState: "shelved",
      currentRating: 4.5,
      offerRating: true,
    },
  },
};

/** Unmarking an unrated book — just the confirm. */
export const UnmarkPlain: Story = {
  args: {
    pending: {
      book: SAMPLE_BOOKS[0]!,
      read: false,
      shelfState: null,
      currentRating: 0,
      offerRating: true,
    },
  },
};

export const Light: Story = {
  globals: { theme: "light" },
};
