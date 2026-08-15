import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { LibraryQuickFilter } from "./library-quick-filter";

const meta = {
  title: "Library/LibraryQuickFilter",
  component: LibraryQuickFilter,
  args: { value: "", onChange: () => {} },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LibraryQuickFilter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Default(args) {
    const [value, setValue] = useState(args.value);
    return <LibraryQuickFilter {...args} value={value} onChange={setValue} />;
  },
};

export const WithQuery: Story = {
  args: { value: "alastair revelation" },
  render: function WithQuery(args) {
    const [value, setValue] = useState(args.value);
    return <LibraryQuickFilter {...args} value={value} onChange={setValue} />;
  },
};

export const Light: Story = { ...WithQuery, globals: { theme: "light" } };
