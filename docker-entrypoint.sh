#!/bin/sh
set -e

# Function to wait for PostgreSQL to become available
wait_for_postgres() {
    echo "Waiting for PostgreSQL to be available..."
    until nc -z postgres 5432; do
        sleep 1
    done
    echo "PostgreSQL is available!"
}

# Wait for the PostgreSQL service
wait_for_postgres

# Run Prisma migrations
echo "Running Prisma migrations..."
npx prisma migrate deploy

# Start the main application
echo "Starting main app: $@"
exec "$@"