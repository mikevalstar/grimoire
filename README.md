# Grimoire Books

A better way to organize and browse your books. Grimoire is a UI over your
[Calibre](https://calibre-ebook.com/) library that runs as a native desktop app
(Electrobun), a self-hosted web server, or a local web app — all from the same
codebase.

**Current state:** read-only browsing of an existing Calibre library. Calibre
stays the source of truth; the long-term vision is to grow Grimoire until it can
replace Calibre as the backend entirely.

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
