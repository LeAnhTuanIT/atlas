# ---- Build stage ----
FROM oven/bun:1-alpine AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# ---- Production stage ----
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy only production artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

CMD ["node", "-r", "tsconfig-paths/register", "dist/main.js"]
