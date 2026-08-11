import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { Input } from "./input";
import { Label } from "./label";

const meta = {
  title: "UI/Input",
  component: Input,
  parameters: { layout: "centered" },
  args: { placeholder: "http://localhost:8080" },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = {
  args: { disabled: true, value: "http://localhost:8080" },
};

export const Invalid: Story = {
  args: { "aria-invalid": true, value: "not a url" },
};

/** How inputs appear in forms: paired with a Label via htmlFor/id. */
export const WithLabel: Story = {
  render: (args) => (
    <div className="grid gap-2">
      <Label htmlFor="content-server-url">Content server URL</Label>
      <Input id="content-server-url" {...args} />
    </div>
  ),
};
