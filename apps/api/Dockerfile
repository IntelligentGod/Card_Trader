# Production image for the API and the pricing worker (same image, different command).
# Build from the repository root:  docker build -f apps/api/Dockerfile .
FROM node:22-bookworm-slim AS build
WORKDIR /repo
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/api/prisma apps/api/prisma
RUN npm ci --workspace @card-trader/api --workspace @card-trader/shared --include-workspace-root --ignore-scripts

COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @card-trader/shared \
  && npx --workspace @card-trader/api prisma generate \
  && npm run build -w @card-trader/api \
  && npm prune --omit=dev --workspace @card-trader/api --workspace @card-trader/shared --include-workspace-root

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /repo
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/* \
  && useradd --system --uid 1001 app
COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/packages/shared packages/shared
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/api/prisma apps/api/prisma
COPY --from=build /repo/apps/api/package.json apps/api/package.json
WORKDIR /repo/apps/api
USER app
EXPOSE 3000
CMD ["node", "dist/main.js"]
