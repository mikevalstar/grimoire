#!/bin/sh
# The container runs as the unprivileged `bun` user (uid 1000) and the API opens
# grimoire.db as soon as it starts, so an unwritable /data is a crash loop, not a
# degraded first request. A bind mount keeps the *host* directory's ownership —
# usually root's — which is exactly the case this catches. Say what is wrong and
# which uid needs the directory, instead of letting SQLite throw.
set -e

DATA_DIR="${GRIMOIRE_DATA_DIR:-/data}"

if ! mkdir -p "$DATA_DIR" 2>/dev/null || [ ! -w "$DATA_DIR" ]; then
  cat >&2 <<EOF
Grimoire can't write to its data directory: $DATA_DIR
It is running as uid $(id -u), gid $(id -g).

If you bind-mounted a host directory (-v /srv/grimoire:/data), the mount keeps
that directory's ownership. Give it to Grimoire's uid on the host:

    sudo chown -R $(id -u):$(id -g) /srv/grimoire

Or use a named volume (-v grimoire-data:/data), which Docker creates with the
right ownership for you.
EOF
  exit 1
fi

exec "$@"
