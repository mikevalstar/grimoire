import type { Decorator, Meta, StoryObj } from "@storybook/tanstack-react";
import { useEffect } from "react";
import { PREF_KEYS } from "@/lib/api";
import { SetupWizard } from "./setup-wizard";

/**
 * Stub `fetch` so Test, reader creation and Save all respond in isolation —
 * there's no API behind Storybook. Restored when the story unmounts.
 */
const withStubbedApi =
  (responder: (path: string, body: unknown) => unknown): Decorator =>
  (Story) => {
    useEffect(() => {
      const real = globalThis.fetch;
      let nextUserId = 1;
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = String(input);
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        // Readers get an id and a timestamp the way the API would.
        const payload = path.endsWith("/api/users")
          ? { id: nextUserId++, createdAt: new Date().toISOString(), ...(body as object) }
          : responder(path, body);
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
      { id: 1, name: "Mike Valstar", color: "indigo", createdAt: "2026-08-01T10:00:00.000Z" },
      { id: 2, name: "Robin", color: "crimson", createdAt: "2026-08-01T10:01:00.000Z" },
    ],
  },
};

/** Phone-width: the swatch grid and footer both stack. */
export const Narrow: Story = {
  globals: { viewport: { value: "mobile1" } },
};
