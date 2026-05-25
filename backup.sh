#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  Projeto Raven — Backup Script
#
#  Uso:
#    ./backup.sh               # backup completo (DB + mediafiles)
#    ./backup.sh --db-only     # somente banco de dados
#    ./backup.sh --restore backups/db_20260525_143000.sql.gz
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

G='\033[0;32m'; BG='\033[1;32m'; DG='\033[2;32m'
Y='\033[1;33m'; R='\033[0;31m'; W='\033[1;37m'; RS='\033[0m'

ok()   { printf "${BG}  ✓ ${G}%s${RS}\n" "$1"; }
warn() { printf "${Y}  ⚠ %s${RS}\n" "$1"; }
err()  { printf "${R}  ✗ %s${RS}\n" "$1"; exit 1; }

BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
COMPOSE="docker compose -f docker-compose.prod.yml"
KEEP_LAST=10   # quantidade de backups DB a manter

# ── Verificações ──────────────────────────────────────────────────────────────
if [ ! -f "docker-compose.prod.yml" ]; then
  err "Execute a partir da raiz do projeto"
fi

mkdir -p "$BACKUP_DIR"

# Carregar variáveis do .env.prod
if [ -f "Backend/.env.prod" ]; then
  set -a
  # shellcheck disable=SC1091
  source Backend/.env.prod
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:-raven}"
POSTGRES_DB="${POSTGRES_DB:-projeto_raven}"

# ── Modo restore ──────────────────────────────────────────────────────────────
if [ "${1:-}" = "--restore" ]; then
  RESTORE_FILE="${2:-}"
  [ -z "$RESTORE_FILE" ] && err "Informe o arquivo: ./backup.sh --restore backups/db_YYYYMMDD_HHMMSS.sql.gz"
  [ ! -f "$RESTORE_FILE" ] && err "Arquivo não encontrado: $RESTORE_FILE"

  printf "${Y}  ⚠  ATENÇÃO: Isso sobrescreve o banco '%s'. Continuar? [s/N] ${RS}" "$POSTGRES_DB"
  read -r CONFIRM
  case "$CONFIRM" in
    [sS]|[sS][iI][mM]) ;;
    *) printf "${Y}  Restore cancelado.${RS}\n"; exit 0 ;;
  esac

  printf "${G}  Restaurando %s...${RS}\n" "$RESTORE_FILE"
  gunzip -c "$RESTORE_FILE" | $COMPOSE exec -T postgres \
    psql -U "$POSTGRES_USER" "$POSTGRES_DB"
  ok "Banco restaurado de $RESTORE_FILE"
  exit 0
fi

DB_ONLY="${1:-}"

# ── Backup do banco de dados ──────────────────────────────────────────────────
printf "\n${BG}  ◈ ${W}BACKUP — %s${RS}\n\n" "$(date '+%Y-%m-%d %H:%M:%S')"

DB_FILE="$BACKUP_DIR/db_${TIMESTAMP}.sql.gz"
printf "${G}  Fazendo dump de '%s'...${RS}\n" "$POSTGRES_DB"
$COMPOSE exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$DB_FILE"

DB_SIZE=$(du -sh "$DB_FILE" | cut -f1)
ok "Banco salvo: $DB_FILE ($DB_SIZE)"

# Remover backups antigos (manter os últimos $KEEP_LAST)
EXCESS=$(ls -t "$BACKUP_DIR"/db_*.sql.gz 2>/dev/null | tail -n +$((KEEP_LAST + 1)))
if [ -n "$EXCESS" ]; then
  echo "$EXCESS" | xargs rm -f
  warn "Backups antigos removidos (mantendo últimos $KEEP_LAST)"
fi

# ── Backup dos arquivos de mídia ──────────────────────────────────────────────
if [ "$DB_ONLY" != "--db-only" ]; then
  MEDIA_FILE="$BACKUP_DIR/media_${TIMESTAMP}.tar.gz"
  printf "${G}  Compactando mediafiles...${RS}\n"

  # Copia os arquivos do volume para o host via container temporário
  $COMPOSE run --rm --no-deps --entrypoint "" django \
    tar czf - -C /app mediafiles 2>/dev/null > "$MEDIA_FILE" || {
      warn "Falha ao fazer backup de mediafiles (volume pode estar vazio)"
      rm -f "$MEDIA_FILE"
      MEDIA_FILE=""
    }

  if [ -n "${MEDIA_FILE:-}" ] && [ -f "$MEDIA_FILE" ]; then
    MEDIA_SIZE=$(du -sh "$MEDIA_FILE" | cut -f1)
    ok "Mídia salva:  $MEDIA_FILE ($MEDIA_SIZE)"
  fi
fi

# ── Sumário ───────────────────────────────────────────────────────────────────
echo
printf "${DG}  ── Backups recentes ──────────────────────────────────────────${RS}\n"
ls -lht "$BACKUP_DIR"/ 2>/dev/null | grep -E '\.(sql\.gz|tar\.gz)$' | head -10 | \
  while IFS= read -r line; do
    printf "${DG}    %s${RS}\n" "$line"
  done
echo
printf "${G}  ◈ Backup concluído — %s${RS}\n\n" "$(date '+%Y-%m-%d %H:%M:%S')"
