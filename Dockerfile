FROM node:24-bookworm-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.js ./
COPY web ./web
RUN npm run build
FROM node:24-bookworm-slim
ENV NODE_ENV=production DEMO_MODE=true HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund && mkdir -p /app/.data/uploads && chown -R node:node /app
COPY --from=builder /app/dist ./dist
COPY server ./server
COPY app.cjs ./
USER node
EXPOSE 3000
VOLUME ["/app/.data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node","app.cjs"]
