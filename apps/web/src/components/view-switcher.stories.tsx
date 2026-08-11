import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import type { ViewMode } from "@/lib/view-mode";
import { ViewSwitcher } from "./view-switcher";

const meta = {
  title: "Library/ViewSwitcher",
  component: ViewSwitcher,
  args: { view: "covers", onViewChange: () => {} },
} satisfies Meta<typeof ViewSwitcher>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ListSelected: Story = { args: { view: "list" } };

export const Light: Story = { globals: { theme: "light" } };

/** Click or arrow-key between the two views. */
export const Interactive: Story = {
  render: function Interactive(args) {
    const [view, setView] = useState<ViewMode>(args.view);
    return <ViewSwitcher {...args} view={view} onViewChange={setView} />;
  },
};
