# Deploy — Guia Completo de Produção

Este guia cobre o deploy do **Projeto Raven** em um servidor Linux usando Docker Compose e Cloudflare Tunnel.

---

## Arquitetura de produção

```
Internet
    │
    ▼
Cloudflare Tunnel (container já existente no servidor)
    │
    ├─ yourdomain.com        ──▶  localhost:3100  (Next.js — container frontend)
    ├─ yourdomain.com/api/   ──▶  localhost:8100  (Django — container django)
    └─ yourdomain.com/ws/    ──▶  localhost:8100  (Django WebSocket — NECESSÁRIO para o fórum)

Docker Compose (name: projetoraven)
    ├─ frontend   → porta 127.0.0.1:3100
    ├─ django     → porta 127.0.0.1:8100
    ├─ postgres   → rede interna apenas
    └─ redis      → rede interna apenas
```

> O Nginx **não é usado**. O Cloudflare Tunnel faz o papel de reverse proxy.
>
> O nome `projetoraven` no Compose isola containers, redes e volumes de outros projetos já em execução no servidor.

---

## Pré-requisitos do servidor

| Requisito | Versão mínima | Como verificar |
|---|---|---|
| Docker Engine | 24+ | `docker --version` |
| Docker Compose plugin (v2) | 2.20+ | `docker compose version` |
| openssl | qualquer | `openssl version` |
| curl | qualquer | `curl --version` |
| Cloudflare Tunnel | configurado e ativo | `docker ps \| grep cloudflared` |

---

## Passo 1 — Clonar o repositório

```bash
git clone <url-do-repositorio> ProjetoRaven
cd ProjetoRaven
```

---

## Passo 2 — Criar os arquivos de ambiente

### Backend

```bash
cp Backend/.env.prod.example Backend/.env.prod
nano Backend/.env.prod
```

Variáveis obrigatórias a preencher:

| Variável | Exemplo | Observação |
|---|---|---|
| `DJANGO_SECRET_KEY` | `python3 -c "import secrets; print(secrets.token_urlsafe(64))"` | Gere com o comando |
| `POSTGRES_PASSWORD` | senha forte | Use um gerador de senhas |
| `REDIS_PASSWORD` | senha forte | Preencha em `REDIS_URL` e `CHANNEL_LAYER_URL` também |
| `ALLOWED_HOSTS` | `seudominio.com,www.seudominio.com` | |
| `SITE_URL` | `https://seudominio.com` | |
| `CORS_ALLOWED_ORIGINS` | `https://seudominio.com` | |
| `CSRF_TRUSTED_ORIGINS` | `https://seudominio.com` | |
| `EMAIL_SETTINGS_ENCRYPTION_SALT` | string aleatória de 32+ chars | |
| `TOTP_ENCRYPTION_KEY` | `python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` | Criptografa segredos TOTP no banco |
| `SECURE_SSL_REDIRECT` | `False` | Cloudflare já termina TLS — Django não deve redirecionar |
| `DJANGO_ADMIN_EMAIL` | `admin@seudominio.com` | Cria superadmin automaticamente no boot |
| `DJANGO_ADMIN_USERNAME` | `admin` | |
| `DJANGO_ADMIN_PASSWORD` | senha forte | |
| `ADMIN_ALLOWED_IPS` | `1.2.3.4` (opcional) | Restringe `/admin/` e `/api/schema/` por IP |
| `SCHEMA_ENABLED` | `False` | Desativa Swagger/Redoc em produção |
| `VAPID_PUBLIC_KEY` | ver Passo 4 | |
| `VAPID_PRIVATE_KEY` | ver Passo 4 | |
| `VAPID_ADMIN_EMAIL` | `admin@seudominio.com` | |

**Portas** — ajuste se já houver serviços nessas portas no servidor:

```bash
FRONTEND_PORT=3100   # Cloudflare roteia yourdomain.com → localhost:3100
DJANGO_PORT=8100     # Cloudflare roteia /api/ e /ws/ → localhost:8100
```

### Frontend

```bash
cp frontend/.env.prod.example frontend/.env.prod
nano frontend/.env.prod
```

| Variável | Exemplo |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `https://seudominio.com` |
| `NEXT_PUBLIC_SITE_URL` | `https://seudominio.com` |
| `NEXT_PUBLIC_WS_BASE_URL` | `https://seudominio.com` |

