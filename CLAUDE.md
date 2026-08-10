# Grimoire Books

UI for browsing/organizing a Calibre ebook library. Ships as an Electrobun
desktop app, a self-hosted server, and a local web app from one codebase.
Read-only against Calibre for now — Calibre remains the source of truth;
replacing it as the backend is the long-term goal.

## Architecture

Bun workspaces monorepo. The rule that keeps it coherent: **every mode speaks
the same HTTP API**.

Library data comes from a **running Calibre content server**, over HTTP, via
the `/api/cs` proxy. Grimoire does not open `metadata.db` — see
[ADR 0005](docs/adrs/0005-calibre-content-server-as-the-data-source.md).

- `packages/core` — `SettingsStore`, Grimoire's *own* writable SQLite db
  (`grimoire.db` in the data dir — see Gotchas). Two browser-safe modules that
  must never import bun-only code: `src/schemas.ts` (Zod schemas for every API
  payload, `@grimoire/core/schemas`) and `src/types.ts` (constants,
  `@grimoire/core/types`).
- `packages/api` — `createApi()` returns the Hono app (`/api/...` routes).
  Embedded by both server and desktop. Reverse-proxies the running
  Calibre content server at `/api/cs/*` — e.g. `/api/cs/ajax/search`,
  `/api/cs/ajax/books`. The proxy target is resolved *per request* from the
  `calibre.serverUrl` preference (falling back to `CALIBRE_SERVER`, then
  `http://localhost:8080`), so saving it in the UI takes effect without a
  restart. `GET|PUT /api/preferences` read/merge-write the key/value store;
  `POST /api/calibre/test` probes a candidate content server URL server-side
  (no CORS involved) and reports its book count.
- `apps/web` — React 19 + Vite + Tailwind 4 + shadcn/ui, TanStack Router and
  Query, Storybook. Built with `base: "./"` so the same bundle works from
  `views://` (desktop) and `/` (server). API base resolution is in
  `src/lib/api.ts`: same-origin normally, `localhost:<apiPort>` when served
  from a `views://` origin.
- `apps/server` — hosted mode: API + static serving of `apps/web/dist` with SPA
  fallback. Port 4747 (matches the Vite dev proxy).
- `apps/desktop` — Electrobun shell: starts the embedded API (4747, falls back
  to a random port passed via `?apiPort=`), loads Vite dev server when running
  and reachable, else the bundled `views://mainview/index.html`.

## Documentation-first (OKF)

`docs/` is an [Open Knowledge Format 0.2](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)
([local copy](docs/external/okf-spec-0.2.md))
bundle — Markdown + YAML frontmatter, one concept per file — maintained with
[okq](https://github.com/mikevalstar/okq). **Before implementing a feature or
making an architectural choice, write (or update) the relevant doc:**

- New tech/library/architecture choice → ADR: `okq --bundle docs new adr "<title>"`
- New user-visible capability → spec: `okq --bundle docs new feature "<title>"`
- New end-to-end operator flow → `docs/workflows/` (copy an existing one; no
  okq template yet)

Rules:

- All docs carry YAML frontmatter (`type`, `title`, `description`, `tags`,
  `status`) — never omit it. Cross-link related docs so the graph stays
  connected.
- ADRs are numbered and immutable: supersede, don't rewrite.
- `docs/external/` holds verbatim snapshots of specs owned elsewhere — don't
  edit the bodies; re-snapshot and bump `retrieved`.
- Read the bundle with okq rather than grep — `okq --bundle docs search
  "<topic>"`, `okq --bundle docs find --type adr`, `okq --bundle docs stats`.
- After adding/renaming docs run `okq --bundle docs index`, then verify with
  `bun run docs:check` (validate + deadlinks + lint) before committing.

## Notes

### Designs
1. we are working off the design idea here (as a general approach, not everything weill be kept) /Users/mikevalstar/projects/grim-ideas/src/designs/d08-latitude
2. We will use and re-style chadcn components as needed to meet the design (install using th eshadcn cli commands)
3. all New common components should be added to the storybook

## Commands

- `bun dev` — web dev (Vite :4746 + API :4747; "GRIM" on a phone keypad)
- `bun run dev:desktop` — desktop dev with HMR
- `bun run storybook` — component workshop on :4748
- `bun run typecheck` — all workspaces (tsc, TypeScript 7)
- `bun run build:web` / `build:desktop` / `build:storybook` / `start:server`
- `bun run docs:check` — validate the `docs/` OKF bundle (needs `okq` on PATH)
- shadcn components: `cd apps/web && bunx shadcn@latest add <name>`

## Gotchas

- Electrobun 1.18 exports raw `.ts` sources; `apps/desktop/tsconfig.json` needs
  DOM lib + `@types/three` to typecheck them. Imports come from
  `electrobun/bun`, config type is `build.bun.entrypoint` in
  `electrobun.config.ts`.
- `GRIMOIRE_DATA_DIR` overrides where `grimoire.db` and cached assets live
  (default `~/.config/grimoire` on Linux and macOS, `~/Documents/Grimoire` on
  Windows — [ADR 0007](docs/adrs/0007-user-data-and-asset-storage-location.md)).
  Point it at a temp dir to exercise first-run setup without clobbering real
  preferences. `CALIBRE_SERVER` is the fallback content server URL before one
  is saved in preferences.
- Every API payload has a Zod schema in `packages/core/src/schemas.ts` — the
  API validates requests with `zValidator`, the client parses responses with
  the same schema, and types are `z.infer`, never hand-written
  ([ADR 0009](docs/adrs/0009-zod-schemas-shared-between-api-and-client.md)).
  Schemas stay non-strict so unmodelled fields pass through.
- Routes are file-based in `apps/web/src/routes`; `routeTree.gen.ts` is
  generated by the Vite plugin and committed, so `typecheck` works without a
  build. The desktop build routes in the URL fragment (no server to answer a
  deep link from `views://`) — see `src/router.tsx`.
- Stories live next to their component (`button.stories.tsx`), not in a
  `stories/` folder.
- First-run setup is driven by the `preferences.version` row: it seeds to `"0"`,
  and the web app shows the setup modal while it's below `PREFERENCES_VERSION`
  (`packages/core/src/types.ts`). Bump that constant to force users through a
  new round of setup; keep new prompts in `apps/web/src/components/setup-dialog.tsx`.
- TypeScript 7 (tsgo): no `baseUrl`, and `types` must be listed explicitly per
  workspace tsconfig.
