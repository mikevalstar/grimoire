# Grimoire Books

UI for browsing/organizing a Calibre ebook library. Ships as an Electrobun
desktop app, a self-hosted server, and a local web app from one codebase.
Read-only against Calibre's `metadata.db` for now — Calibre remains the source
of truth; replacing it as the backend is the long-term goal.

## Architecture

Bun workspaces monorepo. The rule that keeps it coherent: **every mode speaks
the same HTTP API**.

- `packages/core` — Calibre access (`bun:sqlite`, read-only) plus `SettingsStore`,
  Grimoire's *own* writable SQLite db (`grimoire.db` in the platform data dir —
  see Gotchas). Types and browser-safe constants live in `src/types.ts` so
  `apps/web` can import from `@grimoire/core/types` without touching bun-only
  modules.
- `packages/api` — `createApi()` returns the Hono app (`/api/...` routes).
  Embedded by both server and desktop; opens the library lazily so it can start
  unconfigured and return a 503 with a hint. Also reverse-proxies a running
  Calibre content server at `/api/cs/*` — e.g. `/api/cs/ajax/search`,
  `/api/cs/ajax/books`. The proxy target is resolved *per request* from the
  `calibre.serverUrl` preference (falling back to `CALIBRE_SERVER`, then
  `http://localhost:8080`), so saving it in the UI takes effect without a
  restart. `GET|PUT /api/preferences` read/merge-write the key/value store;
  `POST /api/calibre/test` probes a candidate content server URL server-side
  (no CORS involved) and reports its book count.
- `apps/web` — React 19 + Vite + Tailwind 4 + shadcn/ui. Built with
  `base: "./"` so the same bundle works from `views://` (desktop) and `/`
  (server). API base resolution is in `src/lib/api.ts`: same-origin normally,
  `localhost:<apiPort>` when served from a `views://` origin.
- `apps/server` — hosted mode: API + static serving of `apps/web/dist` with SPA
  fallback. Port 4747 (matches the Vite dev proxy).
- `apps/desktop` — Electrobun shell: starts the embedded API (4747, falls back
  to a random port passed via `?apiPort=`), loads Vite dev server when running
  and reachable, else the bundled `views://mainview/index.html`.

## Notes

### Designs
1. we are working off the design idea here (as a general approach, not everything weill be kept) /Users/mikevalstar/projects/grim-ideas/src/designs/d08-latitude
2. We will use and re-style chadcn components as needed to meet the design (install using th eshadcn cli commands)
3. all New common components should be added to the storybook

## Commands

- `bun dev` — web dev (Vite :4746 + API :4747; "GRIM" on a phone keypad)
- `bun run dev:desktop` — desktop dev with HMR
- `bun run typecheck` — all workspaces (tsc, TypeScript 7)
- `bun run build:web` / `build:desktop` / `start:server`
- shadcn components: `cd apps/web && bunx shadcn@latest add <name>`

## Gotchas

- Electrobun 1.18 exports raw `.ts` sources; `apps/desktop/tsconfig.json` needs
  DOM lib + `@types/three` to typecheck them. Imports come from
  `electrobun/bun`, config type is `build.bun.entrypoint` in
  `electrobun.config.ts`.
- `CALIBRE_LIBRARY` env var overrides the library path (default
  `~/Calibre Library`); `GRIMOIRE_DATA_DIR` overrides where `grimoire.db` lives
  (default `~/Library/Application Support/Grimoire Books` on macOS, `%APPDATA%`
  on Windows, `$XDG_DATA_HOME/grimoire-books` elsewhere). Point it at a temp dir
  to exercise first-run setup without clobbering real preferences.
- First-run setup is driven by the `preferences.version` row: it seeds to `"0"`,
  and the web app shows the setup modal while it's below `PREFERENCES_VERSION`
  (`packages/core/src/types.ts`). Bump that constant to force users through a
  new round of setup; keep new prompts in `apps/web/src/components/setup-dialog.tsx`.
- Calibre stores ratings 0–10; core halves them to 0–5 stars.
- TypeScript 7 (tsgo): no `baseUrl`, and `types` must be listed explicitly per
  workspace tsconfig.
