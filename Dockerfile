# Build stage
FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install -g npm@12.2.0 --no-audit --no-fund
RUN npm ci --include=dev --no-audit --no-fund

COPY . .

ARG 1556618631893225603
ARG 116180026783-kgaaoveg9h9vk5iljmc54v7pp076us4r.apps.googleusercontent.com

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
