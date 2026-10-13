# Build stage
FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install -g npm@12.2.0 --no-audit --no-fund
RUN npm ci --include=dev --no-audit --no-fund

COPY . .

# Build-time ARGs for OAuth configuration.
# VITE_* vars are inlined by Vite into the production JS bundle (frontend).
# *_REDIRECT_URI vars are also passed through for the server runtime.
# Render must supply these as Render Build Args (not hardcode here).
# Client secrets (GOOGLE_CLIENT_SECRET, DISCORD_CLIENT_SECRET) must NOT be
# VITE_* vars — they are injected at runtime from Render environment.
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_GOOGLE_REDIRECT_URI
ARG VITE_DISCORD_CLIENT_ID
ARG VITE_DISCORD_REDIRECT_URI

# Export all as ENV so both Vite (build) and the server (runtime) can read them
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}
ENV VITE_GOOGLE_REDIRECT_URI=${VITE_GOOGLE_REDIRECT_URI}
ENV VITE_DISCORD_CLIENT_ID=${VITE_DISCORD_CLIENT_ID}
ENV VITE_DISCORD_REDIRECT_URI=${VITE_DISCORD_REDIRECT_URI}

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
