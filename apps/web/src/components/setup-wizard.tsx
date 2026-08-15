import { nextUserColor, USER_NAME_MAX_LENGTH, type UserColorId } from "@grimoire/core/types";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Globe,
  Loader2,
  Plus,
  Server,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { CalibreTestResult } from "@/components/calibre-test-result";
import { HardcoverAccountCard } from "@/components/hardcover-account-card";
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
  PREFERENCES_VERSION,
  type Preferences,
  savePreferences,
  testCalibreServer,
  type User,
} from "@/lib/api";

const DEFAULT_SERVER_URL = "http://localhost:8080";

const STEPS = ["Welcome", "Calibre", "Readers", "Hardcover", "Done"] as const;
type Step = 0 | 1 | 2 | 3 | 4;

/** A reader typed into the wizard but not yet written to grimoire.db. */
interface DraftReader {
  name: string;
  color: UserColorId;
}

export interface SetupWizardResult {
  preferences: Preferences;
  /**
   * Everyone in the database when the wizard finished — pre-existing readers
   * included, carrying any Hardcover links made here.
   */
  users: User[];
}

/**
 * First-run setup — see docs/features/first-run-setup-wizard.md. Shown while
 * the stored preferences version is behind PREFERENCES_VERSION; welcomes the
 * user, connects Calibre, collects the people who read here, and offers each
 * of them a Hardcover link. Writes go in step order — readers on leaving their
 * step, links as they're made — but the version stamp goes last of all, so an
 * interrupted run comes back.
 */
