import { AlertTriangle, ChevronLeft, Library, Loader2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { HardcoverIcon } from "@/components/brand-icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SeriesApply, SeriesOption, SeriesRoster, SeriesRosterEntry } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface SetSeriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The book the panel was showing — its title heads the dialog. */
  bookTitle: string;
  /** The work the dialog was opened from, so it is always in the apply. */
  workId: number;
  /** The series Hardcover has for it, and what Grimoire knows about each. */
  options: SeriesOption[];
  /** Still asking Hardcover which series the book is in. */
  loadingOptions?: boolean;
  /** Why there is nothing to choose, when that is the answer. */
  optionsError?: string | null;
  /** Fetch one series' roster, matched against the shelf. Injected for stories. */
  loadRoster: (hardcoverId: number) => Promise<SeriesRoster>;
  /** Write the attachments. Resolves when the server has them. */
  onApply: (apply: SeriesApply) => Promise<void>;
}

/**
 * Setting a series from Hardcover
 * (docs/features/setting-a-series-from-hardcover.md).
 *
 * Two steps and a confirm. The first asks which series the book is in —
 * Hardcover allows several, and flattening them is what this feature exists to
 * stop. The second is the point of it: every other book in that series already
 * on the shelf, matched server-side, offered in one stroke.
 */
export function SetSeriesDialog(props: SetSeriesDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {/* Radix only mounts this while open, so each visit starts at step one
          rather than wherever the last one was abandoned. */}
      <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-xl">
        {props.open && <SetSeriesBody {...props} />}
      </DialogContent>
    </Dialog>
  );
}

type Step = "choose" | "roster" | "confirm";

