# Build stage
FROM node:22-slim AS builder
WORKDIR /usr/src/app

# Copy package files first to leverage Docker layer caching
COPY package*.json vite.config.js ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build arguments for versioning
ARG GIT_SHA
ARG GIT_TAG
ENV GIT_SHA=${GIT_SHA}
ENV GIT_TAG=${GIT_TAG}
ENV NODE_ENV=production

# Build the application
RUN npm run build

# Production stage
FROM node:22-slim AS production

# Install only required system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    openssl \
    netcat-traditional \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /home/node/hemmelig

# Copy built assets from builder stage
COPY --from=builder /usr/src/app/client/build client/build

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy application files
COPY server.js .env vite.config.js ./
COPY server/ ./server/
COPY shared/ ./shared/
COPY prisma/ ./prisma/
COPY config/ ./config/
COPY public/ ./public/

# Install Prisma CLI for migrations
RUN npm install prisma --no-save

# Generate Prisma client
RUN npx prisma generate && \
    # Set proper permissions
    chown -R node:node ./

# Copy entrypoint script
COPY docker-entrypoint.sh /home/node/hemmelig/
RUN chmod +x /home/node/hemmelig/docker-entrypoint.sh

# Expose application port
EXPOSE 3000

# Use non-root user
USER node

# Start with entrypoint script
CMD ["/home/node/hemmelig/docker-entrypoint.sh", "npm", "run", "start"]