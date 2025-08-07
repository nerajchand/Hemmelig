#!/bin/sh
set -e

# Run Prisma migrations
echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Starting main app: $@"
exec "$@"
