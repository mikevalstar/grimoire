import { CheckCircle2, Link2, Loader2, XCircle } from "lucide-react";
import { useState } from "react";
import { relativeTime } from "@/components/sync-indicator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type HardcoverTest,
  hardcoverStatusLabel,
  linkHardcover,
  syncHardcover,
  testHardcover,
  type User,
  unlinkHardcover,
} from "@/lib/api";

/** Where a Hardcover token comes from. */
const TOKEN_PAGE = "https://hardcover.app/account/api";

/**
 * One reader's link to their hardcover.app account, on their row in settings —
 * the token is a person, not an instance-wide setting (ADR 0012).
 *
 * The token only ever travels upwards: Grimoire's API never sends one back, so
 * a linked reader is one this component knows a *username* for.
 * See docs/features/hardcover-connection.md.
 */
export function HardcoverLink({ user, onChange }: { user: User; onChange: (user: User) => void }) {
  const [editing, setEditing] = useState(false);
  const [token, setToken] = useState("");
  const [test, setTest] = useState<HardcoverTest | null>(null);
  const [busy, setBusy] = useState(false);

  const inputId = `hardcover-token-${user.id}`;

  /** Every call here reports failure the same way a rejected token does. */
  async function run(work: () => Promise<void>) {
    setBusy(true);
    try {
      await work();
    } catch (err) {
      setTest({ ok: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  const probe = () =>
    run(async () => {
      setTest(null);
      // An empty field re-probes what's stored, which is how an expired token
      // gets found without pasting it again.
      setTest(await testHardcover(user.id, token.trim() || undefined));
    });

  const save = () =>
    run(async () => {
      setTest(null);
      onChange(await linkHardcover(user.id, token.trim()));
      setToken("");
      setEditing(false);
    });

  const unlink = () =>
    run(async () => {
      setTest(null);
      onChange(await unlinkHardcover(user.id));
    });

  // The request holds until the sweep finishes — it is paced at a page a second
  // and there is no progress to poll (docs/features/hardcover-sync.md).
  const sync = () =>
    run(async () => {
      setTest(null);
      onChange(await syncHardcover(user.id));
    });

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 pb-1.5 text-[11px]">
        {user.hardcoverUsername ? (
          <>
            <span className="text-muted-foreground">
              Hardcover <span className="text-foreground">{user.hardcoverUsername}</span>
            </span>
            <ShelfSummary user={user} />
            <LinkButton onClick={sync} disabled={busy}>
              {busy ? "Syncing…" : "Sync now"}
            </LinkButton>
            <LinkButton onClick={probe} disabled={busy}>
              Test
            </LinkButton>
            <LinkButton onClick={unlink} disabled={busy}>
              Unlink
            </LinkButton>
            {user.hardcoverSyncError && (
              <p className="text-destructive basis-full">{user.hardcoverSyncError}</p>
            )}
          </>
        ) : (
          <LinkButton
            onClick={() => {
              setTest(null);
              setEditing(true);
            }}
            disabled={busy}
          >
            <Link2 size={11} />
            Link Hardcover
          </LinkButton>
        )}
        {busy && <Loader2 size={11} className="text-muted-foreground animate-spin" />}
        {test && <TestResult test={test} />}
      </div>
    );
  }

  return (
    <form
      className="grid gap-2 px-2 pb-2"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Label htmlFor={inputId} className="text-[11px]">
        {user.name}'s Hardcover API token
      </Label>
      <div className="flex gap-2">
        <Input
          id={inputId}
          // A secret, and one nothing reads back out — the API never returns a
          // stored token, so there is nothing here to reveal.
          type="password"
          value={token}
          placeholder="Paste your token"
          autoComplete="off"
          spellCheck={false}
          className="h-8 text-[13px]"
          onChange={(e) => {
            setToken(e.target.value);
            setTest(null);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => void probe()}
          disabled={busy || !token.trim()}
        >
          {busy && <Loader2 className="animate-spin" />}
          Test
        </Button>
      </div>
      <p className="text-muted-foreground text-[11px]">
        From{" "}
        <a
          href={TOKEN_PAGE}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          hardcover.app/account/api
        </a>
        . Grimoire keeps it on the server and never sends it back to this page.
      </p>
      {test && <TestResult test={test} />}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setEditing(false);
            setToken("");
            setTest(null);
          }}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={busy || !token.trim()}>
          {busy && <Loader2 className="animate-spin" />}
          Save
        </Button>
      </div>
    </form>
  );
}

/**
 * What came across, in one line: how many books, what they're reading right
 * now, and when it last arrived. The status breakdown is the proof that reading
 * *state* came over and not just titles (docs/features/hardcover-sync.md).
 */
function ShelfSummary({ user }: { user: User }) {
  if (!user.hardcoverSyncedAt && user.hardcoverBookCount === 0) {
    return <span className="text-muted-foreground">not synced yet</span>;
  }

  // Reading first — it's the one anybody looks for — then the biggest shelves.
  const statuses = [...user.hardcoverStatusCounts]
    .sort((a, b) => (a.statusId === 2 ? -1 : b.statusId === 2 ? 1 : b.count - a.count))
    .slice(0, 3)
    .map((entry) => `${entry.count} ${hardcoverStatusLabel(entry.statusId).toLowerCase()}`);

  return (
    <span className="text-muted-foreground">
      · {user.hardcoverBookCount.toLocaleString()} books
      {statuses.length > 0 && ` (${statuses.join(", ")})`}
      {user.hardcoverSyncedAt && ` · ${relativeTime(user.hardcoverSyncedAt)}`}
    </span>
  );
}

/** A text-weight action — these sit under a reader's name and must not compete with it. */
function LinkButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 underline underline-offset-2 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/**
 * The outcome of a probe. Success names the account rather than saying
 * "connected": which Hardcover user a token belongs to is the thing worth
 * confirming.
 */
function TestResult({ test }: { test: HardcoverTest }) {
  return (
    <p
      className={`flex items-start gap-1.5 text-[11px] ${
        test.ok ? "text-green-600 dark:text-green-500" : "text-destructive"
      }`}
    >
      {test.ok ? (
        <CheckCircle2 className="mt-px size-3 shrink-0" />
      ) : (
        <XCircle className="mt-px size-3 shrink-0" />
      )}
      {test.ok ? `Connected as ${test.username}` : test.error}
    </p>
  );
}