function SetSeriesBody({
  bookTitle,
  workId,
  options,
  loadingOptions,
  optionsError,
  loadRoster,
  onApply,
  onOpenChange,
}: SetSeriesDialogProps) {
  const [step, setStep] = useState<Step>("choose");
  // Which series the book is in — several is the case this exists for — and
  // which of them heads the shelf's line. `chosen` is the primary; the rest are
  // attached to this book alone, since only one series can be spread across the
  // shelf in a single stroke.
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [chosen, setChosen] = useState<SeriesOption | null>(null);
  const [typed, setTyped] = useState("");
  const [typedPosition, setTypedPosition] = useState("");
  const [roster, setRoster] = useState<SeriesRoster | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameId = useId();
  const positionId = useId();

  // Their featured series, or the biggest — the same order the primary rule
  // uses, so the row that arrives selected is the one that would win anyway.
  useEffect(() => {
    if (chosen || options.length === 0) return;
    const first = options[0];
    if (!first) return;
    setChosen(first);
    // Series the book is already in stay checked — re-running the action is how
    // a series that gained a book catches up, not a way to lose the others.
    setSelected(
      new Set([first.hardcoverId, ...options.filter((o) => o.attached).map((o) => o.hardcoverId)]),
    );
  }, [options, chosen]);

  /** Check or uncheck a series. Unchecking the primary hands the crown on. */
  function toggle(option: SeriesOption, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(option.hardcoverId);
    else next.delete(option.hardcoverId);
    setSelected(next);
    if (on && !chosen) setChosen(option);
    if (!on && chosen?.hardcoverId === option.hardcoverId) {
      setChosen(options.find((other) => next.has(other.hardcoverId)) ?? null);
    }
  }

  /** The checked series that are not the primary — attached to this book only. */
  const extras = options.filter(
    (option) => selected.has(option.hardcoverId) && option.hardcoverId !== chosen?.hardcoverId,
  );

  async function openRoster(option: SeriesOption) {
    setChosen(option);
    setBusy(true);
    setError(null);
    try {
      const loaded = await loadRoster(option.hardcoverId);
      setRoster(loaded);
      // Everything on the shelf starts checked except what already has a
      // different series: overwriting somebody's answer is never the default.
      setPicked(
        new Set(
          loaded.entries
            .filter((entry) => entry.workId !== null && !entry.currentSeries)
            .map((entry) => entry.workId as number),
        ),
      );
      setStep("roster");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  // Whether the roster offered the open book at all — which decides both the
  // count on the button and whether the apply adds it.
  const inRoster = roster?.entries.some((entry) => entry.workId === workId) ?? false;

  async function apply() {
    setBusy(true);
    setError(null);
    try {
      const entries = roster
        ? roster.entries
            .filter((entry) => entry.workId !== null && picked.has(entry.workId))
            .map((entry) => ({ workId: entry.workId as number, position: entry.position }))
        : [];
      // The open book joins the apply when the roster never *offered* it — a
      // series whose roster missed it, or a series typed by hand. Where the
      // roster did offer it and the reader unchecked it, that is an answer:
      // re-adding it here would override the one row they were looking at.
      if (!inRoster) {
        entries.push({ workId, position: chosen?.position ?? parsePosition(typedPosition) });
      }

      await onApply({
        hardcoverId: chosen?.hardcoverId ?? null,
        name: chosen?.name ?? typed.trim(),
        slug: chosen?.slug ?? null,
        booksCount: chosen?.booksCount ?? null,
        primary: true,
        entries,
      });

      // The other series the reader checked, on this book alone and never
      // primary. Sequential rather than at once: they are small writes against
      // one SQLite file, and an error here should name the series it happened
      // on rather than one of four.
      for (const extra of extras) {
        await onApply({
          hardcoverId: extra.hardcoverId,
          name: extra.name,
          slug: extra.slug,
          booksCount: extra.booksCount,
          primary: false,
          entries: [{ workId, position: extra.position }],
        });
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep("roster");
    } finally {
      setBusy(false);
    }
  }

  const groups = roster ? groupRoster(roster.entries) : null;
  const replacing = groups?.conflicted.filter((entry) => picked.has(entry.workId as number)) ?? [];
  const count = picked.size + (inRoster ? 0 : 1);

  if (step === "confirm") {
    return (
      <>
        <DialogHeader>
          <DialogTitle>
            Set {chosen?.name ?? typed} on {count} book{count === 1 ? "" : "s"}?
          </DialogTitle>
          <DialogDescription>
            Each one gets {chosen?.name ?? typed} as its series. Grimoire stores this itself —
            nothing is written back to Calibre.
          </DialogDescription>
        </DialogHeader>

        {extras.length > 0 && (
          <p className="text-muted-foreground text-[13px] leading-relaxed">
            {bookTitle} also joins {listNames(extras.map((extra) => extra.name))} — this book only,
            since the rest of the shelf was matched against {chosen?.name}.
          </p>
        )}

        {replacing.length > 0 && (
          <p className="text-[13px] leading-relaxed">
            <AlertTriangle size={13} className="mr-1 inline align-[-2px] text-warning" />
            {replacing.length} book{replacing.length === 1 ? "" : "s"} already{" "}
            {replacing.length === 1 ? "has" : "have"} a different series;{" "}
            {replacing.length === 1 ? "its" : "their"} series will be replaced.
          </p>
        )}

        {error && <p className="text-[13px] text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={() => setStep("roster")}>
            Back
          </Button>
          <Button disabled={busy} onClick={() => void apply()}>
            {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            Set series
          </Button>
        </DialogFooter>
      </>
    );
  }

  if (step === "roster" && groups) {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <HardcoverIcon size={14} aria-hidden="true" />
            {chosen?.name}
          </DialogTitle>
          <DialogDescription>
            {groups.matched.length + groups.conflicted.length} of {roster?.entries.length} books in
            this series are on your shelf. Uncheck anything that looks wrong.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          <RosterGroup
            title="On your shelf"
            entries={groups.matched}
            picked={picked}
            onToggle={setPicked}
          />
          <RosterGroup
            title="Already in a series"
            entries={groups.conflicted}
            picked={picked}
            onToggle={setPicked}
          />

          {groups.unmatched.length > 0 && (
            <details className="mt-4">
              <summary className="text-muted-foreground cursor-pointer text-[12px]">
                Not on your shelf — {groups.unmatched.length}
              </summary>
              <ul className="text-muted-foreground mt-2 grid gap-1 text-[12px]">
                {groups.unmatched.map((entry) => (
                  <li key={entry.hardcoverBookId} className="truncate">
                    {entry.position !== null && (
                      <span className="opacity-70">#{entry.position} </span>
                    )}
                    {entry.title}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        {error && <p className="text-[13px] text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={() => setStep("choose")}>
            <ChevronLeft size={14} aria-hidden="true" />
            Back
          </Button>
          <Button disabled={busy || count === 0} onClick={() => setStep("confirm")}>
            Set series on {count} book{count === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Set series</DialogTitle>
        <DialogDescription>
          Which series is <span className="text-foreground">{bookTitle}</span> in? Hardcover files
          some books under more than one.
        </DialogDescription>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto">
        {loadingOptions ? (
          <p className="text-muted-foreground py-6 text-center text-[13px]">
            <Loader2 size={14} className="mr-1.5 inline animate-spin" aria-hidden="true" />
            Asking Hardcover…
          </p>
        ) : options.length > 0 ? (
          <ul className="grid gap-1">
            {options.map((option) => {
              const on = selected.has(option.hardcoverId);
              const isPrimary = chosen?.hardcoverId === option.hardcoverId;
              const rowId = `${nameId}-${option.hardcoverId}`;
              return (
                <li key={option.hardcoverId} className="flex items-center gap-2">
                  <Label
                    htmlFor={rowId}
                    className={cn(
                      "hover:bg-fill flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 font-normal transition-colors",
                      isPrimary && "bg-fill",
                    )}
                  >
                    <Checkbox
                      id={rowId}
                      checked={on}
                      onCheckedChange={(checked) => toggle(option, checked === true)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[13px] font-medium">
                        {option.name}
                        {option.attached && (
                          <span className="text-muted-foreground text-[11px] font-normal">
                            already set
                          </span>
                        )}
                      </span>
                      <span className="text-muted-foreground block text-[11px]">
                        {option.position !== null && `this book is #${option.position} · `}
                        {option.booksCount ?? "?"} books
                        {option.onShelf > 0 && ` · ${option.onShelf} on your shelf`}
                      </span>
                    </span>
                    {option.featured && (
                      <span className="text-muted-foreground shrink-0 text-[10px] uppercase tracking-wide">
                        main
                      </span>
                    )}
                  </Label>
                  {/* Which one heads the shelf's line. Only a checked series can
                      be it, and the crown moves rather than multiplying. */}
                  <button
                    type="button"
                    disabled={!on}
                    onClick={() => setChosen(option)}
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide transition-colors",
                      isPrimary
                        ? "border-you-soft/40 text-you-soft"
                        : "border-line text-muted-foreground hover:text-foreground disabled:opacity-40",
                    )}
                  >
                    {isPrimary ? "primary" : "make primary"}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          // Hardcover having nothing is an ordinary outcome, not an error — and
          // typing a name is also how a series they don't have gets set at all.
          <div className="grid gap-3">
            <p className="text-muted-foreground text-[13px]">
              {optionsError ?? "Hardcover has no series for this book. Set one by hand:"}
            </p>
            <div className="grid gap-2">
              <Label htmlFor={nameId} className="text-[12px]">
                Series
              </Label>
              <Input
                id={nameId}
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                placeholder="Discworld"
              />
              <Label htmlFor={positionId} className="text-[12px]">
                This book is #
              </Label>
              <Input
                id={positionId}
                value={typedPosition}
                onChange={(event) => setTypedPosition(event.target.value)}
                inputMode="decimal"
                placeholder="6"
              />
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-[13px] text-destructive">{error}</p>}

      <DialogFooter>
        <Button variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        {options.length > 0 ? (
          <Button
            disabled={busy || !chosen || selected.size === 0}
            onClick={() => chosen && void openRoster(chosen)}
          >
            {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            <Library size={14} aria-hidden="true" />
            Find the rest
          </Button>
        ) : (
          <Button disabled={busy || !typed.trim()} onClick={() => setStep("confirm")}>
            Set series
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

function RosterGroup({
  title,
  entries,
  picked,
  onToggle,
}: {
  title: string;
  entries: SeriesRosterEntry[];
  picked: Set<number>;
  onToggle: (next: Set<number>) => void;
}) {
  const group = useId();
  if (entries.length === 0) return null;

  return (
    <section className="mt-4 first:mt-0">
      <h4 className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
        {title} — {entries.length}
      </h4>
      <ul className="mt-1.5 grid gap-0.5">
        {entries.map((entry) => {
          const workId = entry.workId as number;
          const on = picked.has(workId);
          // The whole row is the label, so the title and what it would replace
          // are both part of what the checkbox is called.
          const rowId = `${group}-${entry.hardcoverBookId}`;
          return (
            <li key={entry.hardcoverBookId}>
              <Label
                htmlFor={rowId}
                className="hover:bg-fill flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 font-normal"
              >
                <Checkbox
                  id={rowId}
                  checked={on}
                  onCheckedChange={(checked) => {
                    const next = new Set(picked);
                    if (checked) next.add(workId);
                    else next.delete(workId);
                    onToggle(next);
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px]">
                    {entry.position !== null && (
                      <span className="text-muted-foreground">#{entry.position} </span>
                    )}
                    {entry.title}
                  </span>
                  <span className="text-muted-foreground block truncate text-[11px]">
                    {entry.currentSeries ? (
                      <>
                        <span className="line-through">
                          {entry.currentSeries}
                          {entry.currentPosition !== null && ` #${entry.currentPosition}`}
                        </span>{" "}
                        will be replaced
                      </>
                    ) : (
                      `→ ${entry.workTitle}`
                    )}
                  </span>
                </span>
                {/* A match made on the title alone is the one worth a glance:
                    two books can share a name and not be the same book. */}
                {entry.match === "title-only" && (
                  <AlertTriangle
                    size={13}
                    className="shrink-0 text-warning"
                    aria-label="Matched on title alone"
                  />
                )}
              </Label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** "Witches", "Witches and Death", "Witches, Death and Rincewind". */
function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** The three groups the roster is read in, and the order they are read in. */
function groupRoster(entries: SeriesRosterEntry[]) {
  return {
    matched: entries.filter((entry) => entry.workId !== null && !entry.currentSeries),
    conflicted: entries.filter((entry) => entry.workId !== null && entry.currentSeries),
    unmatched: entries.filter((entry) => entry.workId === null),
  };
}

/** A typed position, or null — an unparseable one is "nobody said", not zero. */
function parsePosition(value: string): number | null {
  const position = Number(value.trim());
  return value.trim() && Number.isFinite(position) ? position : null;
}
