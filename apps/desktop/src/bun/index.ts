import { BrowserWindow, Updater } from "electrobun/bun";
import { createApi } from "@grimoire/api";

const VITE_DEV_URL = "http://localhost:5173";
// Matches the Vite proxy target so HMR dev and the packaged app agree.
const DEFAULT_API_PORT = 3001;

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

async function getMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    try {
      await fetch(VITE_DEV_URL, { method: "HEAD" });
      console.log(`HMR enabled: using Vite dev server at ${VITE_DEV_URL}`);
      return VITE_DEV_URL;
    } catch {
      console.log("Vite dev server not running; loading bundled UI. Use `bun run dev:hmr` for HMR.");
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
