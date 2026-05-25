# Multi-stage build para Django Backend
FROM python:3.12-slim as base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    openssl \
    && rm -rf /var/lib/apt/lists/*

FROM base as production

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

COPY requirements.txt .
RUN uv pip install --system --no-cache -r requirements.txt

COPY . .

# collectstatic em build time — usa chave temporária para não falhar na validação
# do settings.py (DEBUG=True implícito aqui; chave real vem via .env.prod no runtime)
RUN DJANGO_SECRET_KEY=build-time-placeholder \
    USE_SQLITE=True \
    python manage.py collectstatic --noinput || true

EXPOSE 8000

FROM base as development

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
