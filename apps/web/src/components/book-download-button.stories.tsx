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

/** Two formats, so the button opens a picker — EPUB first, then the PDF. */
export const Default: Story = {};

export const Light: Story = { globals: { theme: "light" } };

/** What the hover reveals, without needing to hover. */
export const Revealed: Story = { args: { className: "opacity-100" } };

/**
 * One format is no choice at all, so the button skips the menu and downloads
 * straight away — the majority of a real library.
 */
export const SingleFormat: Story = {
  args: { book: { ...SAMPLE_BOOKS[0], formats: ["EPUB"] }, className: "opacity-100" },
};

/**
 * The picker, with everything a book might carry. Ranked formats lead in
 * portability order; the rest follow alphabetically.
 */
export const ManyFormats: Story = {
  args: {
    book: { ...SAMPLE_BOOKS[0], formats: ["PDF", "CBZ", "MOBI", "EPUB", "AZW3", "TXT"] },
    className: "opacity-100",
  },
};

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

/**
 * The details panel's variant: labelled, always visible, and the screen's own
 * action rather than a card's (docs/features/book-details-panel.md).
 */
export const Panel: Story = { args: { variant: "panel" } };

/** The same, with only one format to offer — so it names it. */
export const PanelSingleFormat: Story = {
  args: { variant: "panel", book: { ...SAMPLE_BOOKS[0], formats: ["EPUB"] } },
};

/** Nothing to hand over — Calibre has no file for this book. */
export const NoFormats: Story = {
  args: { book: { ...SAMPLE_BOOKS[0], formats: [] }, className: "opacity-100" },
};
