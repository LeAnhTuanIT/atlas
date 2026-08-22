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

# Install only production dependencies using npm (avoids bun/node native module mismatch)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --ignore-scripts

# Copy compiled output
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "-r", "tsconfig-paths/register", "dist/src/main.js"]