> `NEXT_PUBLIC_*` são embutidas no bundle do browser em **build-time** — qualquer alteração exige rebuild da imagem.

---

## Passo 3 — Gerar chaves JWT RSA

As chaves são geradas **uma única vez** e persistem entre deploys.

```bash
mkdir -p Backend/keys
openssl genrsa -out Backend/keys/private.pem 2048
openssl rsa -in Backend/keys/private.pem -pubout -out Backend/keys/public.pem
chmod 600 Backend/keys/private.pem
```

> Os arquivos `*.pem` estão no `.gitignore`. **Nunca os comite no repositório.**
>
> O `deploy.sh` gera as chaves automaticamente se elas não existirem.

---

## Passo 4 — Gerar chaves VAPID (Web Push)

```bash
npx web-push generate-vapid-keys
```

Saída esperada:

```
Public Key:
BExemplo...

Private Key:
exemplo...
```

Preencha em `Backend/.env.prod`:

```bash
VAPID_PUBLIC_KEY=BExemplo...
VAPID_PRIVATE_KEY=exemplo...
VAPID_ADMIN_EMAIL=admin@seudominio.com
```

---

## Passo 5 — Configurar o Cloudflare Tunnel

No painel do Cloudflare → **Zero Trust → Networks → Tunnels**, configure as rotas:

| Hostname público | Serviço interno |
|---|---|
| `seudominio.com` | `http://localhost:3100` |
| `seudominio.com/ws/*` | `http://localhost:8100` |
| `seudominio.com/api/*` | `http://localhost:8100` *(opcional — o Next.js já faz proxy)* |

> A rota `/ws/*` é **obrigatória** para o fórum em tempo real funcionar. O Next.js em modo standalone não consegue fazer proxy de WebSocket.

---

## Passo 6 — Fazer o deploy

### Opção A — Script automatizado (recomendado)

```bash
chmod +x deploy.sh
./deploy.sh
```

O script executa:
1. Verifica Docker, docker compose e openssl
2. Valida os arquivos `.env.prod` (detecta `CHANGE_ME` não preenchidos)
3. Gera as chaves RSA se não existirem
4. Pede confirmação antes de iniciar
5. Faz pull das imagens base (postgres, redis)
6. Constrói as imagens (backend + frontend)
7. Sobe todos os containers com `up -d`
8. Aguarda cada container ficar `healthy`
9. Testa os endpoints HTTP de health check
10. Exibe o status final de todos os containers

### Opção B — Manual

```bash
# Carregar variáveis de ambiente
set -a
source Backend/.env.prod
source frontend/.env.prod
set +a

# Construir imagens
docker compose -f docker-compose.prod.yml build

# Subir serviços
docker compose -f docker-compose.prod.yml up -d

# Verificar status
docker compose -f docker-compose.prod.yml ps
```

---

## Passo 7 — Verificar o deploy

```bash
# Status dos containers
docker compose -f docker-compose.prod.yml ps

# Health checks da API
curl http://127.0.0.1:8100/api/health/live/
curl http://127.0.0.1:8100/api/health/ready/

# Frontend
curl -I http://127.0.0.1:3100/

# Logs em tempo real
docker compose -f docker-compose.prod.yml logs -f

# Logs de um serviço específico
docker compose -f docker-compose.prod.yml logs -f django
docker compose -f docker-compose.prod.yml logs -f frontend
```

---

## Passo 8 — Criar o primeiro administrador (somente no primeiro deploy)

### Opção A — Automático (recomendado)

Defina as variáveis em `Backend/.env.prod` antes do deploy:

```bash
DJANGO_ADMIN_EMAIL=admin@seudominio.com
DJANGO_ADMIN_USERNAME=admin
DJANGO_ADMIN_PASSWORD=senhaForte123!
```

O `seed_prod` cria/atualiza o usuário automaticamente na inicialização do container.

### Opção B — Manual

Se as variáveis não estiverem definidas, siga o fluxo após o deploy:

1. Registre uma conta normalmente pelo site em `/register`
2. Execute o comando de promoção:

```bash
docker compose -f docker-compose.prod.yml exec django \
  python manage.py promote_superadmin seu@email.com
```

