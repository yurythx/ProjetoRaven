# Multi-stage build para Django Backend
FROM python:3.12.13-slim as base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    postgresql-client \
    curl \
    openssl \
    && rm -rf /var/lib/apt/lists/*

FROM base as production

# UID/GID 1000 — geralmente o primeiro usuário não-root em hosts Debian/Ubuntu.
# Mantém compatível com bind mounts (./Backend/keys) sem precisar de user namespace remap.
RUN groupadd -g 1000 appuser && useradd -u 1000 -g appuser -m -s /usr/sbin/nologin appuser

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

COPY requirements.txt .
RUN uv pip install --system --no-cache -r requirements.txt

COPY . .

# collectstatic em build time — usa placeholders para não falhar na validação do
# settings.py. JWT_PRIVATE_KEY/JWT_PUBLIC_KEY (não vazios) fazem settings.py pular o
# branch que gera e ESCREVE um par de chaves RSA em /app/keys — sem isso, o
# collectstatic gerava uma chave real e a deixava permanentemente na camada da
# imagem (achado via scan Trivy; apagar depois não adianta, a camada anterior
# continua recuperável). A chave real de assinatura vem via .env.prod no runtime.
RUN DJANGO_SECRET_KEY=build-time-placeholder \
    USE_SQLITE=True \
    JWT_PRIVATE_KEY=build-time-placeholder \
    JWT_PUBLIC_KEY=build-time-placeholder \
    python manage.py collectstatic --noinput || true

# mkdir -p garante que os mountpoints existam antes do chown — Docker propaga essa
# ownership para volumes nomeados na primeira montagem (mediafiles/staticfiles/backups/keys)
RUN mkdir -p /app/mediafiles /app/staticfiles /app/backups /app/keys \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

FROM base as development

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
