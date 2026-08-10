FROM node:20-alpine

# Cache busting marker - update this to force full rebuild
ENV BUILD_ID="2026-08-03-11-35-00"

# Install OpenSSL for Prisma (Alpine uses OpenSSL 3)
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json server/

# Install dependencies (include dev dependencies for build)
RUN npm install --legacy-peer-deps && \
    cd server && \
    npm install --legacy-peer-deps && \
    cd ..

# Copy source code
# Cache invalidation: 2026-08-03T11:35:00Z
RUN echo "Preparing to copy source files..."
COPY server/src ./server/src
COPY server/tsconfig.json ./server/
COPY server/prisma ./server/prisma
COPY server/scripts ./server/scripts
COPY server/entrypoint.sh ./server/

# Use PostgreSQL Prisma schema for Render deployments
RUN cp ./server/prisma/schema.prisma ./server/prisma/schema.prisma

# Make entrypoint executable
RUN chmod +x ./server/entrypoint.sh

# Build
RUN echo "=== Build sanity checks ===" && \
    cd server && \
    echo "=== Prisma schema file list ===" && \
    find prisma -maxdepth 1 -type f | sort && \
    echo "=== Prisma schema preview ===" && \
    sed -n '1,80p' prisma/schema.prisma && \
    echo "=== Installed server dependencies ===" && \
    npm ls --depth=0 && \
    echo "=== Prisma CLI version ===" && \
    npx prisma --version && \
    echo "=== Starting server build ===" && \
    npm run build && \
    cd ..

EXPOSE 4000

WORKDIR /app/server

# Run entrypoint script
ENTRYPOINT ["sh", "./entrypoint.sh"]
