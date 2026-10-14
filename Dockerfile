# syntax=docker/dockerfile:1

# ── Dependências (inclui as de desenvolvimento, para compilar) ──────
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

# ── Build: gera o Prisma Client e compila o TypeScript ──────────────
# O serviço "migrate" do docker-compose usa este estágio, que tem o CLI do Prisma.
FROM deps AS build
COPY . .
RUN npm run build && npm prune --omit=dev

# ── Runtime: só o necessário para rodar ─────────────────────────────
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3333
CMD ["node", "dist/main/server.js"]
