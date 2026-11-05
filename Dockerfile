# Use the same tested Node version locally, in CI and in every image stage.
FROM node:26.7.0-bookworm-slim AS builder
WORKDIR /usr/src/app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json .npmrc ./
# npm ci runs postinstall (prisma generate), so its inputs must already exist.
COPY prisma.config.ts ./
COPY prisma/schema ./prisma/schema
# Generation needs no live database. Keep this placeholder local to the build step.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build_only npm ci
COPY . .
RUN npm run build

# This image has the pinned Prisma CLI. Run it once per deployment.
FROM builder AS migration
USER node
CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]

FROM builder AS production-dependencies
RUN npm prune --omit=dev --ignore-scripts

FROM node:26.7.0-bookworm-slim AS production
WORKDIR /usr/src/app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=production-dependencies --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --from=builder --chown=node:node /usr/src/app/dist ./dist
COPY --chown=node:node package.json ./
USER node
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
