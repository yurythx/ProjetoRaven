# Backend — Django API

O backend é o **Single Source of Truth** do projeto: persiste estado, serve a API REST, gerencia WebSockets e coordena tarefas assíncronas.

---

## Stack

| Componente | Tecnologia |
|---|---|
| Framework | Django 5 + Django REST Framework |
| Banco de dados | PostgreSQL 16 |
| Cache | Redis 7 (django-redis) |
| WebSocket | Django Channels + channels-redis |
| Autenticação | JWT RS256 (simplejwt) + blacklist |
| Documentação da API | drf-spectacular (OpenAPI 3) |

---

## Estrutura de Pastas

```
Backend/
├── core/
│   ├── settings.py     # Configuração (DB, Cache, JWT, CORS)
│   ├── urls.py         # Roteamento global sob /api/v1/
│   ├── asgi.py         # Entry point ASGI (HTTP + WebSocket via Channels)
│   └── wsgi.py         # Entry point WSGI (fallback sem WebSocket)
├── apps/
│   ├── common/         # UUIDModel base, utilitários compartilhados
│   ├── accounts/       # Usuários, JWT, OTP, auditoria, SMTP
│   ├── blog/           # Posts, categorias, tags, comentários
│   ├── forum/          # Tópicos, replies, reações, moderação
│   ├── media/          # Upload e gerenciamento de arquivos de mídia
│   └── notifications/  # Notificações push e in-app
├── keys/               # RSA private.pem + public.pem (gerados pelo deploy.sh)
├── requirements.txt
├── Dockerfile
└── .env.example
```

> Para orquestrar o stack completo (postgres + redis + django + frontend), use o `docker-compose.yml` (dev) ou `docker-compose.prod.yml` (produção) na raiz do projeto.

---

## Módulos

### `accounts/`
- **Custom User Model** com UUID como PK, `display_name`, `avatar`, birth date, gender
- **JWT RS256**: backend assina com `private.pem`
- **OTP por e-mail**: verificação de conta e reset de senha (expiração configurável)
- **TOTP / 2FA**: autenticação em dois fatores (Google Authenticator, Authy). Segredo armazenado encriptado (Fernet). Fluxo: setup → enable → verify. Oito códigos de recuperação de uso único. Login com 2FA emite `totp_token` temporário; usuário completa em `/accounts/2fa/verify/`.
- **Login lockout**: após `ACCOUNTS_LOGIN_MAX_FAILURES` (padrão: 5) falhas consecutivas a conta é bloqueada por `ACCOUNTS_LOGIN_LOCKOUT_SECONDS` (padrão: 900s).
- **OAuth**: Google e Discord via `/accounts/oauth/`
- **Amizades**: sistema de friendship (pending, accepted, blocked)
- **Web Push**: subscrições VAPID por dispositivo
- **Audit Log**: registra banimentos, mudanças de grupo e ações administrativas
- **SMTP Admin**: configuração de SMTP armazenada no banco, criptografada com Fernet
- **Diagnósticos**: endpoint admin com status de SMTP, Redis, Postgres e versão do app

### `blog/`
- Posts com workflow: `draft → pending (review) → rejected → scheduled → published → archived`
- Categorias, tags (M2M), comentários com aprovação
- Controle de visibilidade (`is_public`, `is_featured`)
- Contagem de visualizações e tempo estimado de leitura
- **SEO**: campos `meta_title`, `meta_description`, `meta_keywords`
- **Revisões**: `PostRevision` criado antes de cada update. Endpoints: `GET /<slug>/history/` e `POST /<slug>/revert/`
- **Imagens**: upload via `/blog/media/images/` (delegado ao app `media/`)

### `forum/`
- Categorias, tópicos e respostas com contadores atômicos denormalizados
- Moderação: fixar, fechar, arquivar, ocultar resposta, marcar solução
- Reações em tópicos e respostas (like, dislike, heart, laugh, wow)
- Busca por texto com `SearchFilter` (full-text PostgreSQL ou fallback icontains)
- **WebSocket em tempo real** via Django Channels (`/ws/forum/topics/<slug>/`)

### `media/`
- `MediaFile`: modelo com `ImageField`, UUID como PK, `alt_text`, `original_filename`, `uploaded_by`
- Filename gerado com UUID (`uploads/<uuid><ext>`) — sem colisão, sem path traversal
- Upload aceita apenas JPEG, PNG, WebP, GIF, AVIF · tamanho máximo: 10 MB
- Permissões: leitura exige `IsAuthenticated`; escrita/deleção exige `IsEditorOrAdmin` (staff ou grupo `editors`)
- Rota principal: `/api/v1/media/files/`
- Alias do blog (somente upload/listagem): `/api/v1/blog/media/images/`
- URL de mídia: relativa (`/media/uploads/<uuid>.ext`) quando `SITE_URL` não está definido; absoluta quando está