O comando concede `is_staff`, `is_superuser` e todos os grupos (`members`, `blog_editors`, `forum_moderators`, `admins`).

> Em deploys subsequentes (`git pull` + rebuild) este passo pode ser ignorado — o banco e as permissões são preservados.

---

## Atualizar o deploy (nova versão)

```bash
# Puxar as mudanças
git pull

# Reconstruir e reiniciar
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# Ou usar o deploy.sh novamente (faz tudo acima + health checks)
./deploy.sh
```

> O Django executa `migrate` automaticamente na inicialização — não é necessário rodar manualmente.

---

## Operações comuns

```bash
# Reiniciar um serviço específico
docker compose -f docker-compose.prod.yml restart django

# Parar todos os containers (mantém volumes)
docker compose -f docker-compose.prod.yml down

# Parar e remover volumes (DESTRUTIVO — apaga o banco e redis)
docker compose -f docker-compose.prod.yml down -v

# Executar comando no container django
docker compose -f docker-compose.prod.yml exec django python manage.py shell

# Ver uso de recursos
docker stats

# Limpar imagens não utilizadas
docker image prune -f
```

---

## Volumes persistentes

| Volume | Conteúdo |
|---|---|
| `projetoraven_postgres_data` | Banco de dados PostgreSQL |
| `projetoraven_redis_data` | Cache e filas Redis |
| `projetoraven_media_files` | Uploads de usuários (imagens) |
| `projetoraven_static_files` | Arquivos estáticos do Django |

> Os volumes têm o prefixo `projetoraven_` (definido por `name: projetoraven` no Compose) para não conflitar com outros projetos no servidor.

---

## Backup

Use o script `backup.sh` na raiz do projeto:

```bash
chmod +x backup.sh

./backup.sh              # backup completo: banco + mediafiles
./backup.sh --db-only    # somente banco de dados

# Restaurar um backup específico
./backup.sh --restore backups/db_20260525_143000.sql.gz
```

Os backups são salvos em `backups/` (ignorado pelo git) e os últimos 10 são mantidos automaticamente.

### Backup manual

```bash
# Dump manual do banco
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U raven projeto_raven | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Restore manual
gunzip -c backup_YYYYMMDD_HHMMSS.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U raven projeto_raven
```

### Agendamento automático (cron)

Para fazer backups diários às 3h no servidor:

```bash
crontab -e
# Adicione:
0 3 * * * cd /path/to/ProjetoRaven && ./backup.sh --db-only >> /var/log/raven-backup.log 2>&1
```

---

## Troubleshooting

### Container django não sobe

```bash
docker compose -f docker-compose.prod.yml logs django
```

Causas comuns:
- `POSTGRES_PASSWORD` diferente entre `Backend/.env.prod` e o volume existente → remova o volume `projetoraven_postgres_data` e recrie
- `JWT_PRIVATE_KEY_PATH` ou `JWT_PUBLIC_KEY_PATH` incorretos → verifique se os arquivos existem em `Backend/keys/`
- `DJANGO_SECRET_KEY` não preenchido → verifique `Backend/.env.prod`

### WebSocket não conecta

1. Confirme que a rota `/ws/*` está configurada no Cloudflare Tunnel apontando para `localhost:8100` (Django), **não** `localhost:3100` (Next.js)
2. Verifique se `NEXT_PUBLIC_WS_BASE_URL` está correto no `frontend/.env.prod`
3. Verifique nos logs do django se a conexão está chegando:
   ```bash
   docker compose -f docker-compose.prod.yml logs -f django | grep ws
   ```

### Frontend com imagens quebradas

Confirme que `NEXT_PUBLIC_API_BASE_URL` aponta para o domínio público correto. Esta variável é **embutida no build** — se estiver errada, é necessário rebuild:

```bash
# Editar frontend/.env.prod
docker compose -f docker-compose.prod.yml build frontend
docker compose -f docker-compose.prod.yml up -d frontend
```

### Porta já em uso no servidor

Edite `Backend/.env.prod` e mude `FRONTEND_PORT` e/ou `DJANGO_PORT`:

```bash
FRONTEND_PORT=3200   # nova porta para o frontend
DJANGO_PORT=8200     # nova porta para o django
```

Atualize as rotas correspondentes no painel do Cloudflare Tunnel.
