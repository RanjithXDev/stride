# ── Stage 1: Build ───────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install deps first (layer-cached until package*.json changes)
COPY package*.json ./
RUN npm ci

# Copy source and prisma schema
COPY tsconfig.json ./
COPY src/ ./src/
COPY prisma/ ./prisma/

# Generate Prisma client and compile TypeScript
RUN npx prisma generate
RUN npm run build

# ── Stage 2: Production image ─────────────────────────────────
FROM node:22-alpine AS runner

RUN apk add --no-cache dumb-init

WORKDIR /app
ENV NODE_ENV=production

# Copy built output, Prisma schema, and ALL node_modules from builder
# (prisma CLI is a devDep but needed at runtime for migrate deploy)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

# Uploads directory for file attachments
RUN mkdir -p /app/uploads && chown node:node /app/uploads

EXPOSE 4000

USER node

# Run migrations then start the server
CMD ["dumb-init", "sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
