# Build stage: install all deps, build client + server bundles
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Build-time ARGs for OAuth configuration.
# VITE_* vars are inlined by Vite into the production JS bundle (frontend).
# *_REDIRECT_URI vars are also passed to the server runtime via ENV.
# Render must supply these as Render Build Args (not hardcode here).
# Client secrets (GOOGLE_CLIENT_SECRET, DISCORD_CLIENT_SECRET) must NOT be
# VITE_* vars — they are injected at runtime from Render environment.
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_GOOGLE_REDIRECT_URI
ARG VITE_DISCORD_CLIENT_ID
ARG VITE_DISCORD_REDIRECT_URI

# Export all as ENV so Vite (build) and the server (runtime) can read them
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}
ENV VITE_GOOGLE_REDIRECT_URI=${VITE_GOOGLE_REDIRECT_URI}
ENV VITE_DISCORD_CLIENT_ID=${VITE_DISCORD_CLIENT_ID}
ENV VITE_DISCORD_REDIRECT_URI=${VITE_DISCORD_REDIRECT_URI}

COPY . .
RUN npm run build && npm prune --omit=dev

# Runtime stage: production server only
FROM node:20-slim
# Re-declare build ARGs so their values carry over to the runtime stage.
# Server-side redirect URIs must match the VITE_* counterparts baked into
# the frontend bundle — using the same build-arg ensures consistency.
ARG VITE_GOOGLE_REDIRECT_URI
ARG VITE_DISCORD_REDIRECT_URI
# Set GOOGLE_REDIRECT_URI / DISCORD_REDIRECT_URI for the callback handlers.
# Render can override these at runtime via Environment Variables if needed.
ENV GOOGLE_REDIRECT_URI=${VITE_GOOGLE_REDIRECT_URI}
ENV DISCORD_REDIRECT_URI=${VITE_DISCORD_REDIRECT_URI}
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
RUN mkdir -p /app/dist/public/uploads
EXPOSE 3000
CMD ["node", "dist/boot.js"]
