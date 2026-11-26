FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ─── Install dependencies (monorepo root context) ───────────────────────────
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/lms/package.json ./apps/lms/
RUN pnpm install --frozen-lockfile --filter lms...

# ─── Build ───────────────────────────────────────────────────────────────────
FROM deps AS build
COPY apps/lms ./apps/lms
COPY turbo.json ./
ARG NEXT_PUBLIC_LMS_API_URL
ENV NEXT_PUBLIC_LMS_API_URL=$NEXT_PUBLIC_LMS_API_URL
RUN cd apps/lms && pnpm run build

# ─── Production ──────────────────────────────────────────────────────────────
FROM base AS production
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/apps/lms/.next/standalone ./
COPY --from=build /app/apps/lms/.next/static ./apps/lms/.next/static

EXPOSE 3003
ENV PORT=3003
ENV HOSTNAME=0.0.0.0

CMD ["node", "apps/lms/server.js"]
