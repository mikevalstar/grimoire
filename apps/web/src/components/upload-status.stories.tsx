import type { Meta, StoryObj } from "@storybook/tanstack-react";
import type { UploadItem } from "@/lib/upload-queue";
import { UploadStatus } from "./upload-status";

const meta = {
  title: "Library/UploadStatus",
  component: UploadStatus,
  parameters: { layout: "fullscreen" },
  args: { onDismiss: () => {}, onOpenBook: () => {} },
} satisfies Meta<typeof UploadStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

const ITEMS: UploadItem[] = [
  { id: 1, name: "Are Filter Bubbles Real.epub", status: "added", bookId: 12 },
  { id: 2, name: "Alpha and Omega - Charles Seife.epub", status: "existing", bookId: 7 },
  {
    id: 3,
    name: "notes.pdf",
    status: "failed",
    error: 'Grimoire can\'t take "notes.pdf" — only EPUB files, today.',
  },
];

/** Mid-batch: one in flight, more waiting, and two already reported on. */
export const Uploading: Story = {
  args: {
    items: [
      ...ITEMS.slice(0, 2),
      { id: 4, name: "The Blockchain and the New Architecture of Trust.epub", status: "uploading" },
      { id: 5, name: "The Art of Wish.epub", status: "queued" },
      { id: 6, name: "Children of Time.epub", status: "queued" },
    ],
  },
};

/** Everything has landed one way or another, and the strip can be dismissed. */
export const Finished: Story = {
  args: { items: ITEMS },
};

export const FinishedLight: Story = {
  args: { items: ITEMS },
  globals: { theme: "light" },
};
