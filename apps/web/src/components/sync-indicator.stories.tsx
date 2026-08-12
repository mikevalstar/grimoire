import type { Meta, StoryObj } from "@storybook/tanstack-react";
import type { SyncStatus } from "@/lib/api";
import { SyncIndicator } from "./sync-indicator";

const base: SyncStatus = {
  running: false,
  progress: null,
  lastCompletedAt: new Date(Date.now() - 4 * 60_000).toISOString(),
  lastAttemptedAt: new Date(Date.now() - 4 * 60_000).toISOString(),
  lastStatus: "ok",
  lastError: null,
  lastErrorHint: null,
  bookCount: 255,
  inLibraryCount: 255,
  intervalMinutes: 5,
  configured: true,
};

const meta = {
  title: "Shell/SyncIndicator",
  component: SyncIndicator,
  args: { status: base },
} satisfies Meta<typeof SyncIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {};

export const IdleLight: Story = { globals: { theme: "light" } };

/** Mid-sync. The glyph spins for motion-safe users and pulses for everyone else. */
export const Syncing: Story = {
  args: {
    status: { ...base, running: true, progress: { phase: "covers", done: 120, total: 255 } },
  },
};

export const SyncingLight: Story = {
  args: Syncing.args,
  globals: { theme: "light" },
};

/**
 * The state that earns the control its place in the header: it stays red until a
 * sync succeeds, and the tooltip carries the real error plus the proxy's hint
 * rather than a generic failure message.
 */
export const Failed: Story = {
  args: {
    status: {
      ...base,
      lastStatus: "error",
      lastError: "Could not reach the Calibre content server at http://localhost:8080",
      lastErrorHint:
        "Start it with `calibre-server` (or calibre Preferences → Sharing over the net), then check the content server URL in Grimoire's settings.",
    },
  },
};

export const FailedLight: Story = {
  args: Failed.args,
  globals: { theme: "light" },
};

/** Fresh install: nothing synced yet, and nothing has gone wrong either. */
export const NeverSynced: Story = {
  args: {
    status: {
      ...base,
      lastCompletedAt: null,
      lastAttemptedAt: null,
      lastStatus: null,
      bookCount: 0,
      inLibraryCount: 0,
    },
  },
};

/** All three side by side, which is how the colour difference is actually judged. */
export const AllStates: Story = {
  render: (args) => (
    <div className="flex items-center gap-4">
      <SyncIndicator {...args} status={base} />
      <SyncIndicator
        {...args}
        status={{ ...base, running: true, progress: { phase: "mirror", done: 40, total: 255 } }}
      />
      <SyncIndicator
        {...args}
        status={{ ...base, lastStatus: "error", lastError: "Could not reach the content server" }}
      />
    </div>
  ),
};
