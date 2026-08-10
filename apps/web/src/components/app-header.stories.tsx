import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { AppHeader } from "./app-header";

const meta = {
  title: "Shell/AppHeader",
  component: AppHeader,
  parameters: { layout: "fullscreen" },
  args: { bookCount: 1284, userInitials: "MV" },
} satisfies Meta<typeof AppHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Light: Story = {
  globals: { theme: "light" },
};

/** Before the library has loaded, the placeholder drops the count. */
export const CountUnknown: Story = {
  args: { bookCount: undefined },
};

/** Below `sm` the wide search trigger collapses to an icon. */
export const Narrow: Story = {
  globals: { viewport: { value: "mobile1" } },
};
