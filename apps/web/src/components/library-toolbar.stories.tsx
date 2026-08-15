import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { ReadStatusFilter } from "@/components/read-status-filter";
import type { ViewMode } from "@/lib/view-mode";
import { LibraryToolbar } from "./library-toolbar";

const meta = {
  title: "Library/LibraryToolbar",
  component: LibraryToolbar,
  args: {
    view: "covers",
    onViewChange: () => {},
    statusFilter: (
      <ReadStatusFilter
        value="all"
        onValueChange={() => {}}
        counts={{ all: 255, "to-read": 163, read: 92 }}
      />
    ),
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-4xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LibraryToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Light: Story = { globals: { theme: "light" } };

/** What it becomes once filters exist and take the reserved space. */
export const WithFilters: Story = {
  args: {
    children: (
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {["All", "Reading", "Unread", "Science Fiction"].map((pill) => (
          <span
            key={pill}
            className="border-line bg-fill text-muted-foreground rounded-full border px-2.5 py-1 text-[11px]"
          >
            {pill}
          </span>
        ))}
      </div>
    ),
  },
};

export const Interactive: Story = {
  render: function Interactive(args) {
    const [view, setView] = useState<ViewMode>(args.view);
    return <LibraryToolbar {...args} view={view} onViewChange={setView} />;
  },
};
