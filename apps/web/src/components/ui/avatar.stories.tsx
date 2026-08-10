import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";

const meta = {
  title: "UI/Avatar",
  component: Avatar,
  args: { className: "ring-line-strong ring-1" },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The header chip: initials on the indigo "you" gradient. */
export const Initials: Story = {
  args: {
    children: (
      <AvatarFallback className="from-you bg-gradient-to-br to-[#2c3352] text-[11px] font-bold text-white">
        MV
      </AvatarFallback>
    ),
  },
};

export const WithImage: Story = {
  args: {
    children: (
      <>
        <AvatarImage src="https://github.com/shadcn.png" alt="" />
        <AvatarFallback>MV</AvatarFallback>
      </>
    ),
  },
};
