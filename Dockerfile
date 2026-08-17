# Stage 1: Builder
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache openssl python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json server/

# Install dependencies (including dev deps for build)
RUN npm install && \
    cd server && \
    npm install && \
    cd ..

# Copy source code
COPY server/src ./server/src
COPY server/tsconfig.json ./server/
COPY server/prisma ./server/prisma
COPY server/scripts ./server/scripts
COPY server/entrypoint.sh ./server/

# Make entrypoint executable
RUN chmod +x ./server/entrypoint.sh

# Build the application
RUN cd server && \
    npm run build && \
    cd ..

# Stage 2: Runtime
FROM node:20-alpine

# Install runtime dependencies only
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json server/

# Install production dependencies only
RUN npm install --production && \
    cd server && \
    npm install --production && \
    cd ..

# Copy built application from builder
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/prisma ./server/prisma
COPY --from=builder /app/server/entrypoint.sh ./server/
COPY --from=builder /app/server/node_modules ./server/node_modules

# Make entrypoint executable
RUN chmod +x ./server/entrypoint.sh

EXPOSE 4000

WORKDIR /app/server

# Run entrypoint script
ENTRYPOINT ["sh", "./entrypoint.sh"]
