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
RUN mkdir -p /data && chown bun:bun /data

USER bun

VOLUME ["/data"]
EXPOSE 4747

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e 'fetch("http://127.0.0.1:4747/").then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))'

CMD ["bun", "/app/server/index.js"]
