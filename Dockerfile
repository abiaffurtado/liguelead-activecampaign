# Imagem de producao do conector LigueLead <> ActiveCampaign.
FROM node:20-alpine

# Diretorio da app
WORKDIR /app

# Instala apenas dependencias de producao (usa o lockfile para builds reproduziveis).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Codigo da aplicacao
COPY src ./src

# Roda como usuario nao-root (o node:alpine ja traz o usuario "node").
USER node

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000

# Healthcheck simples batendo no /health (sem auth).
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O- http://127.0.0.1:3000/health || exit 1

CMD ["node", "src/server.js"]
