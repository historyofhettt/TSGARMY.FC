# Build stage
FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install -g npm@12.2.0 --no-audit --no-fund
RUN npm ci --include=dev --no-audit --no-fund

COPY . .

# Declare build-time ARGs for OAuth configuration (passed from Render)
# These are consumed by Vite at build time (VITE_*) and by the server at runtime
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_GOOGLE_REDIRECT_URI
ARG VITE_DISCORD_CLIENT_ID
ARG VITE_DISCORD_REDIRECT_URI
ARG GOOGLE_REDIRECT_URI
ARG DISCORD_REDIRECT_URI

# Export as env vars so Vite can read VITE_* and the server can read *_REDIRECT_URI
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}
ENV VITE_GOOGLE_REDIRECT_URI=${VITE_GOOGLE_REDIRECT_URI}
ENV VITE_DISCORD_CLIENT_ID=${VITE_DISCORD_CLIENT_ID}
ENV VITE_DISCORD_REDIRECT_URI=${VITE_DISCORD_REDIRECT_URI}
ENV GOOGLE_REDIRECT_URI=${GOOGLE_REDIRECT_URI}
ENV DISCORD_REDIRECT_URI=${DISCORD_REDIRECT_URI}

RUN if [ -z "$VITE_DISCORD_CLIENT_ID" ]; then \
      echo "ERROR: VITE_DISCORD_CLIENT_ID missing during build"; exit 1; \
    elif [ -z "$VITE_GOOGLE_CLIENT_ID" ]; then \
      echo "ERROR: VITE_GOOGLE_CLIENT_ID missing during build"; exit 1; \
    else \
      echo "OAuth Client IDs received during build"; \
    fi

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
