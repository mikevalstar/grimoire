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

Build and run:

```bash
cd apps/cli
npx tsdown src/index.ts --format esm --out-dir dist
node dist/index.mjs --help
node dist/index.mjs init
```

Or use the dev watcher:

```bash
cd apps/cli
npx tsdown src/index.ts --format esm --out-dir dist --watch
```

### Other commands

- Check everything is ready:

```bash
vp run ready
```

- Run the tests:

```bash
vp run test -r
```

- Build the monorepo:

```bash
vp run build -r
```
