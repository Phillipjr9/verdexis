FROM node:20-alpine

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
COPY server/src ./server/src
COPY server/tsconfig.json ./server/
COPY server/prisma ./server/prisma
COPY server/scripts ./server/scripts

# Build
RUN cd server && npm run build && cd ..

EXPOSE 4000

WORKDIR /app/server

# Resolve failed migration, run migrations, then start server
CMD ["sh", "-c", "node scripts/resolve-failed-migration.js || true && npx prisma migrate deploy --schema prisma/schema.prisma && node dist/index.js"]
