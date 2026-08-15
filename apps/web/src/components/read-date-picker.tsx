import { Calendar, CalendarCheck, CalendarRange, CircleHelp } from "lucide-react";
import { useId } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * When the reader finished a book, at whatever precision they know it —
 * Hardcover's own four answers (docs/features/rating-a-book.md).
 */
export type ReadDateChoice =
  | { kind: "unknown" }
  | { kind: "today" }
  | { kind: "date"; date: string }
  | { kind: "period"; year: number; month: number | null };

/**
 * The choice as the API's reduced-precision date — "2023", "2023-06",
 * "2023-06-15" — or undefined for "I don't know", which is also what an
 * unfinished answer (an empty date field) means.
 */
export function finishedAtOf(choice: ReadDateChoice): string | undefined {
  switch (choice.kind) {
    case "unknown":
      return undefined;
    case "today":
      return localToday();
    case "date":
      return choice.date || undefined;
    case "period":
      return choice.month === null
        ? String(choice.year)
        : `${choice.year}-${String(choice.month).padStart(2, "0")}`;
  }
}

/** Today where the reader is, not in UTC — a finish date is a calendar fact. */
function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const OPTIONS = [
  { kind: "unknown", label: "I don't know", icon: CircleHelp },
  { kind: "today", label: "Today", icon: CalendarCheck },
  { kind: "date", label: "A specific date", icon: Calendar },
  { kind: "period", label: "A year or month", icon: CalendarRange },
] as const;

/**
 * "When did you finish it?" — asked wherever rating shelves a book on
 * Hardcover as Read. Optional by construction: it starts on "I don't know",
 * and leaving it there sends nothing.
 */
export function ReadDatePicker({
  value,
  onChange,
  className,
}: {
  value: ReadDateChoice;
  onChange: (choice: ReadDateChoice) => void;
  className?: string;
}) {
  const dateId = useId();
  const thisYear = new Date().getFullYear();

  function pick(kind: (typeof OPTIONS)[number]["kind"]) {
    if (kind === value.kind) return;
    if (kind === "date") onChange({ kind, date: "" });
    else if (kind === "period") onChange({ kind, year: thisYear, month: null });
    else onChange({ kind });
  }

  return (
    <fieldset className={cn("grid gap-2", className)}>
      <legend className="text-muted-foreground text-[11px] tracking-wide uppercase">
        When did you finish it?
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {OPTIONS.map(({ kind, label, icon: Icon }) => {
          const active = kind === value.kind;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => pick(kind)}
              aria-pressed={active}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] transition-colors",
                active
                  ? "border-you/50 bg-you-dim text-foreground"
                  : "border-line text-muted-foreground hover:border-line-strong hover:text-foreground",
              )}
            >
              <Icon size={13} />
              {label}
            </button>
          );
        })}
      </div>

      {value.kind === "date" && (
        <Input
          id={dateId}
          type="date"
          value={value.date}
          max={localToday()}
          aria-label="The date you finished it"
          onChange={(e) => onChange({ kind: "date", date: e.target.value })}
          className="w-fit"
        />
      )}

      {value.kind === "period" && (
        <div className="flex gap-2">
          {/* Month first, reading like the answer: "sometime in June, 2023". */}
          <Select
            value={value.month === null ? "sometime" : String(value.month)}
            onValueChange={(picked) =>
              onChange({
                kind: "period",
                year: value.year,
                month: picked === "sometime" ? null : Number(picked),
              })
            }
          >
            <SelectTrigger aria-label="Which month" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="sometime">Sometime that year</SelectItem>
              {MONTH_NAMES.map((name, index) => (
                <SelectItem key={name} value={String(index + 1)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(value.year)}
            onValueChange={(year) =>
              onChange({ kind: "period", year: Number(year), month: value.month })
            }
          >
            <SelectTrigger aria-label="Which year" className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {Array.from({ length: 80 }, (_, i) => thisYear - i).map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </fieldset>
  );
}
