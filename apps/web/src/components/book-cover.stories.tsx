import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { SAMPLE_BOOKS } from "@/lib/sample-books";
import { BookCover } from "./book-cover";

/** A stand-in jacket, since Storybook has no Calibre behind it to fetch from. */
const drawnCover = (title: string, from: string, to: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
      </linearGradient></defs>
      <rect width="200" height="300" fill="url(#g)"/>
      <text x="16" y="266" font-family="system-ui" font-size="17" font-weight="600" fill="#fff">${title}</text>
    </svg>`,
  )}`;

const meta = {
  title: "Library/BookCover",
  component: BookCover,
  args: { book: SAMPLE_BOOKS[0], width: 180 },
  decorators: [
    (Story) => (
      <div className="w-[180px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BookCover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { src: drawnCover("Abaddon's Gate", "#312e81", "#0f172a") },
};

export const Light: Story = {
  args: { src: drawnCover("Abaddon's Gate", "#312e81", "#0f172a") },
  globals: { theme: "light" },
};

/** No cover in Calibre, or an image that fails to load: the title carries it. */
export const Fallback: Story = {
  args: { src: "/nothing-here.jpg" },
};

export const FallbackLight: Story = {
  args: { src: "/nothing-here.jpg" },
  globals: { theme: "light" },
};

/** The size the table draws them at. */
export const Thumbnail: Story = {
  args: { book: SAMPLE_BOOKS[4], width: 28, src: "/nothing-here.jpg" },
  decorators: [
    (Story) => (
      <div className="w-7">
        <Story />
      </div>
    ),
  ],
};