### `common/`
- `UUIDModel`: modelo base com UUID como PK para todos os modelos
- Health checks: `/api/health/live/`, `/api/health/ready/`, `/api/health/version/`
- Feature flags, paginação, throttling customizado, métricas Prometheus
- Comando de seed: `python manage.py seed`

---

## API — Referência Completa

Base URL (dev): `http://localhost:8006/api/v1/`

> **Variáveis de ambiente relevantes para mídia:**
> - `SITE_URL` — URL pública base do backend (ex.: `https://projetoraven.cloud`). Quando definida, as URLs de mídia retornadas pela API são absolutas (`SITE_URL + /media/...`). Quando vazia (dev), retornam caminhos relativos (`/media/...`) que o Next.js proxy resolve.
> - `FILE_UPLOAD_MAX_MEMORY_SIZE` / `DATA_UPLOAD_MAX_MEMORY_SIZE` — limite em bytes para uploads (padrão: 10 MB).
> - `MEDIA_ROOT` — diretório local onde os arquivos são armazenados (padrão: `Backend/mediafiles/`).

### Accounts

| Método | Endpoint | Acesso | Descrição |
|---|---|---|---|
| POST | `/accounts/register/` | Público | Registro de usuário |
| POST | `/accounts/login/` | Público | Login — retorna `access` + `refresh` JWT |
| POST | `/accounts/token/refresh/` | Público | Renova access token |
| POST | `/accounts/logout/` | Auth | Blacklist do refresh token |
| GET/PUT | `/accounts/profile/` | Auth | Perfil do usuário logado |
| GET | `/accounts/me/` | Auth | Dados completos do usuário autenticado |
| GET | `/accounts/profile/<username>/` | Público | Perfil público (username, display_name, avatar) |
| POST | `/accounts/avatar/` | Auth | Upload/delete de avatar |
| POST | `/accounts/change-password/` | Auth | Troca de senha |
| POST | `/accounts/change-username/` | Auth | Troca de username |
| DELETE | `/accounts/delete/` | Auth | Anonimiza e desativa a conta |
| POST | `/accounts/email/verify/` | Público | Verificação por OTP |
| POST | `/accounts/email/verify/resend/` | Auth | Reenviar código de verificação |
| POST | `/accounts/password-reset/` | Público | Solicitar reset por OTP |
| POST | `/accounts/password-reset/confirm/` | Público | Confirmar reset com OTP |
| GET | `/accounts/admin/analytics/` | Admin | Métricas de usuários e conteúdo |
| GET | `/accounts/admin/diagnostics/` | Admin | Diagnóstico completo do sistema |
| GET/POST | `/accounts/admin/users/` | Admin | CRUD de usuários |
| POST | `/accounts/admin/users/<id>/ban/` | Admin | Banir usuário |
| POST | `/accounts/admin/users/<id>/unban/` | Admin | Desbanir usuário |
| GET | `/accounts/admin/audit/` | Admin | Log de auditoria |
| GET/POST | `/accounts/social/friendships/` | Auth | Listar e solicitar amizades |
| POST | `/accounts/social/friendships/<id>/` | Auth | Aceitar/bloquear amizade |

### 2FA / TOTP

| Método | Endpoint | Acesso | Descrição |
|---|---|---|---|
| POST | `/accounts/2fa/setup/` | Auth | Gera secret TOTP + QR code |
| POST | `/accounts/2fa/enable/` | Auth | Confirma primeiro código para ativar 2FA |
| POST | `/accounts/2fa/disable/` | Auth | Desativa 2FA (exige código válido) |
| POST | `/accounts/2fa/verify/` | Público | Etapa 2 do login: envia `totp_token` + `code` |
| POST | `/accounts/2fa/recovery-codes/` | Auth | Regenera 8 códigos de recuperação |

