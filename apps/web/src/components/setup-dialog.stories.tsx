import { useEffect } from "react";
import type { Decorator, Meta, StoryObj } from "@storybook/tanstack-react";
import { PREF_KEYS } from "@/lib/api";
import { SetupDialog } from "./setup-dialog";

/**
 * Stub `fetch` so Test and Save respond in isolation — there's no API behind
 * Storybook. Restored when the story unmounts.
 */
const withStubbedApi =
  (responder: (path: string) => unknown): Decorator =>
  (Story) => {
    useEffect(() => {
      const real = globalThis.fetch;
      globalThis.fetch = async (input: RequestInfo | URL) =>
        new Response(JSON.stringify(responder(String(input))), {
          headers: { "Content-Type": "application/json" },
        });
      return () => {
        globalThis.fetch = real;
      };
    }, []);
    return <Story />;
  };

const meta = {
  title: "Setup/SetupDialog",
  component: SetupDialog,
  parameters: { layout: "fullscreen" },
  args: {
    preferences: { [PREF_KEYS.version]: "0" },
    onSaved: () => {},
  },
} satisfies Meta<typeof SetupDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** First run: nothing configured, Test finds a library. */
export const FirstRun: Story = {
  decorators: [withStubbedApi(() => ({ ok: true, bookCount: 255 }))],
};

/** The URL is wrong or the content server isn't running. */
export const TestFails: Story = {
  decorators: [
    withStubbedApi(() => ({
      ok: false,
      error: "Could not reach http://localhost:8080 (Unable to connect)",
    })),
  ],
};

/** Re-running setup after a PREFERENCES_VERSION bump: the URL is already known. */
export const AlreadyConfigured: Story = {
  args: {
    preferences: {
      [PREF_KEYS.version]: "0",
      [PREF_KEYS.calibreServerUrl]: "http://bookwyrm.local:8080",
    },
  },
  decorators: [withStubbedApi(() => ({ ok: true, bookCount: 1284 }))],
};
