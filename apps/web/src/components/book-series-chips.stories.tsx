import type { Meta, StoryObj } from "@storybook/tanstack-react";
import type { SeriesRef } from "@/lib/api";
import { BookSeriesChips } from "./book-series-chips";

const discworld: SeriesRef = {
  id: 1,
  name: "Discworld",
  slug: "discworld",
  hardcoverId: 5,
  booksCount: 41,
  position: 6,
  featured: true,
  source: "hardcover",
  primary: true,
};

const witches: SeriesRef = {
  id: 2,
  name: "Witches",
  slug: "witches",
  hardcoverId: 9,
  booksCount: 6,
  position: 2,
  featured: false,
  source: "hardcover",
  primary: false,
};

const meta = {
  title: "Library/BookSeriesChips",
  component: BookSeriesChips,
  parameters: { layout: "centered" },
  args: { series: "Discworld", seriesIndex: 6, seriesList: [discworld] },
} satisfies Meta<typeof BookSeriesChips>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OneSeries: Story = {};

/**
 * The case the whole feature exists for: Hardcover files a book under both the
 * containing series and the sub-series, and neither is wrong. The primary is
 * what the shelf sorts by; the rest are chips.
 */
export const TwoSeries: Story = {
  args: { seriesList: [discworld, witches] },
};

/**
 * With somewhere to send the click: a chip that isn't leading becomes a button
 * that promotes it. The primary stays plain — it has nothing to do.
 */
export const Promotable: Story = {
  args: { seriesList: [discworld, witches], onChoosePrimary: () => {} },
};

/** From Calibre, which has no mark — the library itself knows this one. */
export const FromCalibre: Story = {
  args: {
    seriesList: [{ ...discworld, source: "calibre", name: "Discworld Novels", position: 6 }],
  },
};

/** Set by hand from the dialog. Marked as Hardcover's, since Calibre has no such series. */
export const SetByHand: Story = {
  args: { seriesList: [{ ...discworld, source: "manual" }] },
};

/** A series nobody numbered — the chip says the series and stops. */
export const NoPosition: Story = {
  args: { seriesList: [{ ...discworld, position: null }] },
};

/** Novellas live at #1.5, so the position prints as given rather than rounded. */
export const HalfPosition: Story = {
  args: { seriesList: [{ ...discworld, position: 1.5 }] },
};

/**
 * A library between an upgrade and its next sync: no attachments yet, so the
 * member row's own string still shows.
 */
export const FallbackString: Story = {
  args: { seriesList: [] },
};

/** No series at all draws nothing, rather than an empty row. */
export const None: Story = {
  args: { series: null, seriesIndex: null, seriesList: [] },
};
