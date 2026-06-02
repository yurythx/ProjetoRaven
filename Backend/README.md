# Backend — Projeto Raven

API Django REST Framework com suporte a WebSocket (Django Channels), tarefas assíncronas (Celery) e autenticação JWT RS256.

> Documentação completa: [docs/backend.md](../docs/backend.md)

---

## Setup Rápido

### Docker (recomendado)

```bash
# no diretório raiz do repositório
docker compose up -d
docker compose exec django python manage.py seed
```

Acesse a API em `http://localhost:8006/api/v1/`  
Django Admin em `http://localhost:8006/admin/` (admin@raven.gg / changeme)

### Local (com venv)

```bash
cd Backend

python -m venv venv
source venv/Scripts/activate    # Windows
# source venv/bin/activate      # Linux/Mac

pip install -r requirements.txt tinycss2

# Com SQLite (sem Docker)
cp -n .env.example .env
echo "Edite o arquivo Backend/.env e configure: USE_SQLITE=True, DEBUG=True, DJANGO_SECRET_KEY=dev, EMAIL_SETTINGS_ENCRYPTION_SALT=dev"
python manage.py migrate
python manage.py seed_dev
python manage.py runserver

# Com Postgres (Docker só para infra)
docker compose up -d postgres redis
export $(grep -v '^#' .env | sed 's/\r//' | xargs)
export POSTGRES_HOST=localhost
python manage.py migrate && python manage.py seed_dev && python manage.py runserver
```

---

## Testes

```bash
source venv/Scripts/activate
pytest -q                             # 147 testes
pytest --cov=apps --cov-report=term   # com cobertura
```

---

## Estrutura

```
Backend/
├── core/               # settings, urls, celery, asgi, wsgi
├── apps/
│   ├── common/         # UUIDModel base
│   ├── accounts/       # usuários, JWT, OTP, auditoria, SMTP
│   ├── blog/           # posts, categorias, comentários
│   ├── forum/          # tópicos, replies, reações, moderação
│   ├── media/          # upload e gerenciamento de arquivos de mídia
│   └── notifications/  # notificações push e in-app
├── keys/               # RSA private.pem + public.pem
├── requirements.txt
├── Dockerfile
└── (compose no root)   # veja /docker-compose.yml e /docker-compose.prod.yml
```

---

## Variáveis de Ambiente

Arquivo: `Backend/.env`

| Variável | Dev padrão | Descrição |
|---|---|---|
| `USE_SQLITE` | `False` | `True` para usar SQLite |
| `DEBUG` | `True` | Modo debug |
| `DJANGO_SECRET_KEY` | `dev-local-change-me` | Segredo Django |
| `POSTGRES_HOST` | `postgres` | Use `localhost` para dev local |
| `REDIS_URL` | `redis://redis:6379/1` | Vazio desativa Redis |
| `EMAIL_SETTINGS_ENCRYPTION_SALT` | `dev-local-email-salt` | Salt para criptografar credenciais SMTP |
