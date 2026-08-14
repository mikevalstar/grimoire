import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { BookMarks } from "./book-marks";

const meta = {
  title: "Library/BookMarks",
  component: BookMarks,
  parameters: { layout: "centered" },
  args: { book: { sources: ["calibre"], calibreId: 41 } },
} satisfies Meta<typeof BookMarks>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Calibre: Story = {};

export const Hardcover: Story = {
  args: { book: { sources: ["hardcover"], calibreId: null } },
};

/**
 * What a matched book looks like: one book that came from two libraries. Nothing
 * produces this yet — the marks are plural first, so de-duping is a change to
 * what the API says and not to this component (docs/features/hardcover-sync.md).
 */
export const BothSources: Story = {
  args: { book: { sources: ["calibre", "hardcover"], calibreId: 41 } },
};

/** Calibre dropped it; Grimoire kept it. The Calibre mark carries the news. */
export const LeftCalibre: Story = {
  args: { book: { sources: ["calibre"], calibreId: null } },
};

/** An unknown source is skipped rather than guessed at. */
export const UnknownSource: Story = {
  args: { book: { sources: ["storygraph"], calibreId: null } },
};

/**
 * Over a cover, where there is no room to name them: icons only, on dark glass
 * that works against artwork in either theme. The names stay in the tooltip and
 * for screen readers.
 */
export const Overlay: Story = {
  args: { book: { sources: ["calibre", "hardcover"], calibreId: 41 }, variant: "overlay" },
  render: (args) => (
    <div className="from-fill-strong to-you-dim relative h-[270px] w-[180px] overflow-hidden rounded-md bg-gradient-to-br">
      <BookMarks {...args} className="absolute bottom-1.5 left-1.5" />
    </div>
  ),
};

export const OverlayLight: Story = {
  ...Overlay,
  globals: { theme: "light" },
};
