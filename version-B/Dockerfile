# Multi-stage Docker build for FinTrack backend

# Stage 1: Build TypeScript
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json ./
COPY backend/package.json ./backend/

# Install dependencies (including dev for build)
RUN npm install --production=false

# Copy all source files
COPY . .

# Build TypeScript
RUN npm run build:backend

# Stage 2: Runtime
FROM node:20-alpine AS runtime

WORKDIR /app

# Copy built files and production dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/prisma ./prisma
COPY --from=builder /app/package.json ./

# Create uploads directory
RUN mkdir -p uploads

# Switch to non-root user for security
RUN addgroup -S appuser && adduser -S appuser -G appuser
USER appuser

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/api/v1/health', (res) => { if (res.statusCode !== 200) process.exit(1); else process.exit(0); }).on('error', () => process.exit(1))" || exit 1

# Start the server
CMD ["node", "dist/index.js"]
