# Projeto Raven

Plataforma comunitária full-stack com blog, fórum e painel de administração. Backend em Django REST Framework, frontend em Next.js 15, autenticação JWT RS256 com cookies httpOnly, WebSocket em tempo real para o fórum, suporte a 2FA (TOTP) e notificações Web Push.

---

## Sumário

- [Visão geral](#visão-geral)
- [Arquitetura](#arquitetura)
- [Stack tecnológica](#stack-tecnológica)
- [Funcionalidades](#funcionalidades)
- [Ambiente de desenvolvimento](#ambiente-de-desenvolvimento)
- [Deploy em produção](#deploy-em-produção)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Comandos úteis](#comandos-úteis)
- [Testes](#testes)
- [Estrutura do projeto](#estrutura-do-projeto)
- [API](#api)

---

## Visão geral

O Projeto Raven é uma plataforma comunitária que oferece:

- **Blog** com workflow editorial completo (rascunho → agendado → publicado → arquivado), categorias, tags, comentários moderados e SEO
- **Fórum** com tópicos, respostas, reações em tempo real (WebSocket), moderação e marcação de solução
- **Contas de usuário** com verificação de e-mail, 2FA TOTP, OAuth (Google), amizades e perfil público
- **Painel admin** com analytics, gestão de usuários, audit logs, configurações de SMTP e provedores OAuth
- **Notificações** Web Push (VAPID) e em tempo real via WebSocket

---

## Arquitetura

```
Internet
    │
    ▼
Cloudflare Tunnel (HTTPS/TLS)
    │
    ├─ seudominio.com           → localhost:3100  (Next.js — frontend)
    ├─ seudominio.com/api/*     → localhost:8100  (Django — backend API)
    └─ seudominio.com/ws/*      → localhost:8100  (Django — WebSocket)

Docker Compose (name: projetoraven)
    ├─ frontend   (Next.js 15 standalone)   → 127.0.0.1:3100
    ├─ django     (Daphne ASGI)             → 127.0.0.1:8100
    ├─ postgres   (PostgreSQL 16)           → rede interna
    └─ redis      (Redis 7)                 → rede interna
```

**BFF (Backend for Frontend):** o Next.js não expõe a API diretamente ao browser. As Route Handlers em `/app/api/*` fazem proxy para o Django, injetando cookies httpOnly com os tokens JWT. O browser nunca toca os tokens diretamente.

**Autenticação:** JWT RS256 com par de chaves assimétricas. O access token expira em 30 minutos; o refresh token em 7 dias com rotação automática. Ambos ficam em cookies httpOnly `raven_access` / `raven_refresh`.

**WebSocket:** Django Channels + Daphne + Redis channel layer. O Next.js em modo standalone não faz proxy de WebSocket, portanto o Cloudflare Tunnel precisa rotear `/ws/*` diretamente para o Django.

---

## Stack tecnológica

### Backend
| Tecnologia | Versão |
|---|---|
| Python | 3.12 |
| Django | 5.0+ |
| Django REST Framework | 3.14+ |
| PostgreSQL | 16 |
| Redis | 7 |
| Django Channels + Daphne | 4.0+ |
| djangorestframework-simplejwt | 5.3+ |
| Celery | 5.3+ (opcional) |
| drf-spectacular | OpenAPI 3 |

### Frontend
| Tecnologia | Versão |
|---|---|
| Node.js | 20+ |
| Next.js | 15.2+ |
| React | 18.3+ |
| TypeScript | 5+ |
| Tailwind CSS | 4 |
| TanStack Query | 5 |
| React Hook Form + Zod | — |
| TipTap | WYSIWYG editor |
| Framer Motion | Animações |
| Recharts | Gráficos |

### Infraestrutura
| Tecnologia | Uso |
|---|---|
| Docker + Docker Compose v2 | Orquestração |
| Cloudflare Tunnel | HTTPS/reverse proxy (sem Nginx) |
| GitHub Actions | CI (pytest + tsc + build) |

---

## Funcionalidades

### Contas e autenticação
- Registro com verificação de e-mail via código OTP
- Login com proteção contra força bruta (lockout com Redis)
- JWT RS256 — access 30 min, refresh 7 dias com rotação
- 2FA TOTP (Google Authenticator, Authy) com códigos de recuperação
- OAuth — Google (extensível)
- Redefinição de senha via código OTP por e-mail
- Perfil público com bio, website, avatar, histórico de tópicos e posts
- Amizades (enviar, aceitar, rejeitar, desfazer)
- Exclusão de conta com anonimização de PII

### Blog
- Workflow editorial: `rascunho → pendente → rejeitado → agendado → publicado → arquivado`
- Posts agendados (publicação automática via Celery beat)
- Editor WYSIWYG rico (TipTap)
- Categorias e tags
- Comentários com moderação (aprovação, resposta, visibilidade)
- SEO: meta_title, meta_description, meta_keywords, Open Graph
- Tempo de leitura calculado automaticamente
- Histórico de revisões

### Fórum
- Categorias com permissões granulares
- Tópicos com slug único, reações em tempo real (like, dislike, heart, laugh, wow)
- Respostas aninhadas, marcação de solução, reações
- Ações de moderação: fixar, fechar, reabrir, arquivar, ocultar reply
- WebSocket para atualização em tempo real (contagem de reações, novos replies)

### Painel administrativo (dashboard)
- Analytics: usuários novos, posts, tópicos, reações (gráfico temporal)
- Gestão de usuários: busca, banimento, ativação/desativação, troca de grupos
- Audit log: histórico de todas as ações administrativas com IP e user agent
- Configurações de SMTP: gerenciamento de provedores de e-mail via interface
- Configurações de OAuth: ativar/desativar provedores Google por interface
- Diagnósticos do sistema (banco, cache, filas)

### Infraestrutura e operação
- Health checks (`/api/health/live/` e `/api/health/ready/`)
- Métricas Prometheus em `/api/metrics/`
- Logs estruturados em JSON (produção)
- Uploads de mídia com validação de MIME type e limite de 10 MB
- Notificações Web Push (VAPID) para browser
- Backup automatizado com retenção de 10 cópias

---

## Ambiente de desenvolvimento

### Pré-requisitos

- Docker Engine 24+
- Docker Compose v2 (`docker compose version`)
- Git

### Passo 1 — Clonar

```bash
git clone <url-do-repositorio> ProjetoRaven
cd ProjetoRaven
```

### Passo 2 — Gerar chaves JWT RSA

```bash
mkdir -p Backend/keys
openssl genrsa -out Backend/keys/private.pem 2048
openssl rsa -in Backend/keys/private.pem -pubout -out Backend/keys/public.pem
chmod 600 Backend/keys/private.pem
```

### Passo 3 — Configurar variáveis de ambiente

```bash
cp Backend/.env.example Backend/.env
cp frontend/.env.example frontend/.env.local   # se existir, caso contrário ajuste as variáveis no compose
```

Os valores padrão do `Backend/.env.example` funcionam direto para desenvolvimento local — PostgreSQL e Redis já sobem via compose.

### Passo 4 — Subir o ambiente

```bash
docker compose up -d --build
```

Aguarde o postgres e redis ficarem `healthy` e o django executar as migrações automaticamente.

```bash
# Verificar status
docker compose ps

# Acompanhar logs
docker compose logs -f django
docker compose logs -f frontend
```

### Passo 5 — Popular o banco (seed de desenvolvimento)

O seed é executado automaticamente na inicialização do django. Se precisar rodar manualmente:

```bash
docker compose exec django python manage.py seed_dev
```

Usuários criados:

| E-mail | Senha | Papel |
|---|---|---|
| `admin@raven.gg` | `admin123` | Superadmin |
| `player@raven.gg` | `player123` | Membro comum |

### URLs de desenvolvimento

| Serviço | URL |
|---|---|
| Frontend | http://localhost:3006 |
| Django API | http://localhost:8006/api/v1/ |
| Django Admin | http://localhost:8006/admin/ |
| Swagger UI | http://localhost:8006/api/schema/swagger-ui/ |
| ReDoc | http://localhost:8006/api/schema/redoc/ |

---

## Deploy em produção

> Documentação completa com troubleshooting em [`docs/deploy.md`](docs/deploy.md).

### Pré-requisitos do servidor

| Requisito | Versão mínima | Verificar |
|---|---|---|
| Docker Engine | 24+ | `docker --version` |
| Docker Compose plugin (v2) | 2.20+ | `docker compose version` |
| openssl | qualquer | `openssl version` |
| Cloudflare Tunnel | configurado e ativo | `docker ps \| grep cloudflared` |

### Passo 1 — Clonar no servidor

```bash
git clone <url-do-repositorio> ProjetoRaven
cd ProjetoRaven
```

### Passo 2 — Gerar chaves JWT RSA (única vez)

```bash
mkdir -p Backend/keys
openssl genrsa -out Backend/keys/private.pem 2048
openssl rsa -in Backend/keys/private.pem -pubout -out Backend/keys/public.pem
chmod 600 Backend/keys/private.pem
```

> As chaves ficam em `.gitignore`. **Nunca as comite.** Elas persistem entre deploys pelo volume `Backend/keys`.

### Passo 3 — Configurar variáveis do backend

```bash
cp Backend/.env.prod.example Backend/.env.prod
nano Backend/.env.prod
```

Gere o `DJANGO_SECRET_KEY`:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
```

Gere o `TOTP_ENCRYPTION_KEY`:

```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Preencha obrigatoriamente:

```bash
DJANGO_SECRET_KEY=<gerado-acima>
DEBUG=False
ALLOWED_HOSTS=seudominio.com,www.seudominio.com
SITE_URL=https://seudominio.com
CORS_ALLOWED_ORIGINS=https://seudominio.com
CSRF_TRUSTED_ORIGINS=https://seudominio.com

POSTGRES_DB=projeto_raven
POSTGRES_USER=raven
POSTGRES_PASSWORD=<senha-forte>
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

REDIS_PASSWORD=<senha-forte>
REDIS_URL=redis://:REDIS_PASSWORD@redis:6379/1
CELERY_BROKER_URL=redis://:REDIS_PASSWORD@redis:6379/2
CHANNEL_LAYER_URL=redis://:REDIS_PASSWORD@redis:6379/3

EMAIL_SETTINGS_ENCRYPTION_SALT=<string-aleatoria-32-chars>
TOTP_ENCRYPTION_KEY=<gerado-acima>

JWT_PRIVATE_KEY_PATH=/app/keys/private.pem
JWT_PUBLIC_KEY_PATH=/app/keys/public.pem

FRONTEND_PORT=3100
DJANGO_PORT=8100

# Admin criado automaticamente no primeiro boot
DJANGO_ADMIN_EMAIL=admin@seudominio.com
DJANGO_ADMIN_USERNAME=admin
DJANGO_ADMIN_PASSWORD=<senha-forte>

SECURE_SSL_REDIRECT=False
SCHEMA_ENABLED=False
REST_THROTTLING_ENABLED=True
```

### Passo 4 — Configurar variáveis do frontend

```bash
cp frontend/.env.prod.example frontend/.env.prod
nano frontend/.env.prod
```

```bash
NEXT_PUBLIC_API_BASE_URL=https://seudominio.com
NEXT_PUBLIC_SITE_URL=https://seudominio.com
NEXT_PUBLIC_WS_BASE_URL=https://seudominio.com
INTERNAL_API_BASE_URL=http://django:8000
```

> `NEXT_PUBLIC_*` são embutidas no bundle em **build-time**. Qualquer alteração exige rebuild da imagem.

### Passo 5 — Gerar chaves VAPID (Web Push, opcional)

```bash
npx web-push generate-vapid-keys
```

Adicione ao `Backend/.env.prod`:

```bash
VAPID_PUBLIC_KEY=<public-key>
VAPID_PRIVATE_KEY=<private-key>
VAPID_ADMIN_EMAIL=admin@seudominio.com
```

### Passo 6 — Configurar Cloudflare Tunnel

No painel do Cloudflare → **Zero Trust → Networks → Tunnels**, configure:

| Hostname público | Serviço interno |
|---|---|
| `seudominio.com` | `http://localhost:3100` |
| `seudominio.com/ws/*` | `http://localhost:8100` |
| `seudominio.com/api/*` | `http://localhost:8100` |

> A rota `/ws/*` é **obrigatória** para o fórum em tempo real. O Next.js standalone não faz proxy de WebSocket.

### Passo 7 — Fazer o deploy

#### Opção A — Script automatizado (recomendado)

```bash
chmod +x deploy.sh
./deploy.sh
```

O script executa automaticamente:
1. Verifica Docker, docker compose e openssl
2. Valida os arquivos `.env.prod` (detecta `CHANGE_ME` não preenchidos)
3. Gera as chaves RSA se não existirem
4. Pede confirmação antes de iniciar
5. Faz pull das imagens base (postgres, redis)
6. Constrói as imagens (backend + frontend)
7. Sobe todos os containers com `up -d`
8. Aguarda cada container ficar `healthy`
9. Testa os endpoints de health check
10. Exibe o status final

#### Opção B — Manual

```bash
# Carregar variáveis de ambiente no shell
set -a
source Backend/.env.prod
source frontend/.env.prod
set +a

# Construir imagens
docker compose -f docker-compose.prod.yml build

# Subir todos os serviços
docker compose -f docker-compose.prod.yml up -d

# Verificar status
docker compose -f docker-compose.prod.yml ps
```

### Passo 8 — Verificar o deploy

```bash
# Status dos containers
docker compose -f docker-compose.prod.yml ps

# Health check do Django
curl http://127.0.0.1:8100/api/health/live/
curl http://127.0.0.1:8100/api/health/ready/

# Frontend
curl -I http://127.0.0.1:3100/

# Logs em tempo real
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml logs -f django
```

### Passo 9 — Primeiro administrador

Se as variáveis `DJANGO_ADMIN_*` estiverem definidas no `.env.prod`, o admin é criado automaticamente no boot. Para criação manual:

```bash
# Registre uma conta em /register, depois promova:
docker compose -f docker-compose.prod.yml exec django \
  python manage.py promote_superadmin seu@email.com
```

### Atualizar para nova versão

```bash
git pull

# Rebuild e reiniciar
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# Ou via script (recomendado — inclui health checks)
./deploy.sh
```

> As migrações são executadas automaticamente na inicialização do container Django.

---

## Variáveis de ambiente

### Backend — principais

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DJANGO_SECRET_KEY` | ✅ | Chave secreta Django (64+ chars) |
| `DEBUG` | ✅ | `True` em dev, `False` em prod |
| `ALLOWED_HOSTS` | ✅ | Hosts permitidos (vírgula separados) |
| `SITE_URL` | ✅ | URL pública do site |
| `CORS_ALLOWED_ORIGINS` | ✅ | Origins CORS permitidas |
| `CSRF_TRUSTED_ORIGINS` | ✅ | Origins CSRF confiáveis |
| `POSTGRES_PASSWORD` | ✅ | Senha do PostgreSQL |
| `REDIS_URL` | ✅ | URL de conexão Redis (cache) |
| `REDIS_PASSWORD` | ✅ prod | Senha do Redis |
| `CHANNEL_LAYER_URL` | ✅ | Redis para Django Channels |
| `CELERY_BROKER_URL` | ✅ | Redis para Celery |
| `JWT_PRIVATE_KEY_PATH` | ✅ | Caminho da chave privada RSA |
| `JWT_PUBLIC_KEY_PATH` | ✅ | Caminho da chave pública RSA |
| `EMAIL_SETTINGS_ENCRYPTION_SALT` | ✅ | Salt para criptografia das configs de SMTP |
| `TOTP_ENCRYPTION_KEY` | ✅ | Chave Fernet para criptografar segredos TOTP |
| `DJANGO_ADMIN_EMAIL` | — | E-mail do admin criado no boot (seed_prod) |
| `DJANGO_ADMIN_USERNAME` | — | Username do admin |
| `DJANGO_ADMIN_PASSWORD` | — | Senha do admin |
| `ADMIN_ALLOWED_IPS` | — | IPs autorizados a acessar `/admin/` e `/api/schema/` |
| `SCHEMA_ENABLED` | — | `True`/`False` — ativa Swagger/Redoc (padrão: `False` em prod) |
| `VAPID_PUBLIC_KEY` | — | Chave pública VAPID para Web Push |
| `VAPID_PRIVATE_KEY` | — | Chave privada VAPID |
| `VAPID_ADMIN_EMAIL` | — | E-mail de contato VAPID |
| `FRONTEND_PORT` | — | Porta do frontend no host (padrão: `3100`) |
| `DJANGO_PORT` | — | Porta do Django no host (padrão: `8100`) |
| `SECURE_SSL_REDIRECT` | — | `False` quando Cloudflare termina TLS |
| `REST_THROTTLING_ENABLED` | — | `True` em prod para ativar rate limiting |

### Frontend — principais

| Variável | Obrigatória | Descrição |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | ✅ | URL pública da API (embutida no bundle) |
| `NEXT_PUBLIC_SITE_URL` | ✅ | URL pública do site |
| `NEXT_PUBLIC_WS_BASE_URL` | ✅ | URL base para conexão WebSocket |
| `INTERNAL_API_BASE_URL` | — | URL interna Django para SSR (padrão: `http://django:8000`) |

---

## Comandos úteis

### Desenvolvimento

```bash
# Subir ambiente completo
docker compose up -d --build

# Parar
docker compose down

# Logs em tempo real
docker compose logs -f

# Shell Python do Django
docker compose exec django python manage.py shell

# Shell do banco de dados
docker compose exec postgres psql -U raven projeto_raven

# Rodar migrações manualmente
docker compose exec django python manage.py migrate

# Criar nova migração
docker compose exec django python manage.py makemigrations

# Re-popular banco de desenvolvimento
docker compose exec django python manage.py seed_dev

# Coletar arquivos estáticos
docker compose exec django python manage.py collectstatic --noinput

# Rodar testes backend
docker compose exec django python -m pytest

# Rodar testes com verbose
docker compose exec django python -m pytest -v

# Rodar testes de um app específico
docker compose exec django python -m pytest apps/blog/ -v

# Verificar tipos TypeScript
docker compose exec frontend npx tsc --noEmit

# Regenerar tipos da API (após alterar o backend)
docker compose exec frontend npm run generate:types
```

### Produção

```bash
# Status dos containers
docker compose -f docker-compose.prod.yml ps

# Logs em tempo real
docker compose -f docker-compose.prod.yml logs -f

# Logs de um serviço específico
docker compose -f docker-compose.prod.yml logs -f django
docker compose -f docker-compose.prod.yml logs -f frontend

# Reiniciar um serviço
docker compose -f docker-compose.prod.yml restart django
docker compose -f docker-compose.prod.yml restart frontend

# Shell do Django em produção
docker compose -f docker-compose.prod.yml exec django python manage.py shell

# Shell do banco em produção
docker compose -f docker-compose.prod.yml exec postgres psql -U raven projeto_raven

# Promover usuário a superadmin
docker compose -f docker-compose.prod.yml exec django \
  python manage.py promote_superadmin email@dominio.com

# Parar todos os containers (mantém volumes)
docker compose -f docker-compose.prod.yml down

# Parar e remover volumes (DESTRUTIVO — apaga banco e cache)
docker compose -f docker-compose.prod.yml down -v

# Ver uso de recursos
docker stats

# Limpar imagens não utilizadas
docker image prune -f
```

### Backup

```bash
# Backup completo (banco + mídia)
./backup.sh

# Somente banco de dados
./backup.sh --db-only

# Restaurar um backup específico
./backup.sh --restore backups/db_20260525_143000.sql.gz

# Backup manual do banco
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U raven projeto_raven | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Restore manual
gunzip -c backup_YYYYMMDD_HHMMSS.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U raven projeto_raven
```

Agendar backup diário às 3h:

```bash
crontab -e
# Adicione a linha:
0 3 * * * cd /caminho/para/ProjetoRaven && ./backup.sh --db-only >> /var/log/raven-backup.log 2>&1
```

---

## Testes

### Backend (pytest)

```bash
# Rodar todos os testes
docker compose exec django python -m pytest

# Com output detalhado
docker compose exec django python -m pytest -v

# App específico
docker compose exec django python -m pytest apps/accounts/ -v
docker compose exec django python -m pytest apps/blog/ -v
docker compose exec django python -m pytest apps/forum/ -v

# Um arquivo específico
docker compose exec django python -m pytest apps/blog/tests/test_serializers.py -v

# Com cobertura de código
docker compose exec django python -m pytest --cov=apps --cov-report=term-missing
```

### Frontend (Vitest)

```bash
# Rodar testes unitários
docker compose exec frontend npm test

# Watch mode
docker compose exec frontend npm run test:watch
```

### E2E (Playwright)

```bash
# Rodar testes E2E (requer ambiente de dev rodando)
docker compose exec frontend npm run e2e

# Somente chromium
docker compose exec frontend npx playwright test --project=chromium

# Com interface visual
docker compose exec frontend npx playwright test --ui
```

### CI/CD (GitHub Actions)

O pipeline roda automaticamente em push e pull requests:

- **Backend**: pytest em PostgreSQL 16 + Redis 7
- **Frontend**: TypeScript check (`tsc --noEmit`) + build de produção
- **E2E**: Playwright em Chromium (somente branch `main`)

---

## Estrutura do projeto

```
ProjetoRaven/
├── Backend/                    # Django REST Framework
│   ├── apps/
│   │   ├── accounts/           # Usuários, auth, 2FA, OAuth, amizades, audit
│   │   ├── blog/               # Posts, categorias, tags, comentários
│   │   ├── forum/              # Tópicos, respostas, reações, moderação
│   │   ├── media/              # Upload de imagens
│   │   ├── notifications/      # Web Push, notificações in-app
│   │   └── common/             # Base, health checks, métricas, paginação
│   ├── core/
│   │   ├── settings.py         # Configuração central
│   │   ├── urls.py             # Roteamento principal
│   │   ├── asgi.py             # ASGI + WebSocket
│   │   └── telemetry.py        # Sentry, logging estruturado
│   ├── keys/                   # Chaves RSA JWT (gitignored)
│   ├── scripts/                # Scripts de smoke test
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── .env.example
│   └── .env.prod.example
│
├── frontend/                   # Next.js 15 App Router
│   ├── src/
│   │   ├── app/
│   │   │   ├── (public)/       # Páginas públicas (landing, blog, fórum)
│   │   │   ├── api/            # Route Handlers (BFF proxy para Django)
│   │   │   ├── dashboard/      # Painel admin (analytics, usuários, blog, fórum)
│   │   │   └── me/             # Perfil do usuário autenticado
│   │   ├── components/         # Componentes React reutilizáveis
│   │   ├── hooks/              # Custom hooks
│   │   ├── lib/                # Utilitários (fetch, environment, helpers)
│   │   ├── types/              # Tipos TypeScript (gerados da API)
│   │   └── mocks/              # MSW handlers (testes)
│   ├── e2e/                    # Testes Playwright
│   ├── Dockerfile
│   ├── next.config.ts
│   ├── .env.example
│   └── .env.prod.example
│
├── docs/
│   ├── deploy.md               # Guia completo de produção
│   ├── backend.md              # Referência da API e módulos
│   └── frontend.md             # Arquitetura frontend e design system
│
├── docker-compose.yml          # Ambiente de desenvolvimento
├── docker-compose.prod.yml     # Ambiente de produção
├── deploy.sh                   # Script de deploy automatizado
├── backup.sh                   # Script de backup/restore
├── Makefile                    # Atalhos de comandos
└── README.md                   # Este arquivo
```

---

## API

A documentação interativa da API está disponível em desenvolvimento:

- **Swagger UI:** http://localhost:8006/api/schema/swagger-ui/
- **ReDoc:** http://localhost:8006/api/schema/redoc/
- **OpenAPI schema:** http://localhost:8006/api/schema/

Em produção, o schema é desativado por padrão (`SCHEMA_ENABLED=False`).

### Principais endpoints

| Grupo | Prefixo | Descrição |
|---|---|---|
| Auth | `/api/v1/accounts/` | Registro, login, logout, verificação de e-mail, 2FA, OAuth |
| Perfil | `/api/v1/accounts/me/` | Perfil do usuário autenticado |
| Blog (admin) | `/api/v1/blog/` | CRUD de posts, categorias, tags, comentários |
| Blog (público) | `/api/v1/blog/public/` | Listagem e leitura pública |
| Fórum (autenticado) | `/api/v1/forum/` | Criar tópicos, respostas, reações |
| Fórum (público) | `/api/v1/forum/public/` | Leitura pública de categorias e tópicos |
| Usuários (admin) | `/api/v1/accounts/users/` | Gestão de usuários (requer staff) |
| Audit | `/api/v1/accounts/audit-events/` | Log de ações administrativas |
| Mídia | `/api/v1/media/` | Upload de imagens |
| Busca | `/api/v1/search/` | Busca global (posts + tópicos) |
| Notificações | `/api/v1/notifications/` | Web Push e in-app |
| Health | `/api/health/` | Liveness e readiness probes |
| Métricas | `/api/metrics/` | Prometheus metrics |

### Grupos de usuários

| Grupo | Permissões |
|---|---|
| `members` | Criar tópicos e respostas no fórum, comentar no blog |
| `blog_editors` | CRUD completo de posts, categorias e tags |
| `forum_moderators` | Fixar, fechar, arquivar tópicos; ocultar respostas |
| `admins` | Gestão de usuários, audit log, configurações do sistema |

---

## Documentação adicional

- [`docs/deploy.md`](docs/deploy.md) — Deploy completo em produção com troubleshooting
- [`docs/backend.md`](docs/backend.md) — Módulos do backend e referência da API
- [`docs/frontend.md`](docs/frontend.md) — Arquitetura frontend e design system
