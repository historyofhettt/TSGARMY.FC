# Build stage
FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install -g npm@12.2.0 --no-audit --no-fund
RUN npm ci --include=dev --no-audit --no-fund

COPY . .

RUN npm run build && npm prune --omit=dev

# Runtime stage
FROM node:24-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

EXPOSE 3000

CMD ["node", "dist/boot.js"]