### OAuth

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/accounts/oauth/<provider>/` | Inicia fluxo OAuth (Google, Discord) |
| GET | `/accounts/oauth/<provider>/callback/` | Callback do provider |
| GET | `/accounts/oauth/connected/` | Lista contas OAuth vinculadas |

### Blog

| Método | Endpoint | Acesso | Descrição |
|---|---|---|---|
| GET | `/blog/public/posts/` | Público | Posts publicados e públicos (paginado) |
| GET | `/blog/public/posts/<slug>/` | Público | Detalhe do post |
| GET | `/blog/public/posts/featured/` | Público | Posts destacados |
| GET | `/blog/public/posts/search/?q=` | Público | Busca full-text |
| GET | `/blog/public/categories/` | Público | Categorias |
| GET | `/blog/public/tags/` | Público | Tags |
| GET | `/blog/public/comments/?post_slug=` | Público | Comentários aprovados |
| POST | `/blog/public/comments/` | Público/Auth | Criar comentário |
| * | `/blog/posts/` | Editor | CRUD de posts + workflow |
| POST | `/blog/posts/<slug>/publish/` | Editor | Publicar post |
| POST | `/blog/posts/<slug>/archive/` | Editor | Arquivar post |
| POST | `/blog/posts/<slug>/reject/` | Editor | Rejeitar post |
| POST | `/blog/posts/<slug>/submit/` | Auth | Enviar para revisão |
| GET | `/blog/posts/<slug>/history/` | Editor | Histórico de revisões |
| POST | `/blog/posts/<slug>/revert/` | Editor | Reverter para revisão anterior |
| POST | `/blog/posts/bulk-publish/` | Editor | Publicar múltiplos posts |
| GET | `/blog/posts/analytics/` | Editor | Estatísticas de posts |
| * | `/blog/media/images/` | Editor | Upload e listagem de imagens |
| POST | `/blog/comments/<id>/approve/` | Editor | Aprovar comentário |
| DELETE | `/blog/comments/<id>/` | Editor | Deletar comentário |
| GET | `/blog/comments/pending/` | Editor | Fila de moderação |

### Forum

| Método | Endpoint | Acesso | Descrição |
|---|---|---|---|
| GET | `/forum/public/categories/` | Público | Categorias ativas |
| GET | `/forum/public/topics/` | Público | Lista de tópicos |
| GET | `/forum/public/topics/<slug>/with_replies/` | Público | Tópico com replies |
| GET | `/forum/public/topics/<slug>/reactions/` | Público | Reações do tópico |
| GET | `/forum/public/topics/popular/` | Público | Tópicos mais populares |
| GET | `/forum/public/replies/?topic=<slug>` | Público | Replies de um tópico |
| POST | `/forum/topics/` | Auth | Criar tópico |
| PUT/PATCH | `/forum/topics/<slug>/` | Autor/Mod | Editar tópico |
| DELETE | `/forum/topics/<slug>/` | Autor/Mod | Deletar tópico |
| POST | `/forum/topics/<slug>/pin/` | Mod | Fixar tópico |
| POST | `/forum/topics/<slug>/unpin/` | Mod | Desafixar tópico |
| POST | `/forum/topics/<slug>/close/` | Mod | Fechar tópico |
| POST | `/forum/topics/<slug>/open/` | Mod | Reabrir tópico |
| POST | `/forum/topics/<slug>/archive/` | Mod | Arquivar tópico |
| POST | `/forum/replies/` | Auth | Criar reply |
| PUT/PATCH | `/forum/replies/<id>/` | Autor/Mod | Editar reply |
| DELETE | `/forum/replies/<id>/` | Autor/Mod | Deletar reply |
| POST | `/forum/replies/<id>/react/` | Auth | Reagir a reply |
| POST | `/forum/replies/<id>/mark_solution/` | Mod | Marcar como solução |
| POST | `/forum/replies/<id>/hide/` | Mod | Ocultar reply |
| POST | `/forum/replies/<id>/unhide/` | Mod | Reexibir reply |
| POST | `/forum/topic-reactions/` | Auth | Reagir a tópico |

### Media

| Método | Endpoint | Acesso | Descrição |
|---|---|---|---|
| GET | `/media/files/` | Auth | Listar arquivos enviados |
| POST | `/media/files/` | Editor/Admin | Upload de imagem (máx. 10 MB) |
| DELETE | `/media/files/<id>/` | Editor/Admin | Deletar arquivo |

### Health

| Endpoint | Descrição |
|---|---|
| `GET /api/health/live/` | Liveness — 200 se o processo está vivo |
| `GET /api/health/ready/` | Readiness — 200 se DB + Redis estão acessíveis |
| `GET /api/health/version/` | Versão, SHA e data do build |

### WebSocket

| Endpoint | Descrição |
|---|---|
| `ws(s)://<host>/ws/forum/topics/<slug>/` | Canal de tópico em tempo real (replies, reações) |

---

## Comandos de Gerenciamento

```bash
# Popula o banco com dados de desenvolvimento (usuários, posts, tópicos fictícios)
python manage.py seed

# Popula o banco em produção de forma idempotente (categorias, superusuário, sem dados fictícios)
python manage.py seed_prod

# Remove OTPs expirados
python manage.py cleanup_otps --days 7

# Garante slugs únicos de tópicos no fórum
python manage.py ensure_unique_topic_slugs

# Poda PostViews com mais de 90 dias
python manage.py prune_post_views
```

---

## Testes

```bash
cd Backend
source venv/Scripts/activate   # Windows
# source venv/bin/activate     # Linux/Mac

pytest -q                                        # todos os testes
pytest apps/blog/ -q                             # módulo específico
pytest --cov=apps --cov-report=term-missing      # com cobertura
```

Suítes disponíveis:

| App | Arquivos de teste |
|---|---|
| `accounts/` | `test_serializers.py` |
| `blog/` | `test_models.py`, `test_serializers.py`, `test_views.py` |
| `forum/` | `test_services.py`, `test_serializers.py`, `test_views.py` |
| `common/` | `test_html_sanitizer.py` |
