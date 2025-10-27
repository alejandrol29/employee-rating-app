#!/bin/sh
set -e

# Ensure expected directories exist
mkdir -p /app/data
mkdir -p /app/public/images

# Seed image directory if volume is empty
if [ -d /app/public-seed/images ] && [ -z "$(ls -A /app/public/images 2>/dev/null)" ]; then
  cp -a /app/public-seed/images/. /app/public/images/
fi

# Apply database migrations before launching the app
npx prisma migrate deploy

exec "$@"
