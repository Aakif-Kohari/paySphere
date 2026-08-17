# Multi-stage Dockerfile for Node.js Backend

FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install

FROM base AS development
ENV NODE_ENV=development
COPY . .
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/metrics || exit 1
CMD ["npm", "run", "dev"]

FROM base AS production
ENV NODE_ENV=production
RUN npm prune --production
COPY . .
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/metrics || exit 1
CMD ["node", "src/index.js"]
