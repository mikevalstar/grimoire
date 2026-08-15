import type { Meta, StoryObj } from "@storybook/tanstack-react";
import type { User } from "@/lib/api";
import { UserMenu } from "./user-menu";

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
  {
    id: 3,
    name: "Sam Okonjo",
    color: "emerald",
    createdAt: "2026-08-02T09:12:00.000Z",
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
  title: "Shell/UserMenu",
  component: UserMenu,
  // Room below the trigger, so the opened menu fits inside the story frame.
  decorators: [
    (Story) => (
      <div className="flex h-80 justify-end p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    users: READERS,
    currentUser: READERS[0],
    onPickUser: () => {},
    onAddReader: () => {},
    onOpenSettings: () => {},
  },
} satisfies Meta<typeof UserMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Light: Story = {
  globals: { theme: "light" },
};

/** Nobody picked yet — the chip falls back to the app's own initial. */
export const NoCurrentReader: Story = {
  args: { currentUser: undefined },
};

/** A single-reader install — the menu is mostly a door into settings. */
export const OneReader: Story = {
  args: { users: READERS.slice(0, 1) },
};
