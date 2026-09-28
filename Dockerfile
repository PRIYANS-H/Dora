# ── Stage 1: Build Frontend ───────────────────────────────────────────────────
# Needs Node 22+: vite 8/rolldown crash on Node 18, supabase-js requires >= 22
FROM node:24-alpine AS frontend-builder
WORKDIR /app/frontend

# Arguments for Vite build
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# ── Stage 2: Build Backend ────────────────────────────────────────────────────
FROM python:3.11-slim AS backend-builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --timeout=120 --retries=5 --prefix=/install -r requirements.txt

# ── Stage 3: Runtime ──────────────────────────────────────────────────────────
FROM python:3.11-slim
WORKDIR /app/backend

# Runtime libs only
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed python packages from builder
COPY --from=backend-builder /install /usr/local

# Copy backend source
COPY backend/app/ ./app/
COPY backend/static/ ./static/

# Copy frontend build output to be served by FastAPI
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Non-root user for security
RUN useradd -m -u 1001 dori && chown -R dori:dori /app
USER dori

EXPOSE 8000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Run the app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
