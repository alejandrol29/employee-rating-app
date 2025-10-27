# syntax=docker/dockerfile:1

FROM node:20-slim AS base

ENV NODE_ENV=production
WORKDIR /app

# Install runtime dependencies first for better cache usage
COPY package*.json ./
RUN npm ci --omit=dev \
    && npm cache clean --force

# Copy application source
COPY prisma ./prisma
COPY public ./public
RUN cp -a public /app/public-seed
COPY *.js ./
COPY docker-entrypoint.sh ./docker-entrypoint.sh

# Generate Prisma client ahead of time
RUN npx prisma generate

# Prepare directories for runtime state
RUN mkdir -p /app/data /app/public/images \
    && chmod +x /app/docker-entrypoint.sh

# Install lightweight init system for proper signal handling
RUN apt-get update \
    && apt-get install -y --no-install-recommends dumb-init \
    && rm -rf /var/lib/apt/lists/*

EXPOSE 8081

ENTRYPOINT ["dumb-init", "--", "/app/docker-entrypoint.sh"]
CMD ["node", "index.js"]
