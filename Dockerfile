FROM node:20-alpine

# Install OpenSSL for Prisma (Alpine uses OpenSSL 3)
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json server/

# Install dependencies
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

# Run migrations and start server
EXPOSE 4000

# Resolve failed migration, run migrations, then start server
CMD cd server && (npx prisma migrate resolve --rolled-back 20260120000000_seed_admin_treasury || true) && npx prisma migrate deploy && cd .. && node server/dist/index.js
