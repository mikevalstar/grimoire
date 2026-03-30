---
name: publish
metadata:
  internal: true
description: >
  Publish @grimoire-ai/core, @grimoire-ai/server, and @grimoire-ai/cli to npm. Use this skill whenever the user
  says "publish", "release", "bump version", "npm publish", or wants to cut a new version
  of the grimoire packages. Handles version bumping, committing, pushing, and tells the
  user the manual publish commands.
---

# Publish Grimoire Packages

This skill bumps versions, commits, pushes, and then tells the user the three commands to run manually (publish requires npm auth that the agent may not have).

## Accepted input

The user provides either:

- A bump type: `patch`, `minor`, or `major`
- An explicit version string like `0.2.0`

If they don't specify, ask which bump type they want.

## Steps

### 1. Determine the new version

Read the current version from `packages/core/package.json`. Then compute the new version:

- **patch**: `0.1.1` -> `0.1.2`
- **minor**: `0.1.1` -> `0.2.0`
- **major**: `0.1.1` -> `1.0.0`
- **explicit**: use the version string as-is

### 2. Update version in all five locations

These must all match. Do not skip any of them:

1. `packages/core/package.json` — the `"version"` field
2. `packages/server/package.json` — the `"version"` field
3. `apps/cli/package.json` — the `"version"` field
4. `packages/core/src/index.ts` — find `export const VERSION = "..."` and replace the string literal with the new version. This is the version reported by `grimoire --version`, so it must stay in sync.
5. `packages/core/tests/index.test.ts` — find the `toBe("...")` assertions for `VERSION` and `getVersion()` and update both to the new version string. This test validates the version constant matches expectations.

### 3. Build

Run `vp run -r build` to make sure everything compiles cleanly with the new version. This builds core, server, the website SPA, and the CLI in dependency order. The website build output is bundled into the CLI for `grimoire ui` static serving.

### 4. Commit and push

Stage the changed files and commit with:

```
chore: bump version to <new-version>
```

Then push to the remote.

### 5. Tell the user to publish

After pushing, tell the user to run these three commands in order (core first, then server, then CLI — each depends on the previous):

```bash
cd packages/core && pnpm publish --access public --no-git-checks
```

```bash
cd packages/server && pnpm publish --access public --no-git-checks
```

```bash
cd apps/cli && pnpm publish --access public --no-git-checks
```

Remind them that `pnpm publish` (not `npm publish`) is required because it resolves `workspace:*` and `catalog:` protocols to real version numbers.

### 6. After successful publish

Once the user confirms all packages published successfully, create a git tag and a GitHub release:

```bash
git tag v<new-version>
git push origin v<new-version>
gh release create v<new-version> --generate-notes
```
