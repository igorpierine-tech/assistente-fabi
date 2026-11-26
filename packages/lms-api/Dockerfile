FROM node:22-slim AS base
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ─── Install dependencies (monorepo root context) ───────────────────────────
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/lms-api/package.json ./packages/lms-api/
RUN pnpm install --frozen-lockfile --filter @assistente-fabi/lms-api...

# ─── Generate Prisma client ──────────────────────────────────────────────────
FROM deps AS prisma
COPY packages/lms-api/prisma ./packages/lms-api/prisma
RUN cd packages/lms-api && npx prisma generate

# ─── Build ───────────────────────────────────────────────────────────────────
FROM prisma AS build
COPY packages/lms-api/src ./packages/lms-api/src
COPY packages/lms-api/tsconfig.json ./packages/lms-api/
RUN cd packages/lms-api && pnpm run build

# ─── Production ──────────────────────────────────────────────────────────────
FROM base AS production
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/packages/lms-api/dist ./dist
COPY --from=prisma /app/packages/lms-api/node_modules ./node_modules
COPY --from=prisma /app/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=prisma /app/packages/lms-api/prisma ./prisma
COPY packages/lms-api/package.json ./

EXPOSE 3002

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
