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

## Passo 2 — Executar o setup interativo

```bash
chmod +x setup.sh
./setup.sh
```

O script faz as perguntas abaixo e configura tudo automaticamente:

| Pergunta | Padrão |
|---|---|
| Domínio (sem https://) | `seudominio.com` |
| Porta do frontend no host | `3100` |
| Porta do Django no host | `8100` |
| E-mail do admin | `admin@seudominio.com` |
| Username do admin | `admin` |
| Senha do admin | — |
| Gerar chaves VAPID? | S |
| IPs restritos para /admin/ | (opcional) |
| Sentry DSN | (opcional) |
| Criar usuário suporte? | N |

O que o `setup.sh` executa automaticamente:

- Gera `DJANGO_SECRET_KEY`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `EMAIL_SETTINGS_ENCRYPTION_SALT`, `TOTP_ENCRYPTION_KEY`
- Gera as chaves JWT RSA 2048-bit em `Backend/keys/`
- Gera as chaves VAPID (via python3-cryptography ou npx)
- Escreve `Backend/.env.prod` completo
- Escreve `frontend/.env.prod` completo
- Exibe o resumo das rotas a configurar no Cloudflare
- Oferece executar `./deploy.sh` imediatamente

> O `setup.sh` só precisa rodar **uma vez**. Para deploys subsequentes use apenas `./deploy.sh`.

---

## Passo 3 — Configurar o Cloudflare Tunnel

No painel do Cloudflare → **Zero Trust → Networks → Tunnels**, configure as rotas:

| Hostname público | Serviço interno |
|---|---|
| `seudominio.com` | `http://localhost:3100` |
| `seudominio.com/ws/*` | `http://localhost:8100` |
| `seudominio.com/api/*` | `http://localhost:8100` *(opcional — o Next.js já faz proxy)* |

> A rota `/ws/*` é **obrigatória** para o fórum em tempo real funcionar. O Next.js em modo standalone não consegue fazer proxy de WebSocket.

---

## Passo 4 — Fazer o deploy

### Opção A — Script automatizado (recomendado)

```bash
chmod +x deploy.sh
./deploy.sh
```

Flags úteis:

```bash
./deploy.sh --yes                  # sem prompts
./deploy.sh --reset-volumes        # DESTRUTIVO: down -v antes do deploy
./deploy.sh --no-pull              # não faz pull de imagens base
./deploy.sh --no-build             # só reinicia containers (usa imagens existentes)
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

### Observação: bootstrap no container Django

O container `django` executa automaticamente as tarefas de bootstrap na inicialização via `python manage.py bootstrap_prod`:
- `migrate` (controlado por `RUN_MIGRATE=true|false`)
- `seed_prod` (controlado por `RUN_SEED_PROD=true|false`)
- `collectstatic` (controlado por `RUN_COLLECTSTATIC=true|false`)

Em PostgreSQL, o bootstrap usa um advisory lock (`BOOTSTRAP_LOCK_ID`) para evitar concorrência quando houver mais de um container Django subindo ao mesmo tempo.

> Dica: após o primeiro deploy, defina `RUN_SEED_PROD=false` para evitar rodar seed em todo restart.

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

## Passo 5 — Verificar o deploy

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

## Passo 6 — Primeiro administrador

O `setup.sh` já configura as variáveis `DJANGO_ADMIN_*` — o admin é criado automaticamente no primeiro boot pelo `seed_prod`. Nenhuma ação necessária.

### Usuário de suporte (opcional)

O deploy pode criar um usuário de suporte automaticamente no boot, mas ele vem **desativado por padrão**.

Para habilitar, configure no `Backend/.env.prod`:
- `CREATE_SUPPORT_USER=true`
- `SUPPORT_USER_EMAIL=...`
- `SUPPORT_USER_USERNAME=...`
- `SUPPORT_USER_PASSWORD=...` (senha forte)

> Se o `DJANGO_ADMIN_USERNAME` colidir com o username do suporte (ou qualquer usuário existente), o `seed_prod` gera automaticamente um username alternativo para o admin (ex.: `suporte-admin`) para evitar falha no boot.

Se precisar promover manualmente um usuário já registrado:

1. Registre uma conta normalmente pelo site em `/register`
2. Execute o comando de promoção:

```bash
docker compose -f docker-compose.prod.yml exec django \
  python manage.py promote_superadmin seu@email.com
```

O comando concede `is_staff`, `is_superuser` e todos os grupos (`members`, `blog_editors`, `forum_moderators`, `admins`).

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
