# Build stage
FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --include=dev --no-audit --no-fund --fetch-retries=5 --fetch-retry-factor=2 --fetch-timeout=600000

COPY . .

RUN npm run build \
    && npm prune --omit=dev

# Production runtime stage
FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

EXPOSE 3000

CMD ["node", "dist/boot.js"]
