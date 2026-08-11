import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { CalibreTestResult } from "./calibre-test-result";

const meta = {
  title: "Setup/CalibreTestResult",
  component: CalibreTestResult,
  args: { test: { ok: true, bookCount: 1284 } },
} satisfies Meta<typeof CalibreTestResult>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Connected: Story = {};

export const Failed: Story = {
  args: {
    test: { ok: false, error: "Could not reach http://localhost:8080 (Unable to connect)" },
  },
};
