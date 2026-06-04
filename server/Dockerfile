FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Generate Prisma client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy built application
COPY dist ./dist/

# Expose port
EXPOSE 4000

# Start the server
CMD ["node", "dist/index.js"]
