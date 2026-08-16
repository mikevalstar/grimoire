import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { FilterLink } from "./filter-link";

/**
 * A name on a book that narrows the shelf to it. It takes the type of the line
 * it sits in — only the hover says it is a control — so these are shown at the
 * sizes a cover card and the details panel actually use.
 */
const meta = {
  title: "Library/FilterLink",
  component: FilterLink,
  args: { field: "author", value: "Ursula K. Le Guin", onFilter: () => {} },
  decorators: [
    (Story) => (
      <div className="text-muted-foreground p-6 text-[11px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FilterLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Author: Story = {};

export const Light: Story = { globals: { theme: "light" } };

export const Series: Story = { args: { field: "series", value: "Earthsea" } };

/** Several authors, comma-separated, as a cover card draws them. */
export const AuthorList: Story = {
  render: (args) => (
    <p>
      {["Terry Pratchett", "Neil Gaiman"].map((author, index) => (
        <span key={author}>
          {index > 0 && ", "}
          <FilterLink {...args} field="author" value={author} />
        </span>
      ))}
    </p>
  ),
};

/** Nowhere to send the click: the name is plain text, not a dead button. */
export const NotFilterable: Story = { args: { onFilter: undefined } };
