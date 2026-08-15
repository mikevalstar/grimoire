import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { StarRating } from "./star-rating";

const meta = {
  title: "Library/StarRating",
  component: StarRating,
  args: { value: 4 },
} satisfies Meta<typeof StarRating>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Light: Story = { globals: { theme: "light" } };

/** Every rating a Calibre book can carry. Zero renders nothing at all. */
export const Scale: Story = {
  render: (args) => (
    <div className="space-y-1.5">
      {[0, 1, 2, 3, 4, 5].map((value) => (
        <div key={value} className="flex items-center gap-3">
          <span className="text-muted-foreground w-4 text-[11px] tabular-nums">{value}</span>
          <StarRating {...args} value={value} />
        </div>
      ))}
    </div>
  ),
};

/**
 * The halves between them (ADR 0014) — a half is the outline with its left
 * side filled, so it reads as half of something rather than a floating sliver.
 */
export const Halves: Story = {
  render: (args) => (
    <div className="space-y-1.5">
      {[0.5, 1.5, 2.5, 3.5, 4.5].map((value) => (
        <div key={value} className="flex items-center gap-3">
          <span className="text-muted-foreground w-6 text-[11px] tabular-nums">{value}</span>
          <StarRating {...args} value={value} size={16} />
        </div>
      ))}
    </div>
  ),
};

/**
 * With `onRate` the stars are a control — but only once you enter them. At
 * rest it reads as the plain read-out; hovering fades in the empty stars and
 * the clear button. Hover to preview, click to commit, × (or clicking your own
 * rating again) to clear. Tab in and use the arrow keys — the preview follows
 * focus exactly as it follows the pointer.
 */
export const Interactive: Story = {
  render: (args) => {
    const [rating, setRating] = useState(args.value);
    return (
      <div className="space-y-3">
        <StarRating {...args} value={rating} onRate={setRating} label="Dune" size={16} />
        <p className="text-muted-foreground text-[11px]">
          {rating === 0 ? "Unrated" : `${rating} of 5`}
        </p>
      </div>
    );
  },
};

/**
 * Unrated shows nothing at all until you point at it — but the control still
 * occupies its full width, so the stars it reveals don't shove anything aside.
 */
export const InteractiveUnrated: Story = {
  ...Interactive,
  args: { value: 0 },
};

/**
 * `revealed` skips the reveal: the empty stars and the clear button are there
 * from the start. For the details panel, which is already about one book
 * (docs/features/book-details-panel.md).
 */
export const Revealed: Story = {
  ...Interactive,
  args: { value: 0, revealed: true },
};

export const InteractiveLight: Story = {
  ...Interactive,
  globals: { theme: "light" },
};

/** At shelf size, alongside the rated/unrated contrast the grid actually shows. */
export const OnTheShelf: Story = {
  render: (args) => (
    <div className="space-y-4">
      {[4, 0, 2].map((value, i) => (
        <ShelfRow key={value} {...args} value={value} label={`Book ${i + 1}`} />
      ))}
    </div>
  ),
};

function ShelfRow({ value, label, ...args }: { value: number; label: string }) {
  const [rating, setRating] = useState(value);
  return (
    <div className="flex items-center gap-3">
      <span className="text-foreground w-20 text-[13px]">{label}</span>
      <StarRating {...args} value={rating} onRate={setRating} label={label} />
    </div>
  );
}
