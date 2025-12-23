# Dockerfile for Next.js 15 with React 19
# Multi-stage build for optimized production image

# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app

# Install dependencies needed for native modules
RUN apk add --no-cache libc6-compat python3 make g++

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies (use legacy peer deps for React 19 compatibility)
RUN npm ci --only=production --legacy-peer-deps && \
    npm cache clean --force

# Generate Prisma Client
RUN npx prisma generate

# Stage 2: Builder
FROM node:22-alpine AS builder
WORKDIR /app

# Install dependencies needed for native modules
RUN apk add --no-cache libc6-compat python3 make g++

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies, use legacy peer deps for React 19)
RUN npm ci --legacy-peer-deps

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build the application
RUN npm run build

# Stage 3: Runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma

# Set correct permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Health check - check if port 3000 is listening
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))"

CMD ["sh", "-c", "HOSTNAME=0.0.0.0 node server.js"]
