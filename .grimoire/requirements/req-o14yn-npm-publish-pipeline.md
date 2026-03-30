---
id: "req-o14yn-npm-publish-pipeline"
uid: "o14yn"
title: "npm Publish Pipeline"
type: "requirement"
status: "draft"
priority: "high"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - phase-5
  - release
  - ci
feature: "feat-ctlqq-production-readiness-v1-0"
tasks: []
depends_on: []
---

# npm Publish Pipeline

## Description

Reliable, repeatable process for publishing @grimoire-ai/core, @grimoire-ai/server, and @grimoire-ai/cli to npm.

## Acceptance Criteria

- Version bump coordinated across all three packages
- Build step produces correct dist artifacts for all packages
- Publish script or CI job that builds, tests, and publishes in order (core → server → cli)
- Smoke test: npx @grimoire-ai/cli --version works after publish
- Changelog generated or updated with each release
- Git tag created for each release (e.g., v1.0.0)
- Pre-publish checklist documented

## Implementation Notes

- Current publish process exists (see /publish skill) — formalize and harden it
- Consider GitHub Actions workflow for automated releases
- Ensure workspace dependencies resolve correctly in published packages

---

## Comments

---

## Changelog

### 2026-03-30 19:19 | grimoire

Document created.
