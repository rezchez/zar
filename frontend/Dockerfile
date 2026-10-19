FROM oven/bun:1.4.2 AS bun

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
ENV DOCKER_BUILD=1
ENV NEXT_DIST_DIR=.next
RUN bun run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/node_modules/pdfkit/js/data ./node_modules/pdfkit/js/data
RUN mkdir -p /app/app_backups /app/.next/cache && chown -R node:node /app/app_backups /app/.next
USER node
EXPOSE 3000
CMD ["node", "server.js"]
