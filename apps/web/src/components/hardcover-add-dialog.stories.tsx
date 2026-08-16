import type { Meta, StoryObj } from "@storybook/tanstack-react";
import type { HardcoverSearchResult } from "@/lib/api";
import { HardcoverAddDialog } from "./hardcover-add-dialog";

/** What a catalogue search plausibly answers for someone typing a title. */
const RESULTS: HardcoverSearchResult[] = [
  {
    id: 391629,
    title: "Piranesi",
    authors: ["Susanna Clarke"],
    coverUrl: null,
    releaseYear: 2020,
  },
  {
    id: 118273,
    title: "Jonathan Strange & Mr Norrell",
    authors: ["Susanna Clarke"],
    coverUrl: null,
    releaseYear: 2004,
  },
  {
    id: 55112,
    title: "The Ladies of Grace Adieu",
    authors: ["Susanna Clarke"],
    coverUrl: null,
    releaseYear: 2006,
  },
];

const meta = {
  title: "Library/HardcoverAddDialog",
  component: HardcoverAddDialog,
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    onOpenChange: () => {},
    readerName: "Mike Valstar",
    search: async () => RESULTS,
    onAdd: async () => {},
  },
} satisfies Meta<typeof HardcoverAddDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Opens on an empty query: there is no book to seed the search from. */
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

/** Hardcover took the search but refused the shelving. */
export const AddFailed: Story = {
  args: {
    onAdd: async () => {
      throw new Error("Hardcover wouldn't add the book to the shelves.");
    },
  },
};
