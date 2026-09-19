# syntax=docker/dockerfile:1

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
# Bundle the migrator to a single file so the runtime image carries no
# node_modules at all -- and, in particular, no drizzle-kit. It reads the same
# ./drizzle folder and writes the same __drizzle_migrations journal as
# `drizzle-kit migrate` does locally.
# The createRequire banner is required: pg is CommonJS and does a dynamic
# require of node builtins, which an ESM bundle cannot resolve on its own.
RUN npx esbuild migrate.ts \
      --bundle \
      --platform=node \
      --format=esm \
      --target=node24 \
      --banner:js="import{createRequire as __cr}from'node:module';const require=__cr(import.meta.url);" \
      --outfile=.output/migrate.mjs

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Nitro bundles the server's dependencies into .output, so only the build
# output and the migration SQL need to ship.
COPY --from=build /app/.output ./.output
COPY --from=build /app/drizzle ./drizzle

USER node
EXPOSE 3000

# Migrations complete before the server listens. Single instance by design,
# so no migration locking is needed.
CMD ["sh", "-c", "node .output/migrate.mjs && node .output/server/index.mjs"]
