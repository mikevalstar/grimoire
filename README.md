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
  web/       React + Vite + Tailwind 4 + shadcn/ui — the UI, shared by every mode
  server/    Standalone Bun server: serves the API + built web UI (hosted mode)
  desktop/   Electrobun shell: embeds the API and loads the same UI natively
packages/
  core/      Calibre library access — read-only bun:sqlite over metadata.db
  api/       Hono app defining the HTTP API, embedded by server and desktop
```

Every deployment mode speaks the same HTTP API (`/api/...`), so the UI doesn't
care where it's running.

## Requirements

- [Bun](https://bun.sh) ≥ 1.3
- A Calibre library. Grimoire looks in `~/Calibre Library` by default; point it
  elsewhere with `CALIBRE_LIBRARY=/path/to/library`.

## Development

```bash
bun install

# Web development: Vite dev server on :5173 (HMR) + API server on :3001
bun dev

# Desktop development: Vite HMR + Electrobun app window
bun run dev:desktop
```

## Building / running for real

```bash
# Hosted mode: build the UI, then run the server (PORT to override :3001)
bun run build:web
bun run start:server

# Desktop app bundle
bun run build:desktop
```

## Other commands

```bash
bun run typecheck                  # typecheck every workspace
cd apps/web && bunx shadcn@latest add <component>   # add shadcn/ui components
```
