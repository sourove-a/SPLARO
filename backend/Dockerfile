# --- Stage 1: Build ---
FROM node:24-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install
COPY . .
RUN npm run build
RUN npx prisma generate

# --- Stage 2: Production ---
FROM node:24-alpine

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/prisma ./prisma

EXPOSE 4000

# Non-root user for security
USER node

CMD ["npm", "run", "start:prod"]
