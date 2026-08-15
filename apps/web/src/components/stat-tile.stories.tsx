import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { StatTile } from "./stat-tile";

const meta = {
  title: "Settings/StatTile",
  component: StatTile,
  args: { label: "In Calibre", value: "1,284" },
} satisfies Meta<typeof StatTile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHint: Story = {
  args: { label: "Tracked", value: "1,301", hint: "17 left Calibre" },
};

/** How settings lays them out: a row of four, two-up on phones. */
export const TileRow: Story = {
  render: () => (
    <div className="grid w-xl max-w-full grid-cols-2 gap-2 sm:grid-cols-4">
      <StatTile label="In Calibre" value="1,284" />
      <StatTile label="Tracked" value="1,301" hint="17 left Calibre" />
      <StatTile label="Last synced" value="4 minutes ago" hint="8/14/2026, 9:55 AM" />
      <StatTile label="Last attempt" value="4 minutes ago" hint="ok" />
    </div>
  ),
};

export const Light: Story = {
  args: { label: "Tracked", value: "1,301", hint: "17 left Calibre" },
  globals: { theme: "light" },
};
