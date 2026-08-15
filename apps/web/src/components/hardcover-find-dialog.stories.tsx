import type { Meta, StoryObj } from "@storybook/tanstack-react";
import type { HardcoverSearchResult } from "@/lib/api";
import { SAMPLE_BOOKS } from "@/lib/sample-books";
import { HardcoverFindDialog } from "./hardcover-find-dialog";

/** What a catalogue search plausibly answers — the right book first, then noise. */
const RESULTS: HardcoverSearchResult[] = [
  {
    id: 391629,
    title: SAMPLE_BOOKS[0]!.title,
    authors: SAMPLE_BOOKS[0]!.authors,
    coverUrl: null,
    releaseYear: 2014,
  },
  {
    id: 118273,
    title: `${SAMPLE_BOOKS[0]!.title}: The Graphic Novel`,
    authors: SAMPLE_BOOKS[0]!.authors,
    coverUrl: null,
    releaseYear: 2021,
  },
  {
    id: 55112,
    title: "A Different Book Entirely",
    authors: ["Somebody Else"],
    coverUrl: null,
    releaseYear: 1998,
  },
];

const meta = {
  title: "Library/HardcoverFindDialog",
  component: HardcoverFindDialog,
  parameters: { layout: "fullscreen" },
  args: {
    pending: { book: SAMPLE_BOOKS[0]!, rating: 4.5 },
    readerName: "Mike Valstar",
    search: async () => RESULTS,
    onConfirm: async () => {},
    onCancel: () => {},
  },
} satisfies Meta<typeof HardcoverFindDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Light: Story = {
  globals: { theme: "light" },
};

/** Their catalogue has never heard of it. */
export const NoMatches: Story = {
  args: { search: async () => [] },
};

/** The search itself refused — an expired token, a rate limit. */
export const SearchFailed: Story = {
  args: {
    search: async () => {
      throw new Error(
        "Hardcover didn't accept that token (Unable to verify token). Tokens expire a year after they're issued.",
      );
    },
  },
};
