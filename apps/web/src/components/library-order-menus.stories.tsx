import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { type LibraryOrder, useLibraryOrder } from "@/lib/library-order";
import { GroupMenu, SortMenu } from "./library-order-menus";

/** Both menus over local state, so a story is interactive out of the box. */
function Menus({ readStatusAvailable = true }: { readStatusAvailable?: boolean }) {
  const [order, setOrder] = useState<LibraryOrder>({ sort: "title", dir: "asc", group: "none" });
  return (
    <div className="flex items-center gap-2">
      <SortMenu order={order} onOrder={setOrder} />
      <GroupMenu order={order} onOrder={setOrder} readStatusAvailable={readStatusAvailable} />
    </div>
  );
}

/**
 * The filter bar's first two controls, side by side as the toolbar holds them
 * (docs/features/library-sort-and-group.md). Choosing the active sort key
 * again flips its direction.
 */
const meta = {
  title: "Library/LibraryOrderMenus",
  component: Menus,
} satisfies Meta<typeof Menus>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Light: Story = { globals: { theme: "light" } };

/** No reader chosen: the read-status option says why it can't. */
export const NoReader: Story = { args: { readStatusAvailable: false } };

/** Wired to the real per-device store, as BookLibrary uses it. */
export const Persisted: Story = {
  render: function Persisted() {
    const [order, setOrder] = useLibraryOrder();
    return (
      <div className="flex items-center gap-2">
        <SortMenu order={order} onOrder={setOrder} />
        <GroupMenu order={order} onOrder={setOrder} />
      </div>
    );
  },
};
