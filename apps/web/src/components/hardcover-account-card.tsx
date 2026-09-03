import { CheckCircle2, Link2, Loader2, XCircle } from "lucide-react";
import { useId, useState } from "react";
import { StatTile } from "@/components/stat-tile";
import { relativeTime } from "@/components/sync-indicator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { UserAvatar } from "@/components/user-avatar";
import {
  type HardcoverTest,
  linkHardcover,
  syncHardcover,
  testHardcover,
  type User,
  unlinkHardcover,
  updateUserSettings,
} from "@/lib/api";

/** Where a Hardcover token comes from. */
const TOKEN_PAGE = "https://hardcover.app/account/api";

/**
 * One reader's Hardcover account, as a card in settings' Hardcover section —
 * the token is a person, not an instance-wide setting (ADR 0012). Linked, the
 * card shows what came across and which source wins for stars and read state;
 * unlinked, it is the token form.
 *
 * The token only ever travels upwards: Grimoire's API never sends one back, so
 * a linked reader is one this component knows a *username* for.
 * See docs/features/settings.md and docs/features/hardcover-connection.md.
 */
export function HardcoverAccountCard({
  user,
  onChange,
}: {
  user: User;
  onChange: (user: User) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [token, setToken] = useState("");
  const [test, setTest] = useState<HardcoverTest | null>(null);
  const [busy, setBusy] = useState(false);

  const inputId = useId();

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

  return (
    <section className="border-line rounded-xl border">
      <header className="flex flex-wrap items-center gap-2.5 px-4 py-3">
        <UserAvatar name={user.name} color={user.color} size="sm" />
        {/* Wide enough that on a phone the action buttons wrap under the name
            instead of crushing it to an ellipsis. */}
        <div className="min-w-40 flex-1">
          <p className="truncate text-[13px] font-medium">{user.name}</p>
          <p className="text-muted-foreground truncate text-[11px]">
            {user.hardcoverUsername ? (
              <>
                Linked as <span className="text-hc-soft">{user.hardcoverUsername}</span>
              </>
            ) : (
              "Not linked"
            )}
          </p>
        </div>
        {busy && <Loader2 size={13} className="text-muted-foreground animate-spin" />}
        {user.hardcoverUsername ? (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={sync} disabled={busy}>
              {busy ? "Syncing…" : "Sync now"}
            </Button>
            <Button variant="ghost" size="sm" onClick={probe} disabled={busy}>
              Test
            </Button>
            <Button variant="ghost" size="sm" onClick={unlink} disabled={busy}>
              Unlink
            </Button>
          </div>
        ) : (
          !editing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setTest(null);
                setEditing(true);
              }}
              disabled={busy}
            >
              <Link2 />
              Link account
            </Button>
          )
        )}
      </header>

      {user.hardcoverUsername && (
        <div className="grid gap-3 px-4 pb-4">
          <ShelfStats user={user} />
          {user.hardcoverSyncError && (
            <p className="text-destructive text-[12px]">{user.hardcoverSyncError}</p>
          )}
          {test && <TestResult test={test} />}
          <SourceToggles user={user} onChange={onChange} />
        </div>
      )}

      {!user.hardcoverUsername && editing && (
        <form
          className="grid gap-2 px-4 pb-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Label htmlFor={inputId} className="text-[12px]">
            {user.name}'s Hardcover API token
          </Label>
          <div className="flex gap-2">
            <Input
              id={inputId}
              // A secret, and one nothing reads back out — the API never
              // returns a stored token, so there is nothing here to reveal.
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
      )}
    </section>
  );
}

/** Books on a reader's shelves with the given Hardcover status id. */
function statusCount(user: User, statusId: number): number {
  return user.hardcoverStatusCounts.find((entry) => entry.statusId === statusId)?.count ?? 0;
}

/**
 * What came across, as tiles: shelf size and the reading-status breakdown —
 * the proof that reading *state* came over and not just titles
 * (docs/features/hardcover-sync.md).
 */
function ShelfStats({ user }: { user: User }) {
  if (!user.hardcoverSyncedAt && user.hardcoverBookCount === 0) {
    return <p className="text-muted-foreground text-[12px]">Not synced yet.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <StatTile
        label="On shelves"
        value={user.hardcoverBookCount.toLocaleString()}
        hint={user.hardcoverSyncedAt ? `synced ${relativeTime(user.hardcoverSyncedAt)}` : undefined}
      />
      <StatTile label="Reading" value={statusCount(user, 2).toLocaleString()} />
      <StatTile label="Read" value={statusCount(user, 3).toLocaleString()} />
      <StatTile label="Want to read" value={statusCount(user, 1).toLocaleString()} />
    </div>
  );
}

/**
 * Which truth wins where Grimoire and Hardcover both have an answer: this
 * reader's rating source (ADR 0014) and read-state source
 * (docs/features/marking-a-book-read.md), each applied at once.
 */
function SourceToggles({ user, onChange }: { user: User; onChange: (user: User) => void }) {
  const [savingSource, setSavingSource] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);

  const starsId = useId();
  const readId = useId();

  async function saveSource(settings: Parameters<typeof updateUserSettings>[1]) {
    setSavingSource(true);
    setSourceError(null);
    try {
      onChange(await updateUserSettings(user.id, settings));
    } catch (err) {
      setSourceError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingSource(false);
    }
  }

  return (
    <div className="border-line grid gap-3 border-t pt-3">
      <ToggleRow
        id={starsId}
        title="Stars from Hardcover"
        description={`Show ${user.name}'s Hardcover ratings, and send new ones to their account — instead of stars kept in Grimoire.`}
        checked={user.ratingsSource === "hardcover"}
        disabled={savingSource}
        onCheckedChange={(checked) =>
          void saveSource({ ratingsSource: checked ? "hardcover" : "local" })
        }
      />
      <ToggleRow
        id={readId}
        title="Read state from Hardcover"
        description="The corner check marks books read on their Hardcover shelves — instead of read state kept in Grimoire."
        checked={user.readStateSource === "hardcover"}
        disabled={savingSource}
        onCheckedChange={(checked) =>
          void saveSource({ readStateSource: checked ? "hardcover" : "local" })
        }
      />
      {sourceError && <p className="text-destructive text-[11px]">{sourceError}</p>}
    </div>
  );
}

function ToggleRow({
  id,
  title,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="grid gap-0.5">
        <Label htmlFor={id} className="text-[13px]">
          {title}
        </Label>
        <p className="text-muted-foreground text-[11px]">{description}</p>
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
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
      className={`flex items-start gap-1.5 text-[12px] ${
        test.ok ? "text-success" : "text-destructive"
      }`}
    >
      {test.ok ? (
        <CheckCircle2 className="mt-px size-3.5 shrink-0" />
      ) : (
        <XCircle className="mt-px size-3.5 shrink-0" />
      )}
      {test.ok ? `Connected as ${test.username}` : test.error}
    </p>
  );
}
