import { createApi } from "@grimoire/api";
import Electrobun, { BrowserWindow, Updater, Utils } from "electrobun/bun";

const VITE_DEV_URL = "http://localhost:4746";
// Matches the Vite proxy target so HMR dev and the packaged app agree.
const DEFAULT_API_PORT = 4747;

// Bun's default idleTimeout is 10s, which kills long in-request work: a
// Hardcover sweep (POST /api/users/:id/hardcover/sync) waits on the rate
// limiter's bucket for two requests a page (hardcover-rate-limit.ts), and a
// cover refetch alone allows 30s upstream. 30s lets the
// common case finish and report a real error instead of a dropped socket. A
// very large Hardcover sweep can still exceed it — the durable fix is to make
// that endpoint return 202 and poll.
const IDLE_TIMEOUT_SECONDS = 30;

// Claim the port *before* building the API: whoever holds DEFAULT_API_PORT is
// the primary process, and only the primary may run the sync schedulers. Losing
// the race means another instance (or the standalone server) is already syncing
// the same grimoire.db — a second scheduler would give that WAL file two
// writers, duplicate Hardcover traffic and SQLITE_BUSY. Serve 503 until the real
// handler is swapped in below, which is the only window where the port is bound
// without an API behind it.
const unavailable = () => new Response("Grimoire API starting", { status: 503 });
let server: ReturnType<typeof Bun.serve>;
let isPrimary = true;
try {
  server = Bun.serve({
    port: DEFAULT_API_PORT,
    idleTimeout: IDLE_TIMEOUT_SECONDS,
    fetch: unavailable,
  });
} catch {
  // Port taken — pick any free port; the UI learns it via the ?apiPort query
  // param below.
  isPrimary = false;
  server = Bun.serve({ port: 0, idleTimeout: IDLE_TIMEOUT_SECONDS, fetch: unavailable });
}

// The desktop app embeds the same Hono API the hosted server runs. CORS is
// needed because the bundled UI is served from a views:// origin.
const api = createApi({ cors: true, sync: isPrimary });
server.reload({ fetch: api.fetch });
console.log(
  `Grimoire API listening on http://localhost:${server.port}` +
    (isPrimary ? "" : " (secondary instance: sync schedulers disabled)"),
);

/**
 * Hand every `target="_blank"` to the operating system's browser.
 *
 * The system webview raises a new-window request and, if the host takes no
 * interest, drops it — so an external link in `apps/web` does nothing at all
 * here while working fine in the browser and hosted builds. Answering it in the
 * shell keeps such a link one plain anchor in the UI
 * (docs/features/book-details-panel.md), rather than something the frontend has
 * to know which target it is running in to draw.
 *
 * Only `http(s)`: this turns a page the UI names into a browser tab, and is not
 * a door onto arbitrary URL schemes.
 */
Electrobun.events.on("new-window-open", (event: unknown) => {
  const detail = (event as { data?: { detail?: unknown } }).data?.detail;
  const url = typeof detail === "string" ? detail : (detail as { url?: unknown } | undefined)?.url;
  if (typeof url !== "string") return;
  if (!/^https?:\/\//i.test(url)) return;
  Utils.openExternal(url);
});

async function getMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    try {
      await fetch(VITE_DEV_URL, { method: "HEAD" });
      console.log(`HMR enabled: using Vite dev server at ${VITE_DEV_URL}`);
      return VITE_DEV_URL;
    } catch {
      console.log(
        "Vite dev server not running; loading bundled UI. Use `bun run dev:hmr` for HMR.",
      );
    }
  }
  return `views://mainview/index.html?apiPort=${server.port}`;
}

const url = await getMainViewUrl();

new BrowserWindow({
  title: "Grimoire Books",
  url,
  frame: {
    width: 1280,
    height: 860,
    x: 100,
    y: 100,
  },
});
