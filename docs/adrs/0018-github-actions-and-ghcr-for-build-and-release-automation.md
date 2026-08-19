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
Vite UI and Bun API assembled together, and release notes have to stay tied to
the exact source revision that produced the artifacts.

Building these by hand makes it easy to ship a desktop archive from one commit
and a container from another, or to skip the checks we run during development.
It also leaves users without a predictable place to find downloads or
deployment instructions.

## Decision

Use GitHub Actions as the build and release coordinator. Pull requests, pushes
to `main`, and manual runs all run linting, typechecking, documentation checks,
the web/server build, native Electrobun builds, and a Docker Buildx build.

Desktop builds run on their target operating systems. Linux x64, Windows x64,
macOS x64, and macOS arm64 each produce one named ZIP containing Electrobun's
native distribution artifacts. GitHub keeps CI ZIPs as workflow artifacts for
14 days.

The hosted application is a multi-stage OCI image. Its runtime layer holds a
bundled Bun server, the built web UI, and a persistent `/data` volume. Source,
development dependencies, and build tools stay in the build layer. The workflow
publishes images from `main` and from semantic `vX.Y.Z` tags to GitHub
Container Registry under the repository name, for both amd64 and arm64.

A semantic version tag is the immutable release boundary. Once every build
succeeds, the workflow attaches its four desktop ZIPs to a GitHub Release.
`.github/release.yml` sorts GitHub's generated release notes into categories by
pull request label. The workflow also injects the tag version into Electrobun
metadata, so the binary and the release agree even though workspace package
versions stay at pre-release development values.

Dependabot checks the Bun workspace, GitHub Actions, and Docker base images
weekly. Grouping minor and patch updates per ecosystem keeps pull request noise
down. Major upgrades stay separate so their migration and compatibility costs
are visible. Dependabot's default `dependencies` and ecosystem labels feed
dependency changes into the generated release-note categories.

See [Cut a release](../workflows/cut-a-release.md) for the operator flow and
[ADR 0003](0003-electrobun-for-the-desktop-shell.md) for the desktop runtime.

## Consequences

Every downloadable artifact and container now comes from one tagged, verified
commit, and pull requests run the same packaging steps before release. GHCR
uses the built-in `GITHUB_TOKEN`, so there is no long-lived registry credential
to store. A failed job stops the release from being created.

Routine dependency updates now arrive as tested pull requests instead of
waiting for a maintainer to notice a new release. Grouping keeps the routine
churn manageable, and major versions still get individual review.

Native desktop packaging uses four hosted runners and takes longer than the
web-only checks. The first desktop artifacts ship unsigned and unnotarized on
purpose, so operating systems may warn about them. Signing fits inside the
existing desktop jobs once we have certificates and a secret-handling policy.
Electrobun delta updates stay disabled because GitHub Release assets do not
provide the stable flat update URL that feature expects.
