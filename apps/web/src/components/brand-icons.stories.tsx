import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { BookBadge } from "./book-badge";
import { CalibreIcon, HardcoverIcon } from "./brand-icons";

const meta = {
  title: "Library/BrandIcons",
  component: CalibreIcon,
  args: { size: 16 },
} satisfies Meta<typeof CalibreIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

const SIZES = [12, 14, 16, 18, 24, 32, 64];

export const Calibre: Story = {};

export const Hardcover: Story = {
  render: (args) => <HardcoverIcon {...args} />,
};

/** The sizes the app actually asks for — 12px in a badge up to 18px in a header. */
export const Sizes: Story = {
  render: () => (
    <div className="grid gap-3">
      {SIZES.map((size) => (
        <div key={size} className="flex items-center gap-3">
          <span className="text-muted-foreground w-10 text-[11px] tabular-nums">{size}px</span>
          <CalibreIcon size={size} />
          <HardcoverIcon size={size} />
        </div>
      ))}
    </div>
  ),
};

/** Where they spend most of their life: a source mark on a cover, and beside a title. */
export const InBadges: Story = {
  render: () => (
    <div className="grid gap-4">
      <div className="flex gap-1 rounded bg-[#3a3f4b] p-3">
        <BookBadge variant="overlay" title="This book is in the connected Calibre library.">
          <CalibreIcon size={12} aria-hidden />
          <span className="sr-only">Calibre</span>
        </BookBadge>
        <BookBadge variant="overlay" title="This book is on a reader's hardcover.app shelves.">
          <HardcoverIcon size={12} aria-hidden />
          <span className="sr-only">Hardcover</span>
        </BookBadge>
      </div>
      <div className="flex gap-1">
        <BookBadge title="This book is in the connected Calibre library.">
          <CalibreIcon size={12} aria-hidden />
          <span className="sr-only">Calibre</span>
        </BookBadge>
        <BookBadge title="This book is on a reader's hardcover.app shelves.">
          <HardcoverIcon size={12} aria-hidden />
          <span className="sr-only">Hardcover</span>
        </BookBadge>
      </div>
    </div>
  ),
};

export const Light: Story = {
  ...InBadges,
  globals: { theme: "light" },
};
