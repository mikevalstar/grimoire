# syntax=docker/dockerfile:1

FROM oven/bun:1.3.14 AS build

WORKDIR /app

COPY package.json bun.lock ./
COPY apps/web/package.json apps/web/package.json
COPY apps/server/package.json apps/server/package.json
COPY apps/desktop/package.json apps/desktop/package.json
COPY packages/api/package.json packages/api/package.json
COPY packages/core/package.json packages/core/package.json
RUN bun install --frozen-lockfile --filter @grimoire/web --filter @grimoire/server

COPY . .
RUN bun run build:web && bun run build:server

FROM oven/bun:1.3.14 AS runtime

LABEL org.opencontainers.image.title="Grimoire Books"
LABEL org.opencontainers.image.description="A self-hosted UI for browsing and organizing a Calibre ebook library"

WORKDIR /app

ENV PORT=4747 \
    WEB_DIST=/app/web \
    GRIMOIRE_DATA_DIR=/data

COPY --from=build --chown=bun:bun /app/apps/server/dist /app/server
COPY --from=build --chown=bun:bun /app/apps/web/dist /app/web
# Only reached with a named volume or no volume at all: a bind mount shadows
# this with the host directory's own ownership, which is what the entrypoint
# checks for.
RUN mkdir -p /data && chown bun:bun /data
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 0755 /usr/local/bin/docker-entrypoint.sh

# Grimoire never needs root at runtime, so it doesn't get it — a bind-mounted
# /data has to be owned by uid 1000 on the host (see README).
USER bun

VOLUME ["/data"]
EXPOSE 4747

# /api/preferences, not /: the SPA fallback answers from static files and would
# report healthy with a dead database behind it. This one reads grimoire.db.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e 'fetch("http://127.0.0.1:4747/api/preferences").then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))'

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["bun", "/app/server/index.js"]
