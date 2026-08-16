import type { Meta, StoryObj } from "@storybook/tanstack-react";
import type { User } from "@/lib/api";
import { AppHeader } from "./app-header";

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
  title: "Shell/AppHeader",
  component: AppHeader,
  parameters: { layout: "fullscreen" },
  args: {
    bookCount: 1284,
    user: READERS[0],
    users: READERS,
    onPickUser: () => {},
    // A linked reader, so the + beside the search is offered.
    onAddBook: () => {},
  },
} satisfies Meta<typeof AppHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Light: Story = {
  globals: { theme: "light" },
};

/** Before the library has loaded, the placeholder drops the count. */
export const CountUnknown: Story = {
  args: { bookCount: undefined },
};

/**
 * One reader, so the avatar's tooltip offers adding another rather than
 * promising a switch there is nothing to switch to.
 */
export const SingleReader: Story = {
  args: { users: [READERS[0]!], user: READERS[0] },
};

/** Nobody picked yet — the avatar is a prompt, not a name. */
export const NoCurrentReader: Story = {
  args: { user: undefined },
};

/** Without a reader list the avatar is a plain chip, not a menu. */
export const NoReaderList: Story = {
  args: { users: undefined },
};

/** Below `sm` the wide search trigger and the + both collapse to icons. */
export const Narrow: Story = {
  globals: { viewport: { value: "mobile1" } },
};

/**
 * A reader with no Hardcover account: nowhere to add a book to, so the + is
 * absent (docs/features/adding-a-book-from-hardcover.md).
 */
export const NoHardcover: Story = {
  args: { user: READERS[1], onAddBook: undefined },
};
