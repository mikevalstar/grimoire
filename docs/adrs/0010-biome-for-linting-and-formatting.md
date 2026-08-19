---
type: adr
title: Biome for linting and formatting
description: Biome is the single linter and formatter for the whole monorepo, replacing an ESLint + Prettier pair we never installed.
tags: [architecture, tooling, dx]
status: stable
generated: { by: okq/0.8.0, at: 2026-08-11 }
---

# Biome for linting and formatting

## Status

Accepted.

## Context

The repo had no linter and no formatter. Style held together because one person
wrote it in one sitting; `bun run typecheck` was the only automated gate, and it
says nothing about unused variables in an inline script, array-index keys in
React, or import order. Every file was already Prettier-shaped (two-space
indent, double quotes, semicolons, trailing commas). The convention existed,
nothing enforced it.

The monorepo spans five workspaces and four languages Biome understands
(TS/TSX, JSON, CSS, HTML), plus generated files it must skip:
`routeTree.gen.ts` from the TanStack Router plugin
([ADR 0004](0004-frontend-stack-react-shadcn-ui-tanstack-router-and-query-storybook.md)),
`apps/desktop/build/`, and the verbatim spec snapshots in `docs/external/`.

The obvious alternative is ESLint + Prettier: more rules, more plugins, more
community knowledge. It is also two tools, two configs, a plugin per framework,
and typescript-eslint's type-aware pass, which costs seconds per run in a repo
where everything else is Bun-fast.

## Decision

[Biome](https://biomejs.dev) 2.x is the one linter and formatter, configured
once in `biome.json` at the root and run from the root for all workspaces.

- **Formatter settings match the code that already existed.** 2-space indent,
  double quotes, semicolons, trailing commas, `lineWidth: 100`. Adopting it was
  a reformat, not a restyle.
- **The recommended preset, with one rule off.** We disable
  `style/noNonNullAssertion`: `document.getElementById("root")!` and
  modular-arithmetic array indexing are deliberate here, and the rule fires on
  nothing else.
- **Suppress genuine exceptions at the line, with a reason.**
  `useSemanticElements` on the colour picker's ARIA radio group and
  `noArrayIndexKey` on a Storybook filler list carry `// biome-ignore` comments
  explaining why. Unused suppressions are themselves a diagnostic, so a stale
  one turns up as its own error.
- **Import organisation is on** as an assist action, so Biome sorts every
  import block the same way.
- **`vcs.useIgnoreFile` is on**, so `.gitignore` is the single list of things
  not to touch. `files.includes` only adds what git tracks but tools generate.
- **Tailwind directives are enabled in the CSS parser**, because `@theme`,
  `@layer`, and `@apply` in `apps/web/src/index.css` are not valid CSS on their
  own.

Scripts: `bun run lint` (check, no writes, the CI-shaped one), `bun run
lint:fix` (safe fixes plus formatting), `bun run format` (formatting only).

## Consequences

One tool, one config, one binary in `devDependencies`; a full check across the
monorepo runs in tens of milliseconds, so it fits in front of every commit.
Formatting stops being a review topic.

The cost is rule coverage: Biome's catalogue is smaller than ESLint's, and
plugins that exist for ESLint (Storybook, TanStack Query, jsx-a11y's long tail)
have no Biome equivalent. If one of those turns out to catch something real, we
add ESLint alongside Biome for that narrow purpose. Biome keeps the formatting
either way.

The adoption commit reformats most of the tree, so `git blame` needs
`--ignore-rev` to see through it.
