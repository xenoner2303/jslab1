FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/
COPY shared/package*.json ./shared/
RUN npm ci

COPY . .
ARG GIT_SHA=dev
ENV GIT_SHA=$GIT_SHA
RUN npm run build

RUN npm prune --omit=dev

# -----

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/client/package*.json ./client/
COPY --from=builder /app/server/package*.json ./server/
COPY --from=builder /app/shared/package*.json ./shared/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/client/node_modules ./client/node_modules
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/server/src ./server/src
COPY --from=builder /app/server/tsconfig*.json ./server/
COPY --from=builder /app/shared/codec ./shared/codec
COPY --from=builder /app/shared/config ./shared/config
COPY --from=builder /app/shared/protocol ./shared/protocol
COPY --from=builder /app/shared/sim ./shared/sim
COPY --from=builder /app/shared/protocol.ts ./shared/

RUN mkdir -p logs && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "--experimental-strip-types", "server/src/index.ts"]
