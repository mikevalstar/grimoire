---
type: workflow
title: Cut a release
description: Tag a verified commit to publish desktop ZIPs, a multi-architecture container image, and categorized GitHub release notes.
tags: [release, ci, desktop, docker, github]
status: stable
generated: { by: codex, at: 2026-08-16 }
---

# Cut a release

## When to use

Use this flow when a commit on `main` is ready to become a public Grimoire
release. Releases use semantic tags such as `v0.1.0`. The tag controls the
desktop application version, the GHCR image tags, and the GitHub Release.

Desktop outputs are currently unsigned and unnotarized. Do not describe them as
signed builds until certificate-backed signing is added to CI.

## Steps

1. Merge the intended changes to `main` and wait for the **Build and release**
   workflow to pass on that commit. Pull requests only build the `linux-x64`
   desktop target, so this is the first run that proves Windows and macOS still
   package — treat a failure here as a blocker, not a flake
   ([`ci-release.yml`](../../.github/workflows/ci-release.yml)).
2. Ensure merged pull requests have one useful changelog label: `feature` or
   `enhancement`, `bug` or `fix`, `documentation`, `chore`, `dependencies`, or
   `breaking-change`. Use `skip-changelog` only for changes readers should not
   see. Unmatched changes appear under **Other changes**.
3. Create and push an annotated semantic version tag from the verified commit:

       git switch main
       git pull --ff-only
       git tag -a v0.1.0 -m "Grimoire Books v0.1.0"
       git push origin v0.1.0

4. Wait for all four desktop matrix jobs, the quality job, and the container
   job to pass. The release job runs only after all of them succeed.
5. Review the generated GitHub Release notes. Edit prose in GitHub if a short
   introduction, migration warning, or known-issues section would help users.

## Verify

- The GitHub Release for the tag has ZIPs for `linux-x64`, `windows-x64`,
  `macos-x64`, and `macos-arm64`.
- `ghcr.io/mikevalstar/grimoire:<version>` and `:latest` have both `linux/amd64`
  and `linux/arm64` manifests.
- Extract one relevant desktop ZIP and confirm it contains Electrobun's native
  installer artifacts.
- Start the container with a persistent data directory and a reachable Calibre
  content server:

      docker run --rm -p 4747:4747 \
        -v grimoire-data:/data \
        -e CALIBRE_SERVER=http://host.docker.internal:8080 \
        ghcr.io/mikevalstar/grimoire:0.1.0

  On Linux, add `--add-host=host.docker.internal:host-gateway` when Calibre runs
  on the Docker host.

- Repeat with a **bind mount**, which is what most self-hosters use. The image
  runs as uid 1000 and never as root, so the host directory has to be owned by
  it — a root-owned one is refused by
  [`scripts/docker-entrypoint.sh`](../../scripts/docker-entrypoint.sh) with a
  message naming the directory and the uid, rather than crash-looping on an
  opaque SQLite error:

      sudo mkdir -p /srv/grimoire && sudo chown -R 1000:1000 /srv/grimoire
      docker run --rm -p 4747:4747 -v /srv/grimoire:/data \
        ghcr.io/mikevalstar/grimoire:0.1.0

- `docker inspect --format '{{.State.Health.Status}}' <container>` reports
  `healthy`. The healthcheck fetches `/api/preferences`, which reads
  `grimoire.db` — `/` would answer from static files with a broken database
  behind it.
