COMPOSE_DEV  = docker compose -f docker-compose.yml
# --project-name garante o prefixo "projetoraven-" mesmo se o diretório tiver outro nome
COMPOSE_PROD = docker compose -f docker-compose.prod.yml --project-name projetoraven

# ── Development ───────────────────────────────────────────────────────────────
.PHONY: dev
dev:
	$(COMPOSE_DEV) up -d

.PHONY: dev-logs
dev-logs:
	$(COMPOSE_DEV) logs -f

.PHONY: dev-down
dev-down:
	$(COMPOSE_DEV) down

# ── Production ────────────────────────────────────────────────────────────────
.PHONY: prod-check
prod-check:
	@test -f Backend/.env.prod   || (echo "ERROR: Backend/.env.prod missing — copy from Backend/.env.prod.example" && exit 1)
	@test -f frontend/.env.prod  || (echo "ERROR: frontend/.env.prod missing — copy from frontend/.env.prod.example" && exit 1)
	@test -f nginx/ssl/fullchain.pem || (echo "ERROR: nginx/ssl/fullchain.pem missing — add TLS certs" && exit 1)
	@echo "Pre-flight checks passed."

.PHONY: prod-build
prod-build: prod-check
	$(COMPOSE_PROD) build --pull

.PHONY: prod-up
prod-up: prod-check
	$(COMPOSE_PROD) up -d

.PHONY: prod-deploy
prod-deploy: prod-check prod-build prod-up
	$(COMPOSE_PROD) exec django python manage.py migrate --noinput
	$(COMPOSE_PROD) exec django python manage.py seed_prod

.PHONY: prod-reset
prod-reset:
	$(COMPOSE_PROD) down -v --remove-orphans

.PHONY: prod-redeploy
prod-redeploy: prod-reset prod-deploy
	@echo "Deploy complete."

.PHONY: seed-prod
seed-prod:
	$(COMPOSE_PROD) exec django python manage.py seed_prod

.PHONY: prod-logs
prod-logs:
	$(COMPOSE_PROD) logs -f

.PHONY: prod-down
prod-down:
	$(COMPOSE_PROD) down

.PHONY: prod-restart
prod-restart:
	$(COMPOSE_PROD) restart django frontend nginx

# ── Maintenance ───────────────────────────────────────────────────────────────
.PHONY: shell
shell:
	$(COMPOSE_PROD) exec django python manage.py shell

.PHONY: dbshell
dbshell:
	$(COMPOSE_PROD) exec postgres psql -U $${POSTGRES_USER:-raven} $${POSTGRES_DB:-projeto_raven}

.PHONY: backup
backup:
	$(COMPOSE_PROD) exec postgres pg_dump -U $${POSTGRES_USER:-raven} $${POSTGRES_DB:-projeto_raven} \
	  | gzip > backups/db_$$(date +%Y%m%d_%H%M%S).sql.gz
	@echo "Backup saved to backups/"

.PHONY: test-backend
test-backend:
	$(COMPOSE_DEV) exec django pytest --tb=short -q

.PHONY: secret
secret:
	@python3 -c "import secrets; print(secrets.token_urlsafe(64))"
