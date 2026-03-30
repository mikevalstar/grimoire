---
id: "req-qq0d6-react-vite-spa-scaffold"
uid: "qq0d6"
title: "React + Vite SPA Scaffold"
type: "requirement"
status: "done"
priority: "high"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - react
  - vite
  - frontend
feature: "feat-fv5ft-web-ui"
tasks: []
depends_on: []
---

# React + Vite SPA Scaffold

## Description

Set up the React single-page application with routing and data fetching infrastructure.

## Acceptance Criteria

- React 19 + TypeScript setup with Vite
- TanStack Router for file-based client-side routing
- TanStack Query for async data fetching and caching
- API client utilities with TypeScript interfaces
- Dev server with proxy to backend API at :4444
- Production build outputs to dist/ for static serving
- Root layout with navigation header

## Implementation Notes

- SPA lives at apps/website/
- Uses Vite+ (vp) toolchain for build and dev
- Dev proxy configured in vite.config.ts

---

## Comments

---

## Changelog

### 2026-03-30 07:42 | grimoire

Document created.
