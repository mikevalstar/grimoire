import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { SAMPLE_BOOKS } from "@/lib/sample-books";
import { BookDownloadButton } from "./book-download-button";

/**
 * Hidden until the card or row around it is hovered, so every story wraps it in
 * a `group/book` stand-in — hover the dashed box to bring it out. Storybook has
 * no Calibre behind it, so the link itself won't fetch anything.
 */
const meta = {
  title: "Library/BookDownloadButton",
  component: BookDownloadButton,
  args: { book: SAMPLE_BOOKS[0] },
  decorators: [
    (Story) => (
      <div className="group/book border-line flex size-24 items-center justify-center rounded-lg border border-dashed">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BookDownloadButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** EPUB wins over the book's PDF — the tooltip and accessible name say so. */
export const Default: Story = {};

export const Light: Story = { globals: { theme: "light" } };

/** What the hover reveals, without needing to hover. */
export const Revealed: Story = { args: { className: "opacity-100" } };

/** The grid's variant: dark glass, because it lies on a cover in both themes. */
export const Overlay: Story = {
  args: { variant: "overlay", className: "opacity-100" },
  decorators: [
    (Story) => (
      <div className="group/book from-fill-strong to-you-dim flex size-24 items-center justify-center rounded-lg bg-gradient-to-br">
        <Story />
      </div>
    ),
  ],
};

/** The table's variant: smaller, square-ish, sitting in the actions column. */
export const InTable: Story = { args: { className: "size-6 rounded-md opacity-100" } };

/** Nothing to hand over — Calibre has no file for this book. */
export const NoFormats: Story = {
  args: { book: { ...SAMPLE_BOOKS[0], formats: [] }, className: "opacity-100" },
};
