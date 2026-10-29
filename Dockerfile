# iERP 2.0 — imagem de PRODUÇÃO (telas + API numa porta só). Guia: IMPLANTACAO.md.
#
# Node 24 = o mesmo do desenvolvimento (engines pede >= 22.12). Debian "slim" e não Alpine: o
# better-sqlite3 é nativo; se não houver binário pronto para a versão, ele compila (por isso o
# python3/make/g++ nas etapas de build — a imagem final não leva nada disso).

# ── Etapa 1: telas (React/Vite) → /app/dist ─────────────────────────
FROM node:24-bookworm-slim AS telas
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
# Variáveis das telas: entram NO BUILD (o Vite grava no código). Vazias = recurso desligado.
ARG VITE_ESRI_API_KEY=""
ARG VITE_MAP_TILES_URL=""
ARG VITE_MAP_TILES_ATTRIBUTION=""
# Identificador da versão (vai no version.json — é por ele que a tela aberta avisa "versão nova").
ARG IERP_BUILD=""
RUN VITE_ESRI_API_KEY="$VITE_ESRI_API_KEY" \
    VITE_MAP_TILES_URL="$VITE_MAP_TILES_URL" \
    VITE_MAP_TILES_ATTRIBUTION="$VITE_MAP_TILES_ATTRIBUTION" \
    IERP_BUILD="${IERP_BUILD:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}" \
    npm run build

# ── Etapa 2: API (Express) → /app/server/dist ───────────────────────
FROM node:24-bookworm-slim AS api
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ ./
RUN npm run build && npm prune --omit=dev

# ── Etapa 3: o que roda ─────────────────────────────────────────────
FROM node:24-bookworm-slim
WORKDIR /app/server
ENV NODE_ENV=production \
    PORT=3000 \
    DB_FILE=/app/data/ierp.sqlite \
    ARQUIVOS_DIR=/app/data/arquivos \
    SITE_DIR=/app/site \
    TZ=America/Sao_Paulo
COPY --from=api /app/server/package.json ./
COPY --from=api /app/server/node_modules ./node_modules
COPY --from=api /app/server/dist ./dist
# O logo do relatório final (PDF) é lido de server/assets.
COPY --from=api /app/server/assets ./assets
COPY --from=telas /app/dist /app/site
# Roda como root, igual ao iERP 1.0: a pasta de dados é montada do disco D do Windows e um
# usuário sem privilégio pode não conseguir gravar nela (o banco não abriria).
RUN mkdir -p /app/data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Ao subir, aplica sozinho as migrations pendentes (src/index.ts) e abre a porta.
CMD ["node", "dist/index.js"]
