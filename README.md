# Grimoire Books

> [!WARNING]
> **Pre-alpha.** The initial feature set is still being built. Schemas, APIs and
> screens change without migration paths or notice, and there is no
> authentication of any kind. Point it at a Calibre library you can afford to
> re-sync, and don't expose it to a network you don't trust.

A better way to organize and browse your books. Grimoire is a UI over your
[Calibre](https://calibre-ebook.com/) library and your
[hardcover.app](https://hardcover.app) shelves that runs as a native desktop app
(Electrobun), a self-hosted web server, or a local web app — all from the same
codebase.

## Sources

Grimoire keeps its own SQLite database and syncs into it, rather than reading a
source live on every screen.

- **Calibre** — a running [content server](#requirements) is mirrored into
  `grimoire.db`, covers and all, and every library screen reads from there
  ([ADR 0011](docs/adrs/0011-sync-calibre-into-grimoire-db-and-read-the-library-from-there.md)).
  Calibre is still the source of truth for the *files* and is never written to;
  the long-term vision is to grow Grimoire until it can replace it as the
  backend entirely.
- **Hardcover** — the half Calibre has no idea about: what you've read, are
  reading, and want to read, plus editions, series and covers. Each reader links
  **their own** account with a personal API token, because a token *is* an
  account and the reading history behind it is theirs
  ([ADR 0012](docs/adrs/0012-hardcover-as-a-second-source-with-per-reader-tokens.md)).
  Tokens live server-side only — the browser never holds one, and Hardcover's
  GraphQL API refuses browser calls anyway.

A book you own in Calibre *and* track on Hardcover stays as two rows and renders
as one card: [book matching](docs/features/book-matching.md) groups them under a
`works` row ([ADR 0013](docs/adrs/0013-group-duplicate-books-into-works.md)), and
you can confirm or split a match by hand from the book's details flyout.

Grimoire supports several readers with no login between them
([ADR 0008](docs/adrs/0008-multiple-users-without-authentication.md)) — it
assumes a household, not the open internet.

## Layout

```
apps/
  web/       React + Vite + Tailwind 4 + shadcn/ui + TanStack Router/Query — the
             UI, shared by every mode; Storybook for the components
  server/    Standalone Bun server: serves the API + built web UI (hosted mode)
  desktop/   Electrobun shell: embeds the API and loads the same UI natively
packages/
  core/      grimoire.db (Grimoire's own SQLite store) + shared Zod schemas
  api/       Hono app defining the HTTP API, embedded by server and desktop
docs/        OKF 0.2 knowledge bundle: adrs/ · features/ · workflows/ · external/
```

Every deployment mode speaks the same HTTP API (`/api/...`), so the UI doesn't
care where it's running.

## Requirements

- [Bun](https://bun.sh) ≥ 1.3
- A **running Calibre content server** — all library data comes from it, over
  HTTP. Start it with `calibre-server`, or from calibre's Preferences →
  Sharing over the net. Grimoire assumes `http://localhost:8080` until you set
  a URL during first-run setup.
- *Optional:* a **hardcover.app API token** per reader who wants their shelves
  in, from [your Hardcover account settings](https://hardcover.app/account/api).
  Paste it under Settings → Readers and test it before saving. Tokens expire
  after a year.

## Development

```bash
bun install

# Web development: Vite dev server on :4746 (HMR) + API server on :4747
bun dev

# Desktop development: Vite HMR + Electrobun app window
bun run dev:desktop

# Component workshop on :4748
bun run storybook
```

## Building / running for real

```bash
# Hosted mode: build the UI, then run the server (PORT to override :4747)
bun run build:web
bun run start:server

# Desktop app bundle
bun run build:desktop
```

## Other commands

```bash
bun run typecheck                  # typecheck every workspace
bun run docs:check                 # validate the docs/ OKF bundle (needs okq)
cd apps/web && bunx shadcn@latest add <component>   # add shadcn/ui components
```
