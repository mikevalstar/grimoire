import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { finishedAtOf, type ReadDateChoice, ReadDatePicker } from "./read-date-picker";

const meta = {
  title: "Library/ReadDatePicker",
  component: ReadDatePicker,
  args: { value: { kind: "unknown" }, onChange: () => {} },
} satisfies Meta<typeof ReadDatePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** All four answers, with what each would put on the wire. */
export const Interactive: Story = {
  render: () => {
    const [choice, setChoice] = useState<ReadDateChoice>({ kind: "unknown" });
    return (
      <div className="grid w-96 gap-3">
        <ReadDatePicker value={choice} onChange={setChoice} />
        <p className="text-muted-foreground text-[11px]">
          Sends: <code>{finishedAtOf(choice) ?? "nothing — dates get cleared"}</code>
        </p>
      </div>
    );
  },
};

export const SpecificDate: Story = {
  args: { value: { kind: "date", date: "2024-11-03" } },
};

/** "Sometime in" a month, or a whole year. */
export const YearOrMonth: Story = {
  args: { value: { kind: "period", year: 2023, month: 6 } },
};

/**
 * A recent book: the years stop at 2019, one before publication, for the
 * reader who got an advance copy.
 */
export const BoundedByPublication: Story = {
  args: { value: { kind: "period", year: 2021, month: null }, publishedYear: 2020 },
};

export const Light: Story = {
  ...Interactive,
  globals: { theme: "light" },
};
