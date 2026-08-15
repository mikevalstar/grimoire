import type { Decorator, Meta, StoryObj } from "@storybook/tanstack-react";
import { useEffect } from "react";
import { userEvent, within } from "storybook/test";
import { PREF_KEYS } from "@/lib/api";
import { SetupWizard } from "./setup-wizard";

/** No Hardcover account, which is every reader the wizard can produce. */
const UNLINKED = {
  hardcoverUsername: null,
  hardcoverBookCount: 0,
  hardcoverStatusCounts: [],
  hardcoverSyncedAt: null,
  hardcoverSyncError: null,
  ratingsSource: "hardcover" as const,
  readStateSource: "hardcover" as const,
};

/**
 * Stub `fetch` so Test, reader creation, Hardcover linking and Save all respond
 * in isolation — there's no API behind Storybook. Restored when the story
 * unmounts.
 */
const withStubbedApi =
  (responder: (path: string, body: unknown) => unknown): Decorator =>
  (Story) => {
    useEffect(() => {
      const real = globalThis.fetch;
      let nextUserId = 1;
      // Created readers, remembered so the Hardcover step can hand them back
      // linked — the way PUT /api/users/:id/hardcover answers with the reader.
      const users = new Map<number, object>();
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = String(input);
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        const hardcover = path.match(/\/api\/users\/(\d+)\/hardcover(\/test)?$/);
        let payload: unknown;
        if (path.endsWith("/api/users")) {
          // Readers get an id and a timestamp the way the API would.
          const user = {
            id: nextUserId++,
            createdAt: new Date().toISOString(),
            ...UNLINKED,
            ...(body as object),
          };
          users.set((user as { id: number }).id, user);
          payload = user;
        } else if (hardcover?.[2]) {
          payload = { ok: true, username: "bookwyrm" };
        } else if (hardcover) {
          const id = Number(hardcover[1]);
          const known = users.get(id) ?? {
            id,
            name: `Reader ${id}`,
            color: "indigo",
            createdAt: new Date().toISOString(),
            ...UNLINKED,
          };
          payload = {
            ...known,
            hardcoverUsername: init?.method === "PUT" ? "bookwyrm" : null,
          };
        } else {
          payload = responder(path, body);
        }
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
  title: "Setup/SetupWizard",
  component: SetupWizard,
  parameters: { layout: "fullscreen" },
  args: {
    preferences: { [PREF_KEYS.version]: "0" },
    onFinished: () => {},
  },
  decorators: [withStubbedApi(() => ({ ok: true, bookCount: 255 }))],
} satisfies Meta<typeof SetupWizard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** First run: nothing configured, and the content server answers. */
export const FirstRun: Story = {};

export const Light: Story = {
  globals: { theme: "light" },
};

/** The URL is wrong or the content server isn't running — Continue still works. */
export const CalibreUnreachable: Story = {
  decorators: [
    withStubbedApi(() => ({
      ok: false,
      error: "Could not reach http://localhost:8080 (Unable to connect)",
    })),
  ],
};

/** Re-running after a PREFERENCES_VERSION bump: the URL and readers are known. */
export const ReRun: Story = {
  args: {
    preferences: {
      [PREF_KEYS.version]: "1",
      [PREF_KEYS.calibreServerUrl]: "http://bookwyrm.local:8080",
    },
    existingUsers: [
      // Locked on the readers step, and offered a link card on the Hardcover
      // step like anyone created fresh (docs/features/hardcover-connection.md).
      {
        id: 1,
        name: "Mike Valstar",
        color: "indigo",
        createdAt: "2026-08-01T10:00:00.000Z",
        ...UNLINKED,
      },
      {
        id: 2,
        name: "Robin",
        color: "crimson",
        createdAt: "2026-08-01T10:01:00.000Z",
        ...UNLINKED,
      },
    ],
  },
};

/** Clicked through to the Hardcover step: a link card per reader, all optional. */
export const HardcoverStep: Story = {
  args: ReRun.args,
  play: async () => {
    // The dialog portals out of the story root, so search the whole document.
    const body = within(document.body);
    await userEvent.click(await body.findByRole("button", { name: "Get started" }));
    await body.findByText("Connect to Calibre");
    await userEvent.click(body.getByRole("button", { name: "Continue" }));
    await body.findByText("Who's reading?");
    await userEvent.click(body.getByRole("button", { name: "Continue" }));
    await body.findByText("Link Hardcover");
  },
};

/** Phone-width: the swatch grid and footer both stack. */
export const Narrow: Story = {
  globals: { viewport: { value: "mobile1" } },
};
