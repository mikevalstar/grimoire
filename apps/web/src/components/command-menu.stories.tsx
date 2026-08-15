import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import type { User } from "@/lib/api";
import { SAMPLE_BOOKS } from "@/lib/sample-books";
import { CommandMenu } from "./command-menu";

const READERS: User[] = [
  {
    id: 1,
    name: "Mike Valstar",
    color: "indigo",
    createdAt: "2026-08-01T10:00:00.000Z",
    hardcoverUsername: "mikevalstar",
    hardcoverBookCount: 312,
    hardcoverStatusCounts: [],
    hardcoverSyncedAt: "2026-08-14T09:40:00.000Z",
    hardcoverSyncError: null,
    ratingsSource: "local",
    readStateSource: "hardcover",
  },
  {
    id: 2,
    name: "Robin",
    color: "crimson",
    createdAt: "2026-08-01T10:01:00.000Z",
    hardcoverUsername: null,
    hardcoverBookCount: 0,
    hardcoverStatusCounts: [],
    hardcoverSyncedAt: null,
    hardcoverSyncError: null,
    ratingsSource: "local",
    readStateSource: "hardcover",
  },
];

const meta = {
  title: "Shell/CommandMenu",
  component: CommandMenu,
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    onOpenChange: () => {},
    books: SAMPLE_BOOKS,
    bookCount: SAMPLE_BOOKS.length,
    users: READERS,
    currentUser: READERS[0],
    onPickUser: () => {},
    onSync: () => {},
    onOpenSettings: () => {},
    onOpenBook: () => {},
  },
} satisfies Meta<typeof CommandMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Empty query: the full command list, grouped. */
export const Default: Story = {};

export const Light: Story = {
  globals: { theme: "light" },
};

/** Without the optional handlers only view/sort/group/theme remain. */
export const CommandsOnly: Story = {
  args: {
    books: undefined,
    users: undefined,
    onPickUser: undefined,
    onSync: undefined,
    onOpenSettings: undefined,
  },
};

/** Close it, press Cmd+K (or click nothing — use the story controls) to reopen. */
export const Interactive: Story = {
  render: function Interactive(args) {
    const [open, setOpen] = useState(true);
    return <CommandMenu {...args} open={open} onOpenChange={setOpen} />;
  },
};
