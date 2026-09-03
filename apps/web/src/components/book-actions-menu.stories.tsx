import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { BookActionsMenu } from "./book-actions-menu";

/** A run that takes a moment, so the spinner and the outcome line are both visible. */
const settle =
  (result: { attempted: number; fetched: number }) => async (): Promise<typeof result> => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    return result;
  };

const meta = {
  title: "Library/BookActionsMenu",
  component: BookActionsMenu,
  args: {
    onRefetchCover: settle({ attempted: 1, fetched: 1 }),
    bookTitle: "The Left Hand of Darkness",
  },
  parameters: { layout: "centered" },
} satisfies Meta<typeof BookActionsMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The gear as it sits in the details panel's footer (docs/features/book-actions.md). */
export const Default: Story = {};

export const Light: Story = { globals: { theme: "light" } };

/** Nowhere to fetch from: the run lands, having found nothing. */
export const NothingToFetch: Story = {
  args: { onRefetchCover: settle({ attempted: 0, fetched: 0 }) },
};

/** The content server is down, or the CDN refused. */
export const Fails: Story = {
  args: {
    onRefetchCover: async () => {
      await new Promise((resolve) => setTimeout(resolve, 900));
      throw new Error("Could not reach the Calibre content server.");
    },
  },
};

/**
 * A book with an uploaded file: the delete item is live and confirms before
 * anything happens (docs/features/uploading-a-book.md).
 */
export const Uploaded: Story = {
  args: {
    onDeleteUpload: async () => {
      await new Promise((resolve) => setTimeout(resolve, 900));
    },
  },
};

/** The delete lands on a refusal, which the confirmation shows and stays open for. */
export const DeleteFails: Story = {
  args: {
    onDeleteUpload: async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      throw new Error("That book has no uploaded file to delete.");
    },
  },
};

/** No action handed in at all — the menu still opens and says what it would do. */
export const Unavailable: Story = {
  args: { onRefetchCover: undefined },
};
