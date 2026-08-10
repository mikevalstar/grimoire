# Grimoire Books

UI for browsing/organizing a Calibre ebook library. Ships as an Electrobun
desktop app, a self-hosted server, and a local web app from one codebase.
Read-only against Calibre's `metadata.db` for now — Calibre remains the source
of truth; replacing it as the backend is the long-term goal.

## Architecture

Bun workspaces monorepo. The rule that keeps it coherent: **every mode speaks
the same HTTP API**.

- `packages/core` — Calibre access (`bun:sqlite`, read-only). Pure types live in
  `src/types.ts` so browser code can `import type` from `@grimoire/core/types`
  without touching bun-only modules.
- `packages/api` — `createApi()` returns the Hono app (`/api/...` routes).
  Embedded by both server and desktop; opens the library lazily so it can start
  unconfigured and return a 503 with a hint. Also reverse-proxies a running
  Calibre content server at `/api/cs/*` (target from `CALIBRE_SERVER`, default
  `http://localhost:8080`) — e.g. `/api/cs/ajax/search`, `/api/cs/ajax/books`.
- `apps/web` — React 19 + Vite + Tailwind 4 + shadcn/ui. Built with
  `base: "./"` so the same bundle works from `views://` (desktop) and `/`
  (server). API base resolution is in `src/lib/api.ts`: same-origin normally,
  `localhost:<apiPort>` when served from a `views://` origin.
- `apps/server` — hosted mode: API + static serving of `apps/web/dist` with SPA
  fallback. Port 4747 (matches the Vite dev proxy).
- `apps/desktop` — Electrobun shell: starts the embedded API (4747, falls back
  to a random port passed via `?apiPort=`), loads Vite dev server when running
  and reachable, else the bundled `views://mainview/index.html`.

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
  `~/Calibre Library`).
- Calibre stores ratings 0–10; core halves them to 0–5 stars.
- TypeScript 7 (tsgo): no `baseUrl`, and `types` must be listed explicitly per
  workspace tsconfig.
