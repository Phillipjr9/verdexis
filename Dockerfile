FROM node:20-alpine

# Install OpenSSL 1.1 for Prisma
RUN apk add --no-cache openssl1.1-compat

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

# Build
RUN cd server && npm run build && cd ..

# Run migrations and start server
EXPOSE 4000

CMD ["node", "server/dist/index.js"]
