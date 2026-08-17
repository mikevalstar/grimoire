import { join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createApi } from "@grimoire/api";

const PORT = Number(process.env.PORT ?? 4747);
const WEB_DIST = process.env.WEB_DIST ?? fileURLToPath(new URL("../../web/dist", import.meta.url));

const app = createApi();

// Serve the built web UI (SPA fallback to index.html). In dev you'll usually
// use the Vite dev server on :4746 instead, which proxies /api here.
app.get("*", async (c) => {
  const urlPath = decodeURIComponent(new URL(c.req.url).pathname);
  const filePath = normalize(join(WEB_DIST, urlPath === "/" ? "index.html" : urlPath));
  if (filePath.startsWith(WEB_DIST)) {
    const file = Bun.file(filePath);
    if (await file.exists()) return new Response(file);
  }
  const index = Bun.file(join(WEB_DIST, "index.html"));
  if (await index.exists()) return new Response(index);
  return c.text(
    "Web UI not built yet. Run `bun run build:web` from the repo root, or use the Vite dev server (`bun dev`).",
    404,
  );
});

// Bun's default idleTimeout is 10s, which kills long in-request work: a
// Hardcover sweep (POST /api/users/:id/hardcover/sync) waits on the rate
// limiter's bucket for two requests a page (hardcover-rate-limit.ts), and a
// cover refetch alone allows 30s upstream. 30s lets the
// common case finish and report a real error instead of a dropped socket. A
// very large Hardcover sweep can still exceed it — the durable fix is to make
// that endpoint return 202 and poll.
const server = Bun.serve({ port: PORT, idleTimeout: 30, fetch: app.fetch });
console.log(`Grimoire server running at http://localhost:${server.port}`);
