import { nextUserColor, USER_NAME_MAX_LENGTH, type UserColorId } from "@grimoire/core/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Plus } from "lucide-react";
import { type ReactNode, useState } from "react";
import { CalibreTestResult } from "@/components/calibre-test-result";
import { Button } from "@/components/ui/button";
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
import { UserAvatar } from "@/components/user-avatar";
import { UserColorPicker } from "@/components/user-color-picker";
import {
  type CalibreServerTest,
  createUser,
  PREF_KEYS,
  savePreferences,
  testCalibreServer,
  type User,
} from "@/lib/api";
import { setCurrentUserId, useCurrentUser } from "@/lib/current-user";
import { booksQuery, preferencesQuery, usersQuery } from "@/lib/queries";

/**
 * Everything configurable after first run, on one page — see
 * docs/features/settings.md. Unlike the setup wizard this is an ordinary
 * dialog: Escape and an outside click both close it.
 */
export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Radix only mounts this while open, so the form starts from the stored
          values every time rather than from whatever was typed last. */}
      <DialogContent className="max-h-[90vh] gap-5 overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Your Calibre connection and the readers here.</DialogDescription>
        </DialogHeader>
        <SettingsForm onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function SettingsForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: preferences } = useQuery(preferencesQuery);
  const { data: users } = useQuery(usersQuery);
  const currentUser = useCurrentUser();

  const [url, setUrl] = useState(preferences?.[PREF_KEYS.calibreServerUrl] ?? "");
  const [test, setTest] = useState<CalibreServerTest | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
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
      const saved = await savePreferences({
        [PREF_KEYS.calibreServerUrl]: url.trim().replace(/\/+$/, ""),
      });
      queryClient.setQueryData(preferencesQuery.queryKey, saved);
      // The proxy resolves its target per request, so the only stale thing is
      // the book list we already fetched from the old server.
      void queryClient.invalidateQueries({ queryKey: booksQuery.queryKey });
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <>
      <section className="grid gap-2">
        <SectionTitle>Library</SectionTitle>
        <Label htmlFor="settings-server-url">Calibre content server URL</Label>
        <div className="flex gap-2">
          <Input
            id="settings-server-url"
            value={url}
            placeholder="http://localhost:8080"
            spellCheck={false}
            onChange={(e) => {
              setUrl(e.target.value);
              setTest(null);
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
        </div>
        {test && <CalibreTestResult test={test} />}
        {saveError && <p className="text-destructive text-sm">{saveError}</p>}
      </section>

      <section className="grid gap-2">
        <SectionTitle>Readers</SectionTitle>
        <ReaderList
          users={users ?? []}
          currentUserId={currentUser?.id}
          onPick={(user) => setCurrentUserId(user.id)}
          onAdded={(user) => {
            queryClient.setQueryData(usersQuery.queryKey, [...(users ?? []), user]);
            // First reader on a device nobody has claimed: that's you.
            if (!currentUser) setCurrentUserId(user.id);
          }}
        />
      </section>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={() => void save()} disabled={saving || !url.trim()}>
          {saving && <Loader2 className="animate-spin" />}
          Save
        </Button>
      </DialogFooter>
    </>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-muted-foreground text-[11px] tracking-wide uppercase">{children}</h3>;
}

/**
 * Who reads here, and which of them is on this device. Picking applies at once
 * — there's nothing to review, and hiding it behind Save would only lose it.
 */
function ReaderList({
  users,
  currentUserId,
  onPick,
  onAdded,
}: {
  users: User[];
  currentUserId?: number;
  onPick: (user: User) => void;
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
      <div role="radiogroup" aria-label="Who's using this device" className="grid gap-1">
        {users.map((user) => {
          const current = user.id === currentUserId;
          return (
            // biome-ignore lint/a11y/useSemanticElements: a native radio can't carry the avatar + name row; the ARIA pattern here is complete
            <button
              key={user.id}
              type="button"
              role="radio"
              aria-checked={current}
              onClick={() => onPick(user)}
              className={`flex items-center gap-2.5 rounded-lg border px-2 py-1.5 text-left transition-colors ${
                current
                  ? "border-you/40 bg-you-dim"
                  : "border-transparent hover:border-line hover:bg-fill"
              }`}
            >
              <UserAvatar name={user.name} color={user.color} size="sm" />
              <span className="flex-1 truncate text-[13px]">{user.name}</span>
              {current && (
                <span className="text-you-soft flex items-center gap-1 text-[11px]">
                  <Check size={12} />
                  This device
                </span>
              )}
            </button>
          );
        })}
      </div>

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
