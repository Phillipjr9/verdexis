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
COPY server/entrypoint.sh ./server/

# Make entrypoint executable
RUN chmod +x ./server/entrypoint.sh

# Build
RUN cd server && npm run build && cd ..

EXPOSE 4000

WORKDIR /app/server

# Run entrypoint script
ENTRYPOINT ["sh", "./entrypoint.sh"]