export function SetupWizard({
  preferences,
  existingUsers = [],
  onFinished,
}: {
  preferences: Preferences;
  /** Readers already in the database — shown, but not editable here. */
  existingUsers?: User[];
  onFinished: (result: SetupWizardResult) => void;
}) {
  const [step, setStep] = useState<Step>(0);

  const [url, setUrl] = useState(preferences[PREF_KEYS.calibreServerUrl] ?? DEFAULT_SERVER_URL);
  const [test, setTest] = useState<CalibreServerTest | null>(null);
  /** Which button is waiting on the probe, so only that one spins. */
  const [testing, setTesting] = useState<"test" | "continue" | null>(null);

  const [readers, setReaders] = useState<DraftReader[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState(() => nextUserColor(existingUsers.map((u) => u.color)));
  const [nameError, setNameError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Kept as state so a Hardcover link made on step 3 lands back in the list.
  const [existing, setExisting] = useState<User[]>(existingUsers);
  const [created, setCreated] = useState<User[]>([]);
  const [saved, setSaved] = useState<Preferences>(preferences);

  // Readers that are in the database already — from a previous run, or from a
  // continue that got halfway before failing. Shown, but not editable here.
  const locked = [...existing, ...created];
  const takenNames = [...locked.map((u) => u.name), ...readers.map((r) => r.name)];
  const takenColors = [...locked.map((u) => u.color), ...readers.map((r) => r.color)];

  async function runTest(from: "test" | "continue" = "test"): Promise<CalibreServerTest> {
    setTesting(from);
    setTest(null);
    let result: CalibreServerTest;
    try {
      result = await testCalibreServer(url);
    } catch (err) {
      result = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    setTest(result);
    setTesting(null);
    return result;
  }

  /**
   * Continue from the Calibre step. An untested URL is probed first: a good
   * one advances, a bad one warns — and the button then says "Continue
   * anyway", because a content server that isn't running yet shouldn't trap
   * anyone in setup.
   */
  async function continueFromCalibre() {
    if (test) return setStep(2);
    if ((await runTest("continue")).ok) setStep(2);
  }

  /** Commit the name in the field as a reader. Returns the new list, or null. */
  function addReader(): DraftReader[] | null {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("A name is required");
      return null;
    }
    if (takenNames.some((taken) => taken.toLowerCase() === trimmed.toLowerCase())) {
      setNameError(`${trimmed} is already on the list`);
      return null;
    }
    const next = [...readers, { name: trimmed, color }];
    setReaders(next);
    setName("");
    setNameError(null);
    setColor(nextUserColor([...takenColors, color]));
    return next;
  }

  function removeReader(index: number) {
    setReaders((current) => current.filter((_, i) => i !== index));
  }

  /**
   * Leaving the readers step is what creates them — the Hardcover step needs
   * real ids to link against. Setup stays incomplete until the version stamp
   * on Finish, so a failure here brings the wizard back rather than stranding
   * a library with no readers.
   */
  async function continueFromReaders() {
    // Let someone who typed a name and pressed Continue keep that name.
    const all = name.trim() ? addReader() : readers;
    if (all === null) return; // the name in the field is blank or a duplicate
    if (all.length === 0 && locked.length === 0) {
      setNameError("Add at least one reader");
      return;
    }

    setSaving(true);
    setSaveError(null);
    const done = [...created];
    const pending = [...all];
    try {
      while (pending.length > 0) {
        const reader = pending[0]!;
        done.push(await createUser({ name: reader.name, color: reader.color }));
        pending.shift();
      }
      setStep(3);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      // Whoever landed is in the database now — a retry must not create them
      // twice, so they move to the locked list and leave the drafts behind.
      setCreated(done);
      setReaders(pending);
      setSaving(false);
    }
  }

  /** Linking or unlinking on the Hardcover step comes back as a whole reader. */
  function userUpdated(user: User) {
    const swap = (list: User[]) => list.map((u) => (u.id === user.id ? user : u));
    setExisting(swap);
    setCreated(swap);
  }

  /**
   * The last write: the content server URL and the version stamp that marks
   * setup complete. Saving a changed URL is also what starts the first sync —
   * the server re-arms and syncs immediately when it changes.
   */
  async function finish() {
    setSaving(true);
    setSaveError(null);
    try {
      setSaved(
        await savePreferences({
          [PREF_KEYS.calibreServerUrl]: url.trim().replace(/\/+$/, ""),
          [PREF_KEYS.version]: String(PREFERENCES_VERSION),
        }),
      );
      setStep(4);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        // Tall steps scroll inside the modal rather than off a short window.
        className="max-h-[90vh] gap-5 overflow-y-auto sm:max-w-xl"
        // Setup is required — there's no library to fall back to.
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {step === 0 && <WelcomeStep />}

        {step === 1 && (
          <>
            <StepHeader
              icon={<Server size={18} />}
              title="Connect to Calibre"
              description="Turn on Calibre's content server — Preferences → Sharing over the net — then enter its address."
            />
            <form
              className="grid gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void continueFromCalibre();
              }}
            >
              <Label htmlFor="calibre-server-url">Content server URL</Label>
              <Input
                id="calibre-server-url"
                value={url}
                placeholder={DEFAULT_SERVER_URL}
                autoFocus
                spellCheck={false}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setTest(null);
                }}
              />
              {test && <CalibreTestResult test={test} />}
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <StepHeader
              icon={<Users size={18} />}
              title="Who's reading?"
              description="Add yourself, then anyone else who uses this library."
            />

            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                addReader();
              }}
            >
              <div className="grid gap-2">
                <Label htmlFor="reader-name">Name</Label>
                <div className="flex gap-2">
                  <Input
                    id="reader-name"
                    value={name}
                    placeholder="Your name"
                    autoFocus
                    autoComplete="off"
                    maxLength={USER_NAME_MAX_LENGTH}
                    onChange={(e) => {
                      setName(e.target.value);
                      setNameError(null);
                    }}
                  />
                  <Button type="submit" variant="outline" className="shrink-0">
                    <Plus />
                    Add reader
                  </Button>
                </div>
                {nameError && <p className="text-destructive text-sm">{nameError}</p>}
              </div>

              <div className="grid gap-2">
                <Label>Colour</Label>
                <UserColorPicker value={color} onChange={setColor} />
              </div>
            </form>

            {(readers.length > 0 || locked.length > 0) && (
              <div className="border-line bg-fill grid gap-1.5 rounded-lg border p-2">
                {locked.map((user) => (
                  <ReaderRow
                    key={`existing-${user.id}`}
                    name={user.name}
                    color={user.color}
                    note="already here"
                  />
                ))}
                {readers.map((reader, i) => (
                  <ReaderRow
                    key={reader.name}
                    name={reader.name}
                    color={reader.color}
                    onRemove={() => removeReader(i)}
                  />
                ))}
              </div>
            )}

            {saveError && <p className="text-destructive text-sm">{saveError}</p>}
          </>
        )}

        {step === 3 && (
          <>
            <StepHeader
              icon={<Globe size={18} />}
              title="Link Hardcover"
              description="Optional — connect each reader's own hardcover.app account to bring their shelves and ratings across. Anyone skipped can link later in settings."
            />
            <div className="grid gap-3">
              {locked.map((user) => (
                <HardcoverAccountCard key={user.id} user={user} onChange={userUpdated} />
              ))}
            </div>
            {saveError && <p className="text-destructive text-sm">{saveError}</p>}
          </>
        )}

        {step === 4 && (
          <DoneStep bookCount={test?.ok ? test.bookCount : undefined} readers={locked} />
        )}

        <DialogFooter className="sm:items-center sm:justify-between">
          <StepRail step={step} />

          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {step >= 1 && step <= 3 ? (
              <Button variant="ghost" onClick={() => setStep((step - 1) as Step)} disabled={saving}>
                <ArrowLeft />
                Back
              </Button>
            ) : null}

            {step === 0 && <Button onClick={() => setStep(1)}>Get started</Button>}

            {step === 1 && (
              <>
                <Button
                  variant="outline"
                  onClick={() => void runTest()}
                  disabled={testing !== null || !url.trim()}
                >
                  {testing === "test" && <Loader2 className="animate-spin" />}
                  Test
                </Button>
                <Button
                  onClick={() => void continueFromCalibre()}
                  disabled={testing !== null || !url.trim()}
                >
                  {testing === "continue" && <Loader2 className="animate-spin" />}
                  {test && !test.ok ? "Continue anyway" : "Continue"}
                </Button>
              </>
            )}

            {step === 2 && (
              <Button
                onClick={() => void continueFromReaders()}
                disabled={saving || (readers.length === 0 && !name.trim() && locked.length === 0)}
              >
                {saving && <Loader2 className="animate-spin" />}
                Continue
              </Button>
            )}

            {step === 3 && (
              <Button onClick={() => void finish()} disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                Finish
              </Button>
            )}

            {step === 4 && (
              <Button onClick={() => onFinished({ preferences: saved, users: locked })}>
                Open library
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WelcomeStep() {
  return (
    <>
      <DialogHeader className="items-center gap-3 text-center sm:text-center">
        <span className="bg-you-dim text-you-soft ring-you-glow flex size-12 items-center justify-center rounded-2xl ring-1">
          <BookOpen size={22} />
        </span>
        <DialogTitle className="text-xl">Welcome to Grimoire</DialogTitle>
        <DialogDescription>A reader and organizer for your Calibre library.</DialogDescription>
      </DialogHeader>

      <ul className="grid gap-2.5">
        <WelcomePoint icon={<Server size={15} />}>Reads Calibre Data.</WelcomePoint>
        <WelcomePoint icon={<Users size={15} />}>
          Keep track of multiple readers and better organize your books.
        </WelcomePoint>
        <WelcomePoint icon={<Sparkles size={15} />}>
          Desktop, and browser based support.
        </WelcomePoint>
      </ul>
    </>
  );
}

function WelcomePoint({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 text-[13px]">
      <span className="border-line bg-fill text-you-soft flex size-7 shrink-0 items-center justify-center rounded-lg border">
        {icon}
      </span>
      {children}
    </li>
  );
}

function StepHeader({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <DialogHeader>
      <span className="bg-you-dim text-you-soft flex size-9 items-center justify-center rounded-xl">
        {icon}
      </span>
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>{description}</DialogDescription>
    </DialogHeader>
  );
}

function ReaderRow({
  name,
  color,
  note,
  onRemove,
}: {
  name: string;
  color: string;
  note?: string;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-md px-1.5 py-1">
      <UserAvatar name={name} color={color} size="sm" />
      <span className="flex-1 truncate text-[13px]">{name}</span>
      {note && (
        <span className="text-muted-foreground text-[11px] uppercase tracking-wide">{note}</span>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          className="text-muted-foreground hover:text-foreground flex size-6 items-center justify-center rounded-md transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function DoneStep({ bookCount, readers }: { bookCount?: number; readers: User[] }) {
  return (
    <>
      <DialogHeader className="items-center gap-3 text-center sm:text-center">
        <span className="bg-you-dim text-you-soft ring-you-glow flex size-12 items-center justify-center rounded-2xl ring-1">
          <CheckCircle2 size={22} />
        </span>
        <DialogTitle className="text-xl">Ready</DialogTitle>
        <DialogDescription>
          {bookCount === undefined
            ? "Start the content server and your books will appear."
            : `${bookCount.toLocaleString()} books found — the first sync is already running.`}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap justify-center gap-4 py-2">
        {readers.map((reader) => (
          <span key={reader.id} className="flex flex-col items-center gap-1.5">
            <UserAvatar name={reader.name} color={reader.color} size="lg" />
            <span className="text-muted-foreground max-w-24 truncate text-[11px]">
              {reader.name}
            </span>
          </span>
        ))}
      </div>
    </>
  );
}

/** Where you are, in dots — steps you've passed are filled. */
function StepRail({ step }: { step: Step }) {
  return (
    <div className="text-muted-foreground flex items-center gap-2 text-[11px]">
      <span className="flex items-center gap-1" aria-hidden="true">
        {STEPS.map((label, i) => (
          <span
            key={label}
            className={`h-1.5 rounded-full transition-all duration-300 ease-spring ${
              i === step ? "bg-you w-4" : i < step ? "bg-you-soft/60 w-1.5" : "bg-line-strong w-1.5"
            }`}
          />
        ))}
      </span>
      <span>
        Step {step + 1} of {STEPS.length}
      </span>
    </div>
  );
}
