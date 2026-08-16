---
type: adr
title: GitHub Actions and GHCR for build and release automation
description: GitHub Actions verifies every change, packages native Electrobun builds, publishes OCI images to GHCR, and turns version tags into GitHub Releases.
tags: [architecture, ci, release, packaging, docker, github]
status: stable
generated: { by: okq/0.8.0, at: 2026-08-16 }
---

# GitHub Actions and GHCR for build and release automation

## Status

Accepted.

## Context

Grimoire has three delivery targets but no reproducible path from a commit to a
downloadable build. Desktop bundles are host-specific, the hosted app needs the
Vite UI and Bun API assembled together, and release notes need to stay tied to
the exact source revision that produced the artifacts.

Building these by hand makes it easy to ship a desktop archive from one commit,
a container from another, or to skip the checks used during development. It
also leaves users without a predictable place to find downloads or deployment
instructions.

## Decision

Use GitHub Actions as the build and release coordinator. Pull requests, pushes
to `main`, and manual runs execute linting, typechecking, documentation checks,
the web/server build, native Electrobun builds, and a Docker Buildx build.

Desktop builds run on their target operating systems. Linux x64, Windows x64,
macOS x64, and macOS arm64 each produce one named ZIP containing Electrobun's
native distribution artifacts. CI ZIPs are retained as workflow artifacts for
14 days.

The hosted application is a multi-stage OCI image. Its runtime layer contains a
bundled Bun server, the built web UI, and a persistent `/data` volume; source,
development dependencies, and build tools stay in the build layer. Images from
`main` and semantic `vX.Y.Z` tags are published to GitHub Container Registry
under the repository name for both amd64 and arm64.

A semantic version tag is the immutable release boundary. After every build
succeeds, its four desktop ZIPs are attached to a GitHub Release. GitHub's
generated release notes are categorized by pull request labels using
`.github/release.yml`. The tag version is injected into Electrobun metadata so
the binary and release agree even though workspace package versions remain
pre-release development metadata.

Dependabot checks the Bun workspace, GitHub Actions, and Docker base images
weekly. Minor and patch updates are grouped per ecosystem to limit pull request
noise; major upgrades remain separate so their migration and compatibility
costs are visible. Dependabot's default `dependencies` and ecosystem labels
feed dependency changes into the generated release-note categories.

See [Cut a release](../workflows/cut-a-release.md) for the operator flow and
[ADR 0003](0003-electrobun-for-the-desktop-shell.md) for the desktop runtime.

## Consequences

Every downloadable artifact and container now comes from one tagged, verified
commit, and pull requests exercise the same packaging paths before release.
GHCR uses the built-in `GITHUB_TOKEN`, so no long-lived registry credential is
required. A failed job prevents the release from being created.

Routine dependency updates now arrive as tested pull requests instead of
depending on maintainers to notice new releases. Grouping keeps routine churn
manageable, while major versions still require individual review.

Native desktop packaging consumes four hosted runners and is slower than the
web-only checks. The initial desktop artifacts are intentionally unsigned and
unnotarized, so operating systems may show trust warnings; signing can be added
inside the existing desktop jobs once certificates and secret-handling policy
exist. Electrobun delta updates remain disabled because GitHub Release assets
do not provide the stable flat update URL that feature expects.
