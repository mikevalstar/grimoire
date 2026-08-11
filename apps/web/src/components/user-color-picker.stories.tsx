import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { UserColorPicker } from "./user-color-picker";

const meta = {
  title: "Users/UserColorPicker",
  component: UserColorPicker,
  args: { value: "indigo", onChange: () => {} },
} satisfies Meta<typeof UserColorPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Light: Story = {
  globals: { theme: "light" },
};

/** Click or arrow-key through the 24 colours. */
export const Interactive: Story = {
  render: function Interactive(args) {
    const [value, setValue] = useState(args.value);
    return <UserColorPicker {...args} value={value} onChange={setValue} />;
  },
};
