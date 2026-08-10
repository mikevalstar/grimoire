---
type: adr
title: Electrobun for the desktop shell
description: The desktop build uses Electrobun — a Bun-native shell over the system webview — rather than Electron or Tauri.
tags: [architecture, desktop, tooling]
status: stable
generated: { by: okq/0.8.0, at: 2026-08-10 }
---

# Electrobun for the desktop shell

## Status

Accepted.

## Context

The project is a Bun workspaces monorepo, and the API is Bun code
([ADR 0002](0002-one-http-api-three-delivery-targets.md)). The desktop shell
needs to run that API in-process and point a webview at it. Electron would mean
a second runtime (Node) and a bundled Chromium; Tauri would mean Rust in a
codebase that is otherwise TypeScript end to end.

## Decision

Use Electrobun. It runs Bun as the main process and the system webview for
rendering, so the embedded API is the same code the server runs, launched
directly rather than shelled out to.

The shell starts the API on 4747, falling back to a random port handed to the
webview as `?apiPort=`. It loads the Vite dev server when one is reachable and
the bundled `views://mainview/index.html` otherwise.

## Consequences

One runtime, one language, and a small binary. In exchange we take on a young
project: Electrobun 1.18 ships raw `.ts` sources, so `apps/desktop` needs DOM
lib and `@types/three` just to typecheck its dependencies. Rendering follows the
host webview, so cross-platform CSS differences are ours to absorb.

Because the frontend only ever speaks HTTP, swapping this shell later is
contained to `apps/desktop`.
