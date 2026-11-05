# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/prisma ./apps/api/prisma

RUN npm ci --ignore-scripts && npm run prisma:generate -w @cakecraft/api

COPY apps/api/tsconfig.json apps/api/tsconfig.build.json apps/api/nest-cli.json ./apps/api/
COPY apps/api/src ./apps/api/src

RUN npm run build -w @cakecraft/api

# Alvo dedicado para migracoes (prisma migrate deploy / db seed) em CI/CD
FROM builder AS migrate
USER node
WORKDIR /app/apps/api
CMD ["npm", "run", "prisma:deploy"]

# Estagio intermediario que remove devDependencies antes de montar a imagem final
FROM builder AS pruned
RUN npm prune --omit=dev && mkdir -p /app/apps/api/node_modules

FROM node:22-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production

COPY --from=pruned --chown=node:node /app/package.json ./package.json
COPY --from=pruned --chown=node:node /app/node_modules ./node_modules
COPY --from=pruned --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=pruned --chown=node:node /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=pruned --chown=node:node /app/apps/api/prisma ./apps/api/prisma
COPY --from=pruned --chown=node:node /app/apps/api/dist ./apps/api/dist

RUN mkdir -p /app/apps/api/uploads && chown -R node:node /app/apps/api/uploads

WORKDIR /app/apps/api
USER node
EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/health >/dev/null || exit 1

CMD ["node", "dist/main.js"]
