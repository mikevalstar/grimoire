import { useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
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
import {
  PREF_KEYS,
  PREFERENCES_VERSION,
  savePreferences,
  testCalibreServer,
  type CalibreServerTest,
  type Preferences,
} from "@/lib/api";

const DEFAULT_SERVER_URL = "http://localhost:8080";

/**
 * First-run setup. Shown while the stored preferences version is behind
 * PREFERENCES_VERSION; saving records the content server URL and stamps the
 * version so it doesn't come back. More steps will land here later.
 */
export function SetupDialog({
  preferences,
  onSaved,
}: {
  preferences: Preferences;
  onSaved: (preferences: Preferences) => void;
}) {
  const [url, setUrl] = useState(preferences[PREF_KEYS.calibreServerUrl] ?? DEFAULT_SERVER_URL);
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
      onSaved(
        await savePreferences({
          [PREF_KEYS.calibreServerUrl]: url.trim().replace(/\/+$/, ""),
          [PREF_KEYS.version]: String(PREFERENCES_VERSION),
        }),
      );
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        // Setup is required, so no escape hatches until it's saved.
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Connect to Calibre</DialogTitle>
          <DialogDescription>
            Grimoire reads your library through Calibre's content server. In Calibre, open
            Preferences → Sharing over the net and turn the content server on, then enter its
            address below.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
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
          {test && (
            <p
              className={`flex items-start gap-2 text-sm ${
                test.ok ? "text-green-600 dark:text-green-500" : "text-destructive"
              }`}
            >
              {test.ok ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              ) : (
                <XCircle className="mt-0.5 size-4 shrink-0" />
              )}
              {test.ok ? `Connected — ${test.bookCount} books found.` : test.error}
            </p>
          )}
          {saveError && <p className="text-sm text-destructive">{saveError}</p>}
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => void runTest()} disabled={testing || !url.trim()}>
            {testing && <Loader2 className="animate-spin" />}
            Test
          </Button>
          <Button onClick={() => void save()} disabled={saving || !url.trim()}>
            {saving && <Loader2 className="animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
