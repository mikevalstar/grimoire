# Architecture Decision Records

Numbered records of significant, hard-to-reverse decisions. List them:

    okq find --type adr

Add one with `okq new adr "<title>"`.

<!-- okq:index:begin -->
### Concepts

| Title | File |
|-------|------|
| Record architecture decisions | [0001-record-architecture-decisions.md](0001-record-architecture-decisions.md) |
| One HTTP API, three delivery targets | [0002-one-http-api-three-delivery-targets.md](0002-one-http-api-three-delivery-targets.md) |
| Electrobun for the desktop shell | [0003-electrobun-for-the-desktop-shell.md](0003-electrobun-for-the-desktop-shell.md) |
| Frontend stack: React, shadcn/ui, TanStack Router and Query, Storybook | [0004-frontend-stack-react-shadcn-ui-tanstack-router-and-query-storybook.md](0004-frontend-stack-react-shadcn-ui-tanstack-router-and-query-storybook.md) |
| Calibre content server as the data source | [0005-calibre-content-server-as-the-data-source.md](0005-calibre-content-server-as-the-data-source.md) |
| Grimoire-owned SQLite for supplemental data | [0006-grimoire-owned-sqlite-for-supplemental-data.md](0006-grimoire-owned-sqlite-for-supplemental-data.md) |
| User data and asset storage location | [0007-user-data-and-asset-storage-location.md](0007-user-data-and-asset-storage-location.md) |
| Multiple users without authentication | [0008-multiple-users-without-authentication.md](0008-multiple-users-without-authentication.md) |
| Zod schemas shared between API and client | [0009-zod-schemas-shared-between-api-and-client.md](0009-zod-schemas-shared-between-api-and-client.md) |
| Biome for linting and formatting | [0010-biome-for-linting-and-formatting.md](0010-biome-for-linting-and-formatting.md) |
| Sync Calibre into grimoire.db and read the library from there | [0011-sync-calibre-into-grimoire-db-and-read-the-library-from-there.md](0011-sync-calibre-into-grimoire-db-and-read-the-library-from-there.md) |
| Hardcover as a second source, with per-reader tokens | [0012-hardcover-as-a-second-source-with-per-reader-tokens.md](0012-hardcover-as-a-second-source-with-per-reader-tokens.md) |
| Group duplicate books into works | [0013-group-duplicate-books-into-works.md](0013-group-duplicate-books-into-works.md) |
| Per-reader rating source with Hardcover write-back | [0014-per-reader-rating-source-with-hardcover-write-back.md](0014-per-reader-rating-source-with-hardcover-write-back.md) |
| Virtualize library views with TanStack Virtual | [0015-virtualize-library-views-with-tanstack-virtual.md](0015-virtualize-library-views-with-tanstack-virtual.md) |
| react-tooltip for hover affordances | [0016-react-tooltip-for-hover-affordances.md](0016-react-tooltip-for-hover-affordances.md) |
| Decode WebP covers with a WASM codec | [0017-decode-webp-covers-with-a-wasm-codec.md](0017-decode-webp-covers-with-a-wasm-codec.md) |
| GitHub Actions and GHCR for build and release automation | [0018-github-actions-and-ghcr-for-build-and-release-automation.md](0018-github-actions-and-ghcr-for-build-and-release-automation.md) |
| Series as records with a primary per work | [0019-series-as-records-with-a-primary-per-work.md](0019-series-as-records-with-a-primary-per-work.md) |
| Library view state lives in the URL | [0020-library-view-state-lives-in-the-url.md](0020-library-view-state-lives-in-the-url.md) |
<!-- okq:index:end -->
