import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { UploadDropOverlay } from "./upload-drop-zone";

const meta = {
  title: "Library/UploadDropOverlay",
  component: UploadDropOverlay,
  parameters: { layout: "fullscreen" },
  args: { active: true },
} satisfies Meta<typeof UploadDropOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The window while a file is held over it (docs/features/uploading-a-book.md).
 * The real thing is driven by drag events; this is the overlay on its own.
 */
export const Default: Story = {};

export const Light: Story = { globals: { theme: "light" } };
