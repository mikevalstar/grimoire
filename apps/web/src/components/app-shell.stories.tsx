import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { AppShell } from "./app-shell";

const meta = {
  title: "Shell/AppShell",
  component: AppShell,
  parameters: { layout: "fullscreen" },
  args: {
    bookCount: 1284,
    user: {
      id: 1,
      name: "Mike Valstar",
      color: "indigo",
      createdAt: "2026-08-01T10:00:00.000Z",
      hardcoverUsername: null,
      hardcoverBookCount: 0,
      hardcoverStatusCounts: [],
      hardcoverSyncedAt: null,
      hardcoverSyncError: null,
      ratingsSource: "local",
      readStateSource: "hardcover",
    },
  },
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <p className="text-muted-foreground text-[13px]">
        Screens render here — full width, scrolling under the header.
      </p>
    ),
  },
};

/** Enough content to show the header staying put over it. */
export const Scrolling: Story = {
  args: {
    children: (
      <ul className="space-y-1">
        {Array.from({ length: 60 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed filler rows, never reordered
          <li key={i} className="text-[13px]">
            Book {i + 1}
            <span className="text-muted-foreground"> — An Author</span>
          </li>
        ))}
      </ul>
    ),
  },
};
