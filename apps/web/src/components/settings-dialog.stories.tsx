import type { Decorator, Meta, StoryObj } from "@storybook/tanstack-react";
import { useEffect } from "react";
import { PREF_KEYS } from "@/lib/api";
import { SAMPLE_BOOKS } from "@/lib/sample-books";
import { SettingsDialog } from "./settings-dialog";

const READERS = [
  {
    id: 1,
    name: "Mike Valstar",
    color: "indigo",
    createdAt: "2026-08-01T10:00:00.000Z",
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
  },
  {
    id: 2,
    name: "Robin",
    color: "crimson",
    createdAt: "2026-08-01T10:01:00.000Z",
    hardcoverUsername: null,
  },
  {
    id: 3,
    name: "Sam Okonjo",
    color: "emerald",
    createdAt: "2026-08-02T09:12:00.000Z",
    hardcoverUsername: null,
  },
];

/** A library that synced a few minutes ago, so the sync section has something to show. */
const SYNC_STATUS = {
  running: false,
  progress: null,
  lastCompletedAt: "2026-08-14T09:55:00.000Z",
  lastAttemptedAt: "2026-08-14T09:55:00.000Z",
  lastStatus: "ok",
  lastError: null,
  lastErrorHint: null,
  bookCount: 1284,
  inLibraryCount: 1284,
  intervalMinutes: 5,
  configured: true,
};

/** Answer the API calls the dialog makes — there's no server behind Storybook. */
const withStubbedApi =
  (users: typeof READERS): Decorator =>
  (Story) => {
    useEffect(() => {
      const real = globalThis.fetch;
      let nextUserId = 100;

      const respond = (path: string, method: string, body: unknown): unknown => {
        // Hardcover is per reader, so its paths carry the reader's id
        // (docs/features/hardcover-connection.md).
        const reader = users.find((user) => path.includes(`/api/users/${user.id}/hardcover`));
        if (reader) {
          if (path.endsWith("/test")) return { ok: true, username: "mikevalstar" };
          return {
            ...reader,
            hardcoverUsername: method === "DELETE" ? null : "mikevalstar",
          };
        }

        if (path.endsWith("/api/users")) {
          return method === "POST"
            ? {
                id: nextUserId++,
                createdAt: new Date().toISOString(),
                hardcoverUsername: null,
                ...(body as object),
              }
            : users;
        }
        if (path.endsWith("/api/calibre/test")) return { ok: true, bookCount: 1284 };
        if (path.endsWith("/api/sync")) return SYNC_STATUS;
        // The review queue and the shelf it names books from
        // (docs/features/resolving-duplicates.md).
        if (path.endsWith("/api/duplicates")) {
          return {
            pairs: [{ workId: 1, otherWorkId: 2, bookId: 11, otherBookId: 22, reason: "exact" }],
            total: 1,
          };
        }
        if (path.endsWith("/api/books")) return SAMPLE_BOOKS;
        return { [PREF_KEYS.calibreServerUrl]: "http://localhost:8080" };
      };

      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const payload = respond(
          String(input),
          init?.method ?? "GET",
          init?.body ? JSON.parse(String(init.body)) : undefined,
        );
        return new Response(JSON.stringify(payload), {
          headers: { "Content-Type": "application/json" },
        });
      };
      return () => {
        globalThis.fetch = real;
      };
    }, []);
    return <Story />;
  };

const meta = {
  title: "Settings/SettingsDialog",
  component: SettingsDialog,
  parameters: { layout: "fullscreen" },
  args: { open: true, onOpenChange: () => {} },
  decorators: [withStubbedApi(READERS)],
} satisfies Meta<typeof SettingsDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Opens on Calibre: the connection, the sync stat tiles, and Sync now. */
export const Default: Story = {};

/** A card per reader — linked ones get stats and the source toggles. */
export const Hardcover: Story = {
  args: { section: "hardcover" },
};

/** Listing and adding only — switching moved to the header avatar menu. */
export const Readers: Story = {
  args: { section: "readers" },
};

export const Duplicates: Story = {
  args: { section: "duplicates" },
};

export const Light: Story = {
  globals: { theme: "light" },
};

/** A single-reader install — the common case for a desktop app. */
export const OneReader: Story = {
  decorators: [withStubbedApi(READERS.slice(0, 1))],
};

/** Below `sm` the section sidebar becomes a strip across the top. */
export const Narrow: Story = {
  globals: { viewport: { value: "mobile1" } },
};
