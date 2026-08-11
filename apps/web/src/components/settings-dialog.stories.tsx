import type { Decorator, Meta, StoryObj } from "@storybook/tanstack-react";
import { useEffect } from "react";
import { PREF_KEYS } from "@/lib/api";
import { SettingsDialog } from "./settings-dialog";

const READERS = [
  { id: 1, name: "Mike Valstar", color: "indigo", createdAt: "2026-08-01T10:00:00.000Z" },
  { id: 2, name: "Robin", color: "crimson", createdAt: "2026-08-01T10:01:00.000Z" },
  { id: 3, name: "Sam Okonjo", color: "emerald", createdAt: "2026-08-02T09:12:00.000Z" },
];

/** Answer the API calls the dialog makes — there's no server behind Storybook. */
const withStubbedApi =
  (users: typeof READERS): Decorator =>
  (Story) => {
    useEffect(() => {
      const real = globalThis.fetch;
      let nextUserId = 100;
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = String(input);
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        const payload =
          path.endsWith("/api/users") && init?.method === "POST"
            ? { id: nextUserId++, createdAt: new Date().toISOString(), ...(body as object) }
            : path.endsWith("/api/users")
              ? users
              : path.endsWith("/api/calibre/test")
                ? { ok: true, bookCount: 1284 }
                : { [PREF_KEYS.calibreServerUrl]: "http://localhost:8080" };
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

export const Default: Story = {};

export const Light: Story = {
  globals: { theme: "light" },
};

/** A single-reader install — the common case for a desktop app. */
export const OneReader: Story = {
  decorators: [withStubbedApi(READERS.slice(0, 1))],
};

export const Narrow: Story = {
  globals: { viewport: { value: "mobile1" } },
};
