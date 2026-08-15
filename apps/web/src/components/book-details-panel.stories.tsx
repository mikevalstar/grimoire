import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { LibraryBook } from "@/lib/api";
import { SAMPLE_BOOKS } from "@/lib/sample-books";
import { BookDetailsPanel, type BookDetailsPanelProps } from "./book-details-panel";

/**
 * Everything the fixtures don't bother with — publisher, identifiers, a real
 * Calibre description — because this is the screen that shows them. The
 * description is HTML, as Calibre stores it, so these stories are also the
 * proof that it renders as text.
 */
const RICH: LibraryBook = {
  ...SAMPLE_BOOKS[0],
  publisher: "Orbit",
  pages: 539,
  languages: ["eng"],
  identifiers: { isbn: "9780316129077", google: "V0dSAgAAQBAJ" },
  description:
    "<div><p>For generations, the solar system &mdash; Mars, the Moon, the Outer Planets &mdash; was humanity's great frontier.</p><p>Then <i>the alien protomolecule</i> opened a gate to a thousand new worlds, and the great migration began.</p></div>",
};

/**
 * The panel is open whenever it is given a book, so these stories hold the
 * selection themselves — close it and the button brings it back.
 */
function PanelStory({ book, ...props }: BookDetailsPanelProps) {
  const [open, setOpen] = useState<LibraryBook | null>(book);
  return (
    <div className="p-5">
      <Button variant="outline" size="sm" onClick={() => setOpen(book)}>
        Open the panel
      </Button>
      <BookDetailsPanel {...props} book={open} onClose={() => setOpen(null)} />
    </div>
  );
}

const meta = {
  title: "Library/BookDetailsPanel",
  component: BookDetailsPanel,
  args: { book: RICH, rating: 4, onClose: () => {} },
  parameters: { layout: "fullscreen" },
  render: (args) => <PanelStory {...args} />,
} satisfies Meta<typeof BookDetailsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Storybook has no Calibre behind it, so the cover falls back to its placeholder. */
export const Default: Story = {};

/** Hardcover keeps each completion, so rereads remain separate dates. */
export const ReadTwice: Story = {
  args: { readDates: ["2026-07-19", "2021-03"] },
};

/** The history comes directly from Hardcover while the panel is open. */
export const LoadingReadDates: Story = {
  args: { readDatesPending: true },
};

/**
 * The three sections Hardcover can supply instead of Calibre
 * (docs/features/book-details-panel.md). Their description arrives as plain
 * text with CRLF paragraph breaks, which is the case worth having a story for —
 * it renders as paragraphs, not one block.
 */
export const FromHardcover: Story = {
  args: {
    hardcover: {
      about:
        "Two and a half millennia ago, the artifact appeared in a remote corner of space, beside a trillion-year-old dying sun from a different universe.\r\n\r\nIt was a perfect black-body sphere, and it did nothing. Then it disappeared.",
      tags: ["Science Fiction", "Space Opera", "Diverse Characters"],
      moods: ["adventurous", "reflective", "tense"],
    },
  },
};

/** Moods alone, with about and tags switched back to Calibre's. */
export const MoodsOnly: Story = {
  args: { hardcover: { moods: ["hopeful", "mysterious", "slow-paced"] } },
};

export const Light: Story = { globals: { theme: "light" } };

/** Given `onRate`, the stars commit — and here they start visible rather than on hover. */
export const Ratable: Story = {
  render: (args) => {
    const [rating, setRating] = useState(args.rating ?? 0);
    return <PanelStory {...args} rating={rating} onRate={setRating} />;
  },
};

/** A book Grimoire knows almost nothing about: the empty sections are dropped, not dashed. */
export const Sparse: Story = {
  args: { book: SAMPLE_BOOKS[3], rating: 0 },
};

/** Gone from Calibre — the record survives, the file doesn't. */
export const NoLongerInCalibre: Story = {
  args: { book: { ...RICH, calibreId: null }, rating: 5 },
};

/** From hardcover.app alone: no Calibre id and no files at all. */
export const NoFiles: Story = {
  args: { book: SAMPLE_BOOKS[12], rating: 0 },
};

/**
 * A matched work — the same book from Calibre and from hardcover.app — so it
 * has two covers, and the header shows them stacked. Clicking turns the next
 * one over; in the app that choice is saved against the work.
 */
export const TwoCovers: Story = {
  args: { book: { ...SAMPLE_BOOKS[13], description: RICH.description }, rating: 3 },
  render: (args) => {
    const [coverBookId, setCoverBookId] = useState(args.book?.coverBookId ?? null);
    return (
      <PanelStory
        {...args}
        book={args.book && { ...args.book, coverBookId }}
        onChooseCover={setCoverBookId}
      />
    );
  },
};
