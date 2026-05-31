# ========================
# FinTrack — Backend (Node.js + Express + Prisma)
# Multi-stage build : dev TS → build JS → runtime léger
# ========================

# ---------- Stage 1 : builder ----------
FROM node:20-alpine AS builder
WORKDIR /app

# Copie des fichiers de dépendances
COPY package.json ./
COPY package-lock.json* ./
COPY prisma ./prisma/

# Installation (prod + dev car on va build)
RUN npm install

# Copie source + build
COPY . .
RUN npm run build

# ---------- Stage 2 : runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Dépendances prod uniquement + Prisma CLI
COPY package.json ./
COPY package-lock.json* ./
RUN npm install --omit=dev && npm install prisma @prisma/client

# Copie du build + du schéma Prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Script de démarrage : lance d'abord les migrations puis le server
RUN echo '#!/bin/sh\nnpx prisma migrate deploy --schema=./prisma/schema.prisma\nnode dist/index.js' > /app/start.sh && chmod +x /app/start.sh

EXPOSE ${PORT:-4000}
CMD ["/app/start.sh"]
