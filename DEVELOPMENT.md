# Development

## Prerequisites

- Node.js >= 22.12.0
- [Vite+](https://vite.dev/) (`vp` CLI)

## Setup

```bash
vp install
```

## Run the CLI locally

Use the workspace scripts so the CLI is built through Vite+ rather than calling `tsdown` directly:

```bash
vp run grimoire -- --help
vp run grimoire -- init
```

Or run the CLI package watcher directly:

```bash
vp run grimoire-ai#dev
```

## Seed test data

Create a `.g-test/` directory with sample features, requirements, tasks, and decisions for local testing:

```bash
./scripts/seed-test.sh
```

This builds the CLI, removes any existing `.g-test/`, and populates it with realistic sample documents. Then you can test commands against it:

```bash
vp run grimoire -- feature list --cwd .g-test
vp run grimoire -- task list --status todo --cwd .g-test
```

## Commands

- **Format:** `vp fmt`
- **Lint and type-check:** `vp check`
- **Run tests:** `vp test`
- **Run tests with coverage:** `vp run test:coverage`
- **Build:** `vp run build`
- **Full validation:** `vp run ready`

The root check is expected to pass before a package build; the CLI resolves the core workspace package from source for type-checking in CI.

Each tested package writes its own coverage report to a local `coverage/` directory (e.g., `apps/cli/coverage/`, `packages/core/coverage/`).
