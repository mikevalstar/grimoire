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

### Other commands

- Format the repo:

```bash
vp run fmt
```

- Lint and type-check the repo:

```bash
vp run check
```

- Run package tests:

```bash
vp run test
```

- Build the monorepo:

```bash
vp run build
```

- Run the full local validation flow:

```bash
vp run ready
```
