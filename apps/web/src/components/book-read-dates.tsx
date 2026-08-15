import { CalendarCheck2 } from "lucide-react";

export interface BookReadDatesProps {
  /** Known finish dates, newest read first, at their original precision. */
  dates?: string[];
  isPending?: boolean;
  error?: Error | null;
}

/** One reader's known completions, including rereads. */
export function BookReadDates({ dates = [], isPending = false, error }: BookReadDatesProps) {
  if (!isPending && !error && dates.length === 0) return null;

  return (
    <section className="mt-5">
      <h3 className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-[0.08em] uppercase">
        Date read
      </h3>
      {isPending ? (
        <p className="text-muted-foreground animate-pulse text-[12px]">Loading reading history…</p>
      ) : error ? (
        <p className="text-muted-foreground text-[12px]">Couldn’t load reading history.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {keyedReadDates(dates).map(({ date, key }) => (
            <li
              key={key}
              className="border-line bg-fill text-foreground/85 flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px]"
            >
              <CalendarCheck2 aria-hidden="true" size={13} className="text-you-soft" />
              {formatReadDate(date)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** A finish date keeps the precision the reader or Hardcover recorded. */
function formatReadDate(value: string): string {
  if (/^\d{4}$/.test(value)) return value;

  const month = /^(\d{4})-(\d{2})$/.exec(value);
  if (month) {
    const date = new Date(`${value}-01T00:00:00Z`);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
    }
  }

  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
}

/** Stable keys without collapsing two reads that happened on the same date. */
function keyedReadDates(dates: string[]): { date: string; key: string }[] {
  const seen = new Map<string, number>();
  return dates.map((date) => {
    const occurrence = (seen.get(date) ?? 0) + 1;
    seen.set(date, occurrence);
    return { date, key: `${date}-${occurrence}` };
  });
}
