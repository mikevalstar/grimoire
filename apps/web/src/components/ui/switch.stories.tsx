import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { Label } from "./label";
import { Switch } from "./switch";

const meta = {
  title: "UI/Switch",
  component: Switch,
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Checked: Story = {
  args: { defaultChecked: true },
};

export const Disabled: Story = {
  args: { disabled: true, defaultChecked: true },
};

/** How settings uses it: a labelled row with the control on the right. */
export const LabelledRow: Story = {
  render: () => (
    <div className="flex w-72 items-start justify-between gap-4">
      <div className="grid gap-0.5">
        <Label htmlFor="switch-story" className="text-[13px]">
          Stars from Hardcover
        </Label>
        <p className="text-muted-foreground text-[11px]">
          Show Hardcover ratings instead of stars kept in Grimoire.
        </p>
      </div>
      <Switch id="switch-story" defaultChecked />
    </div>
  ),
};

export const Light: Story = {
  args: { defaultChecked: true },
  globals: { theme: "light" },
};
