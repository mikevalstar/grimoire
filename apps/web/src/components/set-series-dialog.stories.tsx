import type { Meta, StoryObj } from "@storybook/tanstack-react";
import type { SeriesOption, SeriesRoster } from "@/lib/api";
import { SetSeriesDialog } from "./set-series-dialog";

const discworld: SeriesOption = {
  hardcoverId: 5,
  name: "Discworld",
  slug: "discworld",
  booksCount: 41,
  position: 6,
  featured: true,
  seriesId: 1,
  onShelf: 12,
  attached: false,
};

const witches: SeriesOption = {
  hardcoverId: 9,
  name: "Witches",
  slug: "witches",
  booksCount: 6,
  position: 2,
  featured: false,
  seriesId: null,
  onShelf: 4,
  attached: false,
};

const roster: SeriesRoster = {
  series: { ...discworld, position: null, featured: false, attached: false },
  entries: [
    {
      hardcoverBookId: 11,
      title: "The Colour of Magic",
      authors: ["Terry Pratchett"],
      position: 1,
      workId: 101,
      workTitle: "The Colour of Magic",
      match: "title-and-author",
      currentSeries: null,
      currentPosition: null,
    },
    {
      hardcoverBookId: 12,
      title: "Equal Rites",
      authors: ["Terry Pratchett"],
      position: 3,
      workId: 102,
      workTitle: "Equal Rites",
      match: "title-and-author",
      currentSeries: null,
      currentPosition: null,
    },
    {
      hardcoverBookId: 13,
      title: "Mort",
      authors: ["Terry Pratchett"],
      position: 4,
      workId: 103,
      workTitle: "Mort",
      // The one worth a glance: same title, no author in common.
      match: "title-only",
      currentSeries: null,
      currentPosition: null,
    },
    {
      hardcoverBookId: 14,
      title: "Sourcery",
      authors: ["Terry Pratchett"],
      position: 5,
      workId: 104,
      workTitle: "Sourcery",
      match: "title-and-author",
      currentSeries: "Discworld Novels",
      currentPosition: 5,
    },
    {
      hardcoverBookId: 15,
      title: "Wyrd Sisters",
      authors: ["Terry Pratchett"],
      position: 6,
      workId: null,
      workTitle: null,
      match: "none",
      currentSeries: null,
      currentPosition: null,
    },
    {
      hardcoverBookId: 16,
      title: "Pyramids",
      authors: ["Terry Pratchett"],
      position: 7,
      workId: null,
      workTitle: null,
      match: "none",
      currentSeries: null,
      currentPosition: null,
    },
  ],
};

const meta = {
  title: "Library/SetSeriesDialog",
  component: SetSeriesDialog,
  parameters: { layout: "centered" },
  args: {
    open: true,
    onOpenChange: () => {},
    bookTitle: "Wyrd Sisters",
    workId: 105,
    options: [discworld, witches],
    loadRoster: async () => roster,
    onApply: async () => {},
  },
} satisfies Meta<typeof SetSeriesDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Step one. Two series, the featured one preselected, each saying how big it is
 * and how much of it is already here — the number that tells a reader the size
 * of what they are about to do.
 */
export const ChooseSeries: Story = {};

/**
 * The multi-series case, spelled out: check both, and the primary — the one the
 * shelf's series line uses — is the one whose roster the next step spreads
 * across the library. The other is attached to this book alone.
 */
export const TwoSeriesChecked: Story = {
  args: { options: [discworld, { ...witches, attached: true }] },
};

/** One series is the ordinary case; there is still a choice to confirm. */
export const OneSeries: Story = {
  args: { options: [discworld] },
};

/** A book already in the series it is offering — re-running is how a series catches up. */
export const AlreadySet: Story = {
  args: { options: [{ ...discworld, attached: true }] },
};

/** Still asking. */
export const Loading: Story = {
  args: { options: [], loadingOptions: true },
};

/**
 * Hardcover has no series for the book — an ordinary outcome, not an error, and
 * the same surface a series they don't have gets set from.
 */
export const NothingFromHardcover: Story = {
  args: { options: [] },
};

/** No token, so nothing could be asked. The typed fallback is still offered. */
export const NoHardcoverAccount: Story = {
  args: {
    options: [],
    optionsError: "This reader has no Hardcover account linked. Set a series by hand:",
  },
};

/** A roster that fails after the series is chosen keeps the dialog open and says why. */
export const RosterFailed: Story = {
  args: {
    loadRoster: async () => {
      throw new Error("Hardcover did not answer.");
    },
  },
};
