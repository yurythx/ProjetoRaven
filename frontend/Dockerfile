FROM node:26.5.0 AS deps
WORKDIR /app

# Copiar apenas o package.json para ignorar restrições do lockfile de outra plataforma
ARG CACHE_BUST=1
COPY package.json ./
RUN npm install

FROM node:26.5.0 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY next.config.ts ./
COPY tsconfig.json ./
COPY postcss.config.mjs ./
COPY playwright.config.ts ./
COPY vitest.config.ts ./
COPY .eslintrc.json ./
COPY public ./public
COPY src ./src
RUN rm -f .env .env.* .env.local .env.production .env.development .env.test
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_WS_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_PUBLIC_WS_BASE_URL=${NEXT_PUBLIC_WS_BASE_URL}
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Standalone runner — usa apenas os arquivos gerados pelo Next.js (sem node_modules completo)
FROM node:26.5.0 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# standalone/ contém server.js + node_modules mínimo (só prod deps)
COPY --from=builder --chown=node:node /app/.next/standalone ./
# static/ e public/ ficam fora do standalone e devem ser copiados separadamente
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node
EXPOSE 3000
CMD ["node", "server.js"]
