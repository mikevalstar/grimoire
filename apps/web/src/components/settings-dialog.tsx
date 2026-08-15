import { nextUserColor, USER_NAME_MAX_LENGTH, type UserColorId } from "@grimoire/core/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Globe, Loader2, Plus, Server, Users } from "lucide-react";
import { useState } from "react";
import { CalibreTestResult } from "@/components/calibre-test-result";
import { DuplicateQueue } from "@/components/duplicate-queue";
import { HardcoverAccountCard } from "@/components/hardcover-account-card";
import { StatTile } from "@/components/stat-tile";
import { relativeTime, syncTooltip } from "@/components/sync-indicator";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserAvatar } from "@/components/user-avatar";
import { UserColorPicker } from "@/components/user-color-picker";
import {
  type CalibreServerTest,
  createUser,
  type MatchOutcome,
  matchBooks,
  PREF_KEYS,
  SYNC_INTERVAL_CHOICES,
  savePreferences,
  testCalibreServer,
  type User,
} from "@/lib/api";
import { setCurrentUserId, useCurrentUser } from "@/lib/current-user";
import {
  booksQuery,
  pendingDuplicatesQuery,
  preferencesQuery,
  useDismissDuplicate,
  useLinkDuplicate,
  usersQuery,
  useSaveSyncInterval,
  useStartSync,
  useSyncStatus,
} from "@/lib/queries";
import { cn } from "@/lib/utils";

/**
 * The dialog's sections, in sidebar order. Ids are the public names callers
 * open the dialog on — the avatar menu's "Add reader" lands on `readers`, and
 * the command palette lists one command per section.
 */
export const SECTIONS = [
  { id: "calibre", label: "Calibre", icon: Server },
  { id: "hardcover", label: "Hardcover", icon: Globe },
  { id: "readers", label: "Readers", icon: Users },
  { id: "duplicates", label: "Duplicates", icon: Copy },
] as const;

export type SettingsSection = (typeof SECTIONS)[number]["id"];

/**
 * Everything configurable after first run, as one fixed-size dialog with a
 * section sidebar — see docs/features/settings.md. Unlike the setup wizard this
 * is an ordinary dialog: Escape and an outside click both close it.
 */
export function SettingsDialog({
  open,
  onOpenChange,
  section = "calibre",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which section to open on. The dialog navigates freely after that. */
  section?: SettingsSection;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Radix only mounts this while open, so every pane starts from the
          stored values each time rather than from whatever was typed last. */}
      <DialogContent className="flex h-[min(640px,85dvh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogDescription className="sr-only">
          Grimoire's settings — Calibre, Hardcover, readers and duplicates.
        </DialogDescription>
        <SettingsBody initialSection={section} />
      </DialogContent>
    </Dialog>
  );
}

function SettingsBody({ initialSection }: { initialSection: SettingsSection }) {
  const [section, setSection] = useState<SettingsSection>(initialSection);

  return (
    <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
      {/* The sidebar is a top strip below `sm` — same items, scrolling
          sideways. The border lives on the wrapper so the nav can stop short
          of the dialog's close button, which floats over the strip. */}
      <div className="border-line shrink-0 border-b sm:w-44 sm:border-r sm:border-b-0">
        <nav
          aria-label="Settings sections"
          className="flex items-center gap-1 overflow-x-auto p-2 max-sm:mr-12 sm:flex-col sm:items-stretch sm:p-3"
        >
          <DialogTitle className="px-2.5 text-[15px] max-sm:mr-2 sm:pt-1 sm:pb-3">
            Settings
          </DialogTitle>
          {SECTIONS.map(({ id, label, icon: Icon }) => {
            const active = id === section;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSection(id)}
                aria-current={active || undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] whitespace-nowrap transition-colors",
                  active
                    ? "bg-fill text-foreground"
                    : "text-muted-foreground hover:bg-fill hover:text-foreground",
                )}
              >
                <Icon size={14} className={active ? "text-you-soft" : undefined} />
                {label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {section === "calibre" && <CalibrePane />}
        {section === "hardcover" && <HardcoverPane />}
        {section === "readers" && <ReadersPane />}
        {section === "duplicates" && <DuplicatesPane />}
      </div>
    </div>
  );
}

/** Every pane opens the same way: what this section is, in a line. */
function PaneHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="grid gap-1">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-muted-foreground text-[12px]">{description}</p>
    </header>
  );
}

