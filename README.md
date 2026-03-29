# Grimoire AI

Local-first, AI-native requirements management CLI tool.

## Development

### Prerequisites

- Node.js >= 22.12.0
- [Vite+](https://vite.dev/) (`vp` CLI)

### Setup

```bash
vp install
```

### Run the CLI locally

Use the workspace scripts so the CLI is built through Vite+ rather than calling `tsdown` directly:

```bash
vp run grimoire -- --help
vp run grimoire -- init
```

Or run the CLI package watcher directly:

```bash
vp run grimoire-ai#dev
```

### Seed test data

Create a `.g-test/` directory with sample features, requirements, tasks, and decisions for local testing:

```bash
./scripts/seed-test.sh
```

This builds the CLI, removes any existing `.g-test/`, and populates it with realistic sample documents. Then you can test commands against it:

```bash
vp run grimoire -- feature list --cwd .g-test
vp run grimoire -- task list --status todo --cwd .g-test
```

### Other commands

- Format the repo:

```bash
vp fmt
```

- Lint and type-check the repo:

```bash
vp check
```

The root check is expected to pass before a package build; the CLI resolves the core workspace package from source for type-checking in CI.

- Run package tests:

```bash
vp test
```

- Run package tests with per-package coverage reports:

```bash
vp run test:coverage
```

Each tested package writes its own report to a local `coverage/` directory such as `apps/cli/coverage/` or `packages/core/coverage/`.

- Build the monorepo:

```bash
vp run build
```

- Run the full local validation flow:

```bash
vp run ready
```
