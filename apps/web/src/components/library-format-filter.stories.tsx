import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { LibraryFormatFilter } from "./library-format-filter";

const meta = {
  title: "Library/LibraryFormatFilter",
  component: LibraryFormatFilter,
  args: {
    formats: ["AZW3", "EPUB", "MOBI", "PDF"],
    value: [],
    onValueChange: () => {},
  },
  render: function Interactive(args) {
    const [value, setValue] = useState<readonly string[]>(args.value);
    return <LibraryFormatFilter {...args} value={value} onValueChange={setValue} />;
  },
} satisfies Meta<typeof LibraryFormatFilter>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing chosen — every format shows, and the trigger stays quiet. */
export const AllFormats: Story = {};

/** A real subset: the trigger takes the accent and names the choice. */
export const OneFormat: Story = { args: { value: ["EPUB"] } };

/** Loading a Kindle: two formats chosen, so the trigger counts instead of listing. */
export const Several: Story = { args: { value: ["AZW3", "MOBI"] } };

/** One format is no choice at all, so the control renders nothing. */
export const SingleFormatHidden: Story = { args: { formats: ["EPUB"] } };

export const Light: Story = { ...OneFormat, globals: { theme: "light" } };
