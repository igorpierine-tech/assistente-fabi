FROM node:20-slim

RUN apt-get update && \
    apt-get install -y python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@11.21.0 --activate

WORKDIR /app

COPY . .

ENV npm_config_build_from_source=true

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @assistente-fabi/api build

EXPOSE 3001

CMD ["node", "packages/api/dist/server.js"]
