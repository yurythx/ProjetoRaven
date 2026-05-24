FROM node:22 AS deps
WORKDIR /app

# Copiar apenas o package.json para ignorar restrições do lockfile de outra plataforma
ARG CACHE_BUST=1
COPY package.json ./
RUN npm install

FROM node:22 AS builder
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

FROM node:22 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_DISABLE_FILE_SYSTEM_CACHE=1
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
USER node
EXPOSE 3000
CMD ["npm", "start"]
