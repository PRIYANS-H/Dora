# ── Stage 1: Build React/Vite app ────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy deps manifest first (layer cache)
COPY package.json package-lock.json ./
RUN npm ci --silent

# Copy source and build
COPY . .
RUN npm run build

# ── Stage 2: Serve with Nginx ─────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Remove default nginx page
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets to /react subfolder
COPY --from=builder /app/dist /usr/share/nginx/html/react
# The React entry is built as app.html so the cinematic landing page can keep index.html.
RUN mv /usr/share/nginx/html/react/app.html /usr/share/nginx/html/react/index.html

# Also serve the standalone cinematic index.html at /cinema
COPY index.html /usr/share/nginx/html/cinema/index.html

# Nginx config — SPA routing + API proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
