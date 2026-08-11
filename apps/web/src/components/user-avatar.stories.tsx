import { USER_COLORS } from "@grimoire/core/types";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { UserAvatar } from "./user-avatar";

const meta = {
  title: "Users/UserAvatar",
  component: UserAvatar,
  args: { name: "Mike Valstar", color: "indigo" },
} satisfies Meta<typeof UserAvatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** One word gets one letter; two or more get first and last. */
export const SingleName: Story = {
  args: { name: "Robin", color: "crimson" },
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      <UserAvatar {...args} size="sm" />
      <UserAvatar {...args} size="default" />
      <UserAvatar {...args} size="lg" />
    </div>
  ),
};

/** The whole palette, as a household would never actually look. */
export const AllColors: Story = {
  render: (args) => (
    <div className="flex max-w-md flex-wrap gap-2">
      {USER_COLORS.map((color) => (
        <UserAvatar key={color.id} {...args} name={color.name} color={color.id} />
      ))}
    </div>
  ),
};
