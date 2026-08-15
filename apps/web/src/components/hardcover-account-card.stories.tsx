import type { Decorator, Meta, StoryObj } from "@storybook/tanstack-react";
import { useEffect } from "react";
import type { User } from "@/lib/api";
import { HardcoverAccountCard } from "./hardcover-account-card";

const READER: User = {
  id: 1,
  name: "Mike Valstar",
  color: "indigo",
  createdAt: "2026-08-01T10:00:00.000Z",
  hardcoverUsername: null,
  hardcoverBookCount: 0,
  hardcoverStatusCounts: [],
  hardcoverSyncedAt: null,
  hardcoverSyncError: null,
  ratingsSource: "hardcover",
  readStateSource: "hardcover",
};

/** A reader whose shelves have been synced (docs/features/hardcover-sync.md). */
const LINKED: User = {
  ...READER,
  hardcoverUsername: "mikevalstar",
  hardcoverBookCount: 312,
  hardcoverStatusCounts: [
    { statusId: 1, count: 87 },
    { statusId: 2, count: 3 },
    { statusId: 3, count: 218 },
    { statusId: 5, count: 4 },
  ],
  hardcoverSyncedAt: "2026-08-14T09:40:00.000Z",
  hardcoverSyncError: null,
};

/**
 * Answer the probe the way Hardcover would — a username on success, and on
 * failure the message the API turns a rejected token into. There's no server
 * behind Storybook, and there is certainly no real token.
 */
const withStubbedApi =
  (response: unknown, status = 200): Decorator =>
  (Story) => {
    useEffect(() => {
      const real = globalThis.fetch;
      globalThis.fetch = async () =>
        new Response(JSON.stringify(response), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      return () => {
        globalThis.fetch = real;
      };
    }, []);
    return <Story />;
  };

const meta = {
  title: "Settings/HardcoverAccountCard",
  component: HardcoverAccountCard,
  args: { user: READER, onChange: () => {} },
  decorators: [
    withStubbedApi({ ok: true, username: "mikevalstar" }),
    (Story) => (
      <div className="max-w-xl p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HardcoverAccountCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing linked yet: the card is an invitation to paste a token. */
export const Unlinked: Story = {};

/** Linked and synced: stats, and the two source toggles. */
export const Linked: Story = {
  args: { user: LINKED },
};

export const LinkedLight: Story = {
  args: { user: LINKED },
  globals: { theme: "light" },
};

/**
 * A link that has gone stale on its own: the last background sync was refused,
 * and the reason sits in the card until one succeeds
 * (docs/features/hardcover-sync.md).
 */
export const SyncFailed: Story = {
  args: {
    user: {
      ...LINKED,
      hardcoverSyncError:
        "Hardcover didn't accept that token (Unable to verify token). Tokens expire a year after they're issued — check yours at hardcover.app/account/api.",
    },
  },
};

/** Linked, but nothing has come across yet — the moment just after saving a token. */
export const NotSyncedYet: Story = {
  args: { user: { ...READER, hardcoverUsername: "mikevalstar" } },
};

/**
 * A token Hardcover won't accept — the common failure, since tokens expire a
 * year after they're issued.
 */
export const Rejected: Story = {
  args: { user: LINKED },
  decorators: [
    withStubbedApi({
      ok: false,
      error:
        "Hardcover didn't accept that token (Unable to verify token). Tokens expire a year after they're issued — check yours at hardcover.app/account/api.",
    }),
  ],
};
