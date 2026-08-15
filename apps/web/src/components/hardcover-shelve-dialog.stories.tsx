import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { SAMPLE_BOOKS } from "@/lib/sample-books";
import { HardcoverShelveDialog } from "./hardcover-shelve-dialog";

const meta = {
  title: "Library/HardcoverShelveDialog",
  component: HardcoverShelveDialog,
  parameters: { layout: "fullscreen" },
  args: {
    pending: { book: SAMPLE_BOOKS[0]!, rating: 4, statusId: null },
    readerName: "Mike Valstar",
    onConfirm: () => {},
    onJustRate: () => {},
    onCancel: () => {},
  },
} satisfies Meta<typeof HardcoverShelveDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Not on their shelves at all — rating adds it as Read. */
export const Default: Story = {};

/** On their Want to Read shelf — rating can mark it Read, or just rate. */
export const MarkAsRead: Story = {
  args: { pending: { book: SAMPLE_BOOKS[0]!, rating: 4, statusId: 1 } },
};

/** Mid-book: the common "finished it, rating it now" moment. */
export const CurrentlyReading: Story = {
  args: { pending: { book: SAMPLE_BOOKS[0]!, rating: 4.5, statusId: 2 } },
};

export const Light: Story = {
  globals: { theme: "light" },
};
