import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { BOOK_SOURCE } from "@/lib/api";
import { LibrarySourceFilter } from "./library-source-filter";

const meta = {
  title: "Library/LibrarySourceFilter",
  component: LibrarySourceFilter,
  args: {
    sources: [BOOK_SOURCE.calibre, BOOK_SOURCE.hardcover],
    value: [],
    onValueChange: () => {},
  },
  render: function Interactive(args) {
    const [value, setValue] = useState<readonly string[]>(args.value);
    return <LibrarySourceFilter {...args} value={value} onValueChange={setValue} />;
  },
} satisfies Meta<typeof LibrarySourceFilter>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing chosen — every source shows, and the trigger stays quiet. */
export const AllSources: Story = {};

/** A real subset: the trigger takes the accent and names the choice. */
export const OneSource: Story = { args: { value: [BOOK_SOURCE.hardcover] } };

/** Three sources, two of them chosen — the trigger counts instead of listing. */
export const Several: Story = {
  args: {
    sources: [BOOK_SOURCE.calibre, BOOK_SOURCE.hardcover, BOOK_SOURCE.grimoire],
    value: [BOOK_SOURCE.calibre, BOOK_SOURCE.grimoire],
  },
};

/** One source is no choice at all, so the control renders nothing. */
export const SingleSourceHidden: Story = { args: { sources: [BOOK_SOURCE.calibre] } };

export const Light: Story = { ...OneSource, globals: { theme: "light" } };
