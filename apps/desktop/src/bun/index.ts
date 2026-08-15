import { createApi } from "@grimoire/api";
import Electrobun, { BrowserWindow, Updater, Utils } from "electrobun/bun";

const VITE_DEV_URL = "http://localhost:4746";
// Matches the Vite proxy target so HMR dev and the packaged app agree.
const DEFAULT_API_PORT = 4747;

// The desktop app embeds the same Hono API the hosted server runs. CORS is
// needed because the bundled UI is served from a views:// origin.
const api = createApi({ cors: true });
let server: ReturnType<typeof Bun.serve>;
try {
  server = Bun.serve({ port: DEFAULT_API_PORT, fetch: api.fetch });
} catch {
  // Port taken (another instance, or the standalone server) — pick any free
  // port; the UI learns it via the ?apiPort query param below.
  server = Bun.serve({ port: 0, fetch: api.fetch });
}
console.log(`Grimoire API listening on http://localhost:${server.port}`);

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
