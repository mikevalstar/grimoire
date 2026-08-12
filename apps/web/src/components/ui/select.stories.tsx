import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { Label } from "./label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

/**
 * Radix select, styled to match the app's `Input` so the two sit together in a
 * form. Values are strings — anything numeric converts at the boundary, the way
 * the sync interval in settings does.
 */
const meta = {
  title: "UI/Select",
  component: Select,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

const INTERVALS = [
  { value: "0", label: "Never — only when I ask" },
  { value: "1", label: "Every minute" },
  { value: "5", label: "Every 5 minutes" },
  { value: "15", label: "Every 15 minutes" },
  { value: "60", label: "Every hour" },
];

function IntervalSelect(props: { disabled?: boolean; className?: string }) {
  const [value, setValue] = useState("5");
  return (
    <div className="grid w-72 gap-2">
      <Label htmlFor="story-interval">Sync automatically</Label>
      <Select value={value} onValueChange={setValue} disabled={props.disabled}>
        <SelectTrigger id="story-interval" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {INTERVALS.map((choice) => (
            <SelectItem key={choice.value} value={choice.value}>
              {choice.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export const Default: Story = { render: () => <IntervalSelect /> };

export const DefaultLight: Story = {
  render: () => <IntervalSelect />,
  globals: { theme: "light" },
};

/** While the change is saving, the field goes quiet rather than taking a second pick. */
export const Disabled: Story = { render: () => <IntervalSelect disabled /> };

/** Nothing chosen yet: the placeholder carries muted-foreground. */
export const Placeholder: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-72">
        <SelectValue placeholder="Pick an interval" />
      </SelectTrigger>
      <SelectContent>
        {INTERVALS.map((choice) => (
          <SelectItem key={choice.value} value={choice.value}>
            {choice.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ),
};
