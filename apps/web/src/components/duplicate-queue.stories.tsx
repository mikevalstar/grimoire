import type { Meta, StoryObj } from "@storybook/tanstack-react";
import type { PendingDuplicate } from "@/lib/api";
import { SAMPLE_BOOKS } from "@/lib/sample-books";
import { DuplicateQueue } from "./duplicate-queue";

/** Two suspected pairs, best reason first — the shape settings renders. */
const PAIRS: PendingDuplicate[] = [
  { workId: 1, otherWorkId: 2, bookId: 11, otherBookId: 22, reason: "exact" },
  { workId: 3, otherWorkId: 4, bookId: 33, otherBookId: 44, reason: "subtitle" },
];

const meta = {
  title: "Settings/DuplicateQueue",
  component: DuplicateQueue,
  decorators: [
    (Story) => (
      <div className="max-w-xl p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    pairs: PAIRS,
    total: PAIRS.length,
    bookFor: (workId) => SAMPLE_BOOKS.find((book) => book.id === workId),
    onSame: () => {},
    onNotSame: () => {},
  },
} satisfies Meta<typeof DuplicateQueue>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Light: Story = {
  globals: { theme: "light" },
};

/** Every question answered — the state a tidy library lives in. */
export const Empty: Story = {
  args: { pairs: [], total: 0 },
};

/** More waiting than a settings pane should show. */
export const Truncated: Story = {
  args: { total: 87 },
};

export const Loading: Story = {
  args: { loading: true },
};