// --- Calibre ---------------------------------------------------------------

/**
 * The connection and the sync, together — one is the health of the other.
 * Save is the dialog's only deferred write, and it stays beside the field it
 * commits (docs/features/settings.md).
 */
function CalibrePane() {
  const queryClient = useQueryClient();
  const { data: preferences } = useQuery(preferencesQuery);

  const [url, setUrl] = useState(preferences?.[PREF_KEYS.calibreServerUrl] ?? "");
  const [test, setTest] = useState<CalibreServerTest | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function runTest() {
    setTesting(true);
    setTest(null);
    try {
      setTest(await testCalibreServer(url));
    } catch (err) {
      setTest({ ok: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      const savedPrefs = await savePreferences({
        [PREF_KEYS.calibreServerUrl]: url.trim().replace(/\/+$/, ""),
      });
      queryClient.setQueryData(preferencesQuery.queryKey, savedPrefs);
      // The proxy resolves its target per request, so the only stale thing is
      // the book list we already fetched from the old server.
      void queryClient.invalidateQueries({ queryKey: booksQuery.queryKey });
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5">
      <PaneHeader
        title="Calibre"
        description="Where the content server is, and the state of Grimoire's copy of it."
      />

      <section className="grid gap-2">
        <Label htmlFor="settings-server-url">Content server URL</Label>
        <div className="flex gap-2">
          <Input
            id="settings-server-url"
            value={url}
            placeholder="http://localhost:8080"
            spellCheck={false}
            onChange={(e) => {
              setUrl(e.target.value);
              setTest(null);
              setSaved(false);
            }}
          />
          <Button
            variant="outline"
            className="shrink-0"
            onClick={() => void runTest()}
            disabled={testing || !url.trim()}
          >
            {testing && <Loader2 className="animate-spin" />}
            Test
          </Button>
          <Button className="shrink-0" onClick={() => void save()} disabled={saving || !url.trim()}>
            {saving && <Loader2 className="animate-spin" />}
            {saved ? "Saved" : "Save"}
          </Button>
        </div>
        {test && <CalibreTestResult test={test} />}
        {saveError && <p className="text-destructive text-sm">{saveError}</p>}
      </section>

      <SyncSettings />
    </div>
  );
}

/** How a stored interval reads in the select. 0 is "never", which is a real choice. */
function intervalLabel(minutes: number): string {
  if (minutes <= 0) return "Never — only when I ask";
  if (minutes === 1) return "Every minute";
  if (minutes === 60) return "Every hour";
  return `Every ${minutes} minutes`;
}

/**
 * The state of Grimoire's copy of the library as a tile row, and the two
 * things you can do about it: sync now, or change how often it happens.
 * See docs/features/calibre-sync.md.
 */
function SyncSettings() {
  const { data: status } = useSyncStatus();
  const startSync = useStartSync();
  const saveInterval = useSaveSyncInterval();

  if (!status) return <p className="text-muted-foreground text-[13px]">Checking…</p>;

  const orphaned = status.bookCount - status.inLibraryCount;

  return (
    <section className="grid gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="In Calibre" value={status.inLibraryCount.toLocaleString()} />
        <StatTile
          label="Tracked"
          value={status.bookCount.toLocaleString()}
          // Only worth explaining when the two numbers differ — otherwise it
          // reads as a discrepancy where there isn't one.
          hint={orphaned > 0 ? `${orphaned.toLocaleString()} left Calibre` : undefined}
        />
        <StatTile
          label="Last synced"
          value={status.lastCompletedAt ? relativeTime(status.lastCompletedAt) : "Never"}
          hint={
            status.lastCompletedAt ? new Date(status.lastCompletedAt).toLocaleString() : undefined
          }
        />
        <StatTile
          label="Last attempt"
          value={status.lastAttemptedAt ? relativeTime(status.lastAttemptedAt) : "Never"}
          hint={status.lastStatus === "error" ? "failed" : (status.lastStatus ?? undefined)}
        />
      </div>

      {status.lastStatus === "error" && status.lastError && (
        <div className="border-destructive/40 bg-destructive/10 grid gap-1 rounded-lg border p-2.5">
          <p className="text-destructive text-[13px]">{status.lastError}</p>
          {status.lastErrorHint && (
            <p className="text-muted-foreground text-[12px]">{status.lastErrorHint}</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="grid flex-1 gap-2">
          <Label htmlFor="sync-interval">Sync automatically</Label>
          {/* Radix speaks strings; the interval is stored and saved as minutes. */}
          <Select
            value={String(status.intervalMinutes)}
            onValueChange={(value) => saveInterval.mutate(Number(value))}
            disabled={saveInterval.isPending}
          >
            <SelectTrigger id="sync-interval" className="w-full">
              <SelectValue />
            </SelectTrigger>
            {/* Popper rather than the item-aligned default: this lives in a
                dialog that scrolls, where laying the list over the trigger
                puts it in the wrong place. */}
            <SelectContent position="popper">
              {SYNC_INTERVAL_CHOICES.map((minutes) => (
                <SelectItem key={minutes} value={String(minutes)}>
                  {intervalLabel(minutes)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          onClick={() => startSync.mutate()}
          disabled={status.running || !status.configured}
        >
          {status.running && <Loader2 className="animate-spin" />}
          {/* Mid-sync the button reports progress rather than offering an action
              it would ignore — the same phase wording the indicator's tooltip uses. */}
          {status.running ? syncTooltip(status) : "Sync now"}
        </Button>
      </div>
    </section>
  );
}

// --- Hardcover -------------------------------------------------------------

/** A card per reader — the token is a person, not a setting (ADR 0012). */
function HardcoverPane() {
  const queryClient = useQueryClient();
  const { data: users } = useQuery(usersQuery);

  // Linking, unlinking or syncing comes back with the whole reader.
  const onUpdated = (user: User) => {
    queryClient.setQueryData(
      usersQuery.queryKey,
      (current: User[] | undefined) =>
        current?.map((existing) => (existing.id === user.id ? user : existing)) ?? [user],
    );
  };

  return (
    <div className="grid gap-5">
      <PaneHeader
        title="Hardcover"
        description="Each reader's own hardcover.app account — what came across, and which source wins."
      />
      <div className="grid gap-3">
        {(users ?? []).map((user) => (
          <HardcoverAccountCard key={user.id} user={user} onChange={onUpdated} />
        ))}
      </div>
    </div>
  );
}

// --- Readers ---------------------------------------------------------------

/**
 * Who reads here. Switching the device's reader moved to the header avatar
 * menu — this pane lists and adds (docs/features/settings.md).
 */
function ReadersPane() {
  const queryClient = useQueryClient();
  const { data: users } = useQuery(usersQuery);
  const currentUser = useCurrentUser();

  return (
    <div className="grid gap-5">
      <PaneHeader
        title="Readers"
        description="Everyone sharing this library. Switch readers from the avatar in the header."
      />
      <ReaderList
        users={users ?? []}
        currentUserId={currentUser?.id}
        onAdded={(user) => {
          queryClient.setQueryData(usersQuery.queryKey, [...(users ?? []), user]);
          // First reader on a device nobody has claimed: that's you.
          if (!currentUser) setCurrentUserId(user.id);
        }}
      />
    </div>
  );
}

function ReaderList({
  users,
  currentUserId,
  onAdded,
}: {
  users: User[];
  currentUserId?: number;
  onAdded: (user: User) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<UserColorId>(() => nextUserColor(users.map((u) => u.color)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (!name.trim()) return setError("A name is required");
    setBusy(true);
    setError(null);
    try {
      onAdded(await createUser({ name: name.trim(), color }));
      setName("");
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ul className="grid gap-1">
        {users.map((user) => (
          <li
            key={user.id}
            className="border-line flex items-center gap-2.5 rounded-lg border px-3 py-2"
          >
            <UserAvatar name={user.name} color={user.color} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px]">{user.name}</p>
              {user.hardcoverUsername && (
                <p className="text-muted-foreground truncate text-[11px]">
                  Hardcover · {user.hardcoverUsername}
                </p>
              )}
            </div>
            {user.id === currentUserId && (
              <span className="text-you-soft bg-you-dim rounded-full px-2 py-0.5 text-[11px]">
                This device
              </span>
            )}
          </li>
        ))}
      </ul>

      {adding ? (
        <form
          className="border-line bg-fill grid gap-3 rounded-lg border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="new-reader-name">Name</Label>
            <Input
              id="new-reader-name"
              value={name}
              placeholder="Their name"
              autoFocus
              autoComplete="off"
              maxLength={USER_NAME_MAX_LENGTH}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label>Colour</Label>
            <UserColorPicker value={color} onChange={setColor} />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy || !name.trim()}>
              {busy && <Loader2 className="animate-spin" />}
              Add
            </Button>
          </div>
        </form>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="justify-self-start"
          onClick={() => setAdding(true)}
        >
          <Plus />
          Add reader
        </Button>
      )}
    </>
  );
}

// --- Duplicates ------------------------------------------------------------

/**
 * Grouping a book held by two sources into one card
 * (docs/features/book-matching.md). This runs at startup and after any sync
 * that changed something, so the button is a "look again" — worth having
 * because the interesting number is the one it *doesn't* group.
 */
function DuplicatesPane() {
  const queryClient = useQueryClient();
  const [outcome, setOutcome] = useState<MatchOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The review queue, and the shelf to name its books from
  // (docs/features/resolving-duplicates.md).
  const { data: books } = useQuery(booksQuery);
  const { data: pending, isPending: loadingQueue } = useQuery(pendingDuplicatesQuery);
  const link = useLinkDuplicate();
  const dismiss = useDismissDuplicate();

  async function run() {
    setBusy(true);
    setError(null);
    setOutcome(null);
    try {
      setOutcome(await matchBooks());
      // Grouping changes what the shelf shows — and what's left to answer.
      void queryClient.invalidateQueries({ queryKey: booksQuery.queryKey });
      void queryClient.invalidateQueries({ queryKey: pendingDuplicatesQuery.queryKey });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5">
      <PaneHeader
        title="Duplicates"
        description="A book in both Calibre and Hardcover is one card carrying both marks."
      />
      <div className="grid gap-2">
        <p className="text-muted-foreground text-[13px]">
          Matching runs on its own — at startup and after any sync that changed something. This
          looks again.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void run()} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            Find duplicates
          </Button>
          {outcome && (
            <p className="text-muted-foreground text-[13px]">
              {outcome.grouped > 0
                ? `Grouped ${outcome.grouped.toLocaleString()} ${outcome.grouped === 1 ? "book" : "books"}.`
                : "Nothing new to group."}
              {outcome.conflicts > 0 &&
                ` ${outcome.conflicts.toLocaleString()} left for the queue below.`}
            </p>
          )}
          {error && <p className="text-destructive text-[13px]">{error}</p>}
        </div>
      </div>

      <section className="grid gap-2">
        <h4 className="text-muted-foreground text-[11px] tracking-wide uppercase">
          Waiting for an answer
        </h4>
        <DuplicateQueue
          pairs={pending?.pairs ?? []}
          total={pending?.total ?? 0}
          loading={loadingQueue}
          bookFor={(workId) => books?.find((book) => book.id === workId)}
          busy={link.isPending || dismiss.isPending}
          // Same book: the merge invalidates books and every duplicates query,
          // which is what removes the row.
          onSame={(pair) => link.mutate({ workId: pair.workId, otherWorkId: pair.otherWorkId })}
          onNotSame={(pair) =>
            dismiss.mutate(
              { workId: pair.workId, bookId: pair.bookId, otherBookId: pair.otherBookId },
              {
                // The per-work mutation writes its own cache; the queue is
                // library-wide and has to be asked again.
                onSuccess: () =>
                  void queryClient.invalidateQueries({
                    queryKey: pendingDuplicatesQuery.queryKey,
                  }),
              },
            )
          }
        />
      </section>
    </div>
  );
}
