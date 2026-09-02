# Grimoire Books

UI for browsing/organizing a Calibre ebook library, with hardcover.app shelves
as a second source. Ships as an Electrobun desktop app, a self-hosted server,
and a local web app from one codebase. Read-only against Calibre — it stays the
source of truth for the files; replacing it as the backend is the long-term
goal. Several readers share one instance with no login
([ADR 0008](docs/adrs/0008-multiple-users-without-authentication.md)).

## Architecture

Bun workspaces monorepo. The rule that keeps it coherent: **every mode speaks
the same HTTP API**.

**Grimoire syncs its sources into its own database and every screen reads from
there.** A scheduler mirrors the running Calibre content server (reached only
over HTTP — Grimoire never opens `metadata.db`,
[ADR 0005](docs/adrs/0005-calibre-content-server-as-the-data-source.md)) into
`grimoire.db` and caches covers on disk
([ADR 0011](docs/adrs/0011-sync-calibre-into-grimoire-db-and-read-the-library-from-there.md),
[spec](docs/features/calibre-sync.md)). A second scheduler pulls each linked
reader's Hardcover shelves, with their own API token, kept server-side
([ADR 0012](docs/adrs/0012-hardcover-as-a-second-source-with-per-reader-tokens.md),
[spec](docs/features/hardcover-sync.md)). The `/api/cs` proxy to Calibre
remains for file downloads and for the sync job itself.

A book held by two sources is two `books` rows under one `works` row, grouped
by the matcher ([ADR 0013](docs/adrs/0013-group-duplicate-books-into-works.md),
[spec](docs/features/book-matching.md)). **Every book route speaks work ids.**
Series are records of their own with a primary per work
([ADR 0019](docs/adrs/0019-series-as-records-with-a-primary-per-work.md)).
Ratings and read state are per reader and come from one source each, local or
Hardcover with write-back
([ADR 0014](docs/adrs/0014-per-reader-rating-source-with-hardcover-write-back.md)).

- `packages/core` — Grimoire's *own* writable SQLite db (`grimoire.db` in the
  data dir — see Gotchas). `src/db.ts` owns the schema and every migration.
  One store per concern, all sharing one connection — pass the `Database` from
  `openDatabase()`, don't open a second: `BooksStore` (the shelf, and the
  reconciles from each source), `CalibreBooksStore` and `HardcoverBooksStore`
  (the verbatim mirrors), `WorksStore` (matching, merge, separate),
  `SeriesStore`, `RatingsStore`, `ReadStatesStore`, `UsersStore` (readers and
  their Hardcover link), `SettingsStore` (key/value preferences), `CoverStore`
  (files on disk). `src/matching.ts` is the pure title/author matcher
  (`@grimoire/core/matching`). Two browser-safe modules that must never import
  bun-only code: `src/schemas.ts` (Zod schemas for every API payload,
  `@grimoire/core/schemas`) and `src/types.ts` (constants incl. the 24
  `USER_COLORS`, `@grimoire/core/types`).
- `packages/api` — `createApi()` returns the Hono app (`/api/...` routes) and
  starts both schedulers (`CalibreSync` in `src/sync.ts`, `HardcoverSync` in
  `src/hardcover-sync.ts`); pass `sync: false` to embed it without them.
  Embedded by both server and desktop. Routes in `src/index.ts`: preferences,
  users and their Hardcover link, the library and covers by work id,
  duplicates, series, ratings, read states, sync status and control, and the
  `/api/cs/*` proxy. The proxy target is resolved *per request* from the
  `calibre.serverUrl` preference (falling back to `CALIBRE_SERVER`, then
  `http://localhost:8080`), so saving it in the UI takes effect without a
  restart. User-scoped routes take the reader from the `X-Grimoire-User`
  header (`USER_HEADER`) and refuse without it. `src/hardcover.ts` is the
  only thing that talks to Hardcover's GraphQL API, through a per-token rate
  limiter.
- `apps/web` — React 19 + Vite + Tailwind 4 + shadcn/ui, TanStack Router and
  Query, Storybook. Built with `base: "./"` so the same bundle works from
  `views://` (desktop) and `/` (server). `src/lib/api.ts` holds every fetch
  (same-origin normally, `localhost:<apiPort>` when served from a `views://`
  origin) and `src/lib/queries.ts` every query and mutation. Library view
  state (filter, sort, group, read status) lives in the URL
  ([ADR 0020](docs/adrs/0020-library-view-state-lives-in-the-url.md)).
- `apps/server` — hosted mode: API + static serving of `apps/web/dist` with SPA
  fallback. Port 4747 (matches the Vite dev proxy).
- `apps/desktop` — Electrobun shell: starts the embedded API (4747, falls back
  to a random port passed via `?apiPort=`), loads Vite dev server when running
  and reachable, else the bundled `views://mainview/index.html`. Claims 4747
  first and starts with `sync: false` if it loses, so one `grimoire.db` never
  has two schedulers writing to it.

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
- `bun run test` — `bun test` across the repo; CI gates on it alongside lint and
  typecheck. Tests live next to their subject (`works.test.ts`)
- `bun run lint` — Biome check (lint + format + import order), no writes;
  `lint:fix` applies safe fixes, `format` formats only
- `bun run build:web` / `build:desktop` / `build:storybook` / `start:server`
- `bun run docs:check` — validate the `docs/` OKF bundle (needs `okq` on PATH)
- `bun run db:wipe` — delete `grimoire.db` (+ WAL sidecars) so the next launch
  runs first-time setup again. Honours `GRIMOIRE_DATA_DIR`; never touches Calibre
- shadcn components: `cd apps/web && bunx shadcn@latest add <name>`

## Gotchas

- Biome 2 is the only linter/formatter, configured in `biome.json`
  ([ADR 0010](docs/adrs/0010-biome-for-linting-and-formatting.md)). Two-space
  indent, double quotes, `lineWidth: 100`, recommended preset with
  `noNonNullAssertion` off. `.gitignore` drives exclusions; generated files
  (`routeTree.gen.ts`, `apps/desktop/build/`) and `docs/external/` are added in
  `files.includes`. Suppress a real exception at the line with a one-line
  `// biome-ignore <rule>: <reason>` above the *element*, not the attribute —
  unused suppressions are themselves errors.
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
  and the web app shows the setup wizard while it's below `PREFERENCES_VERSION`
  (`packages/core/src/types.ts`). Bump that constant to force users through a
  new round of setup; keep new prompts in `apps/web/src/components/setup-wizard.tsx`
  and update [the spec](docs/features/first-run-setup-wizard.md) in the same
  commit. `bun run db:wipe` gets you back to a genuine first run.
- TypeScript 7 (tsgo): no `baseUrl`, and `types` must be listed explicitly per
  workspace tsconfig.
