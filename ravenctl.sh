#!/usr/bin/env bash
set -euo pipefail

G='\033[0;32m'; BG='\033[1;32m'; DG='\033[2;32m'
Y='\033[1;33m'; R='\033[0;31m'; W='\033[1;37m'; RS='\033[0m'

ok()   { printf "${BG}  ✓ ${G}%s${RS}\n" "$1"; }
warn() { printf "${Y}  ⚠ %s${RS}\n" "$1"; }
err()  { printf "${R}  ✗ %s${RS}\n" "$1"; exit 1; }

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
COMPOSE=(docker compose -f "$COMPOSE_FILE")
BACKUP_DIR="${BACKUP_DIR:-backups}"
KEEP_LAST="${KEEP_LAST:-10}"

if [ ! -f "$COMPOSE_FILE" ]; then
  err "Compose não encontrado: $COMPOSE_FILE"
fi

load_env() {
  if [ -f "Backend/.env.prod" ]; then
    set -a
    # shellcheck disable=SC1091
    source Backend/.env.prod
    set +a
  fi
  POSTGRES_USER="${POSTGRES_USER:-raven}"
  POSTGRES_DB="${POSTGRES_DB:-projeto_raven}"
}

usage() {
  cat << EOF
Uso:
  ./ravenctl.sh backup [--db-only] [--media-only] [--keep N]
  ./ravenctl.sh restore (--from TS | --db FILE) [--with-media] [--media FILE] [--yes]
  ./ravenctl.sh list
  ./ravenctl.sh verify [--from TS | --db FILE | --media FILE]

Env:
  COMPOSE_FILE=docker-compose.prod.yml
  BACKUP_DIR=backups
  KEEP_LAST=10
EOF
}

confirm() {
  local prompt="$1"
  local expected="${2:-}"
  local auto="${3:-false}"
  if [ "$auto" = "true" ]; then
    ok "Modo automático — confirmação ignorada"
    return 0
  fi
  if [ -n "$expected" ]; then
    printf "${Y}  %s Digite %s para confirmar: ${RS}" "$prompt" "$expected"
    read -r typed
    [ "$typed" = "$expected" ] || err "Cancelado"
    return 0
  fi
  printf "${Y}  %s [s/N] ${RS}" "$prompt"
  read -r ans
  case "$ans" in
    [sS]|[sS][iI][mM]) return 0 ;;
    *) err "Cancelado" ;;
  esac
}

ensure_postgres_up() {
  "${COMPOSE[@]}" up -d postgres >/dev/null
}

backup_db() {
  local ts="$1"
  local out="$BACKUP_DIR/db_${ts}.sql.gz"
  printf "${G}  Dump do banco (%s)...${RS}\n" "$POSTGRES_DB"
  "${COMPOSE[@]}" exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$out"
  ok "DB: $out ($(du -sh "$out" | cut -f1))"
}

backup_media() {
  local ts="$1"
  local out="$BACKUP_DIR/media_${ts}.tar.gz"
  printf "${G}  Backup da mídia...${RS}\n"
  if "${COMPOSE[@]}" run --rm --no-deps --entrypoint "" django sh -c "tar czf - -C /app mediafiles" > "$out" 2>/dev/null; then
    ok "Mídia: $out ($(du -sh "$out" | cut -f1))"
  else
    rm -f "$out"
    warn "Falha ao fazer backup de mídia (volume pode estar vazio)"
  fi
}

trim_backups() {
  local pattern="$1"
  local keep="$2"
  local excess
  excess=$(ls -t "$BACKUP_DIR"/$pattern 2>/dev/null | tail -n +$((keep + 1)) || true)
  if [ -n "$excess" ]; then
    echo "$excess" | xargs rm -f
  fi
}

restore_db() {
  local file="$1"
  ensure_postgres_up
  printf "${G}  Restaurando DB: %s${RS}\n" "$file"
  gunzip -c "$file" | "${COMPOSE[@]}" exec -T postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB"
  ok "DB restaurado"
}

restore_media() {
  local file="$1"
  printf "${G}  Restaurando mídia: %s${RS}\n" "$file"
  cat "$file" | "${COMPOSE[@]}" run --rm --no-deps --entrypoint "" django sh -c "rm -rf /app/mediafiles/* && tar xzf - -C /app"
  ok "Mídia restaurada"
}

verify_db() {
  local file="$1"
  printf "${G}  Verificando DB gzip: %s${RS}\n" "$file"
  gunzip -t "$file"
  ok "DB OK"
}

verify_media() {
  local file="$1"
  printf "${G}  Verificando tar: %s${RS}\n" "$file"
  tar -tzf "$file" >/dev/null
  ok "Mídia OK"
}

cmd="${1:-}"
case "$cmd" in
  ""|help|-h|--help) usage; exit 0 ;;
esac
shift || true

load_env
mkdir -p "$BACKUP_DIR"

case "$cmd" in
  backup)
    ts="$(date +%Y%m%d_%H%M%S)"
    db_only=false
    media_only=false
    keep="$KEEP_LAST"
    while [ $# -gt 0 ]; do
      case "$1" in
        --db-only) db_only=true; shift ;;
        --media-only) media_only=true; shift ;;
        --keep) keep="${2:-}"; shift 2 ;;
        *) err "Argumento inválido: $1" ;;
      esac
    done

    printf "\n${BG}  ◈ ${W}BACKUP — %s${RS}\n\n" "$(date '+%Y-%m-%d %H:%M:%S')"
    if [ "$media_only" != true ]; then
      backup_db "$ts"
      trim_backups "db_*.sql.gz" "$keep"
    fi
    if [ "$db_only" != true ]; then
      backup_media "$ts"
      trim_backups "media_*.tar.gz" "$keep"
    fi
    ;;

  restore)
    from=""
    db_file=""
    media_file=""
    with_media=false
    yes=false

    while [ $# -gt 0 ]; do
      case "$1" in
        --from) from="${2:-}"; shift 2 ;;
        --db) db_file="${2:-}"; shift 2 ;;
        --media) media_file="${2:-}"; shift 2 ;;
        --with-media) with_media=true; shift ;;
        --yes) yes=true; shift ;;
        *) err "Argumento inválido: $1" ;;
      esac
    done

    if [ -n "$from" ]; then
      db_file="${db_file:-$BACKUP_DIR/db_${from}.sql.gz}"
      if [ "$with_media" = true ] && [ -z "$media_file" ]; then
        media_file="$BACKUP_DIR/media_${from}.tar.gz"
      fi
    fi

    [ -n "$db_file" ] || err "Informe --from TS ou --db FILE"
    [ -f "$db_file" ] || err "Arquivo DB não encontrado: $db_file"

    confirm "ATENÇÃO: isso sobrescreve o banco '$POSTGRES_DB'." "RESTORE" "$yes"
    restore_db "$db_file"

    if [ "$with_media" = true ]; then
      [ -n "$media_file" ] || err "Informe --media FILE ou use --from TS"
      [ -f "$media_file" ] || err "Arquivo mídia não encontrado: $media_file"
      confirm "ATENÇÃO: isso sobrescreve mediafiles." "RESTORE_MEDIA" "$yes"
      restore_media "$media_file"
    fi
    ;;

  list)
    printf "${DG}  %s${RS}\n" "Backups em: $BACKUP_DIR"
    ls -lht "$BACKUP_DIR"/ 2>/dev/null | grep -E '\.(sql\.gz|tar\.gz)$' || true
    ;;

  verify)
    from=""
    db_file=""
    media_file=""
    while [ $# -gt 0 ]; do
      case "$1" in
        --from) from="${2:-}"; shift 2 ;;
        --db) db_file="${2:-}"; shift 2 ;;
        --media) media_file="${2:-}"; shift 2 ;;
        *) err "Argumento inválido: $1" ;;
      esac
    done

    if [ -n "$from" ]; then
      db_file="${db_file:-$BACKUP_DIR/db_${from}.sql.gz}"
      media_file="${media_file:-$BACKUP_DIR/media_${from}.tar.gz}"
    fi

    if [ -n "$db_file" ]; then
      [ -f "$db_file" ] || err "Arquivo DB não encontrado: $db_file"
      verify_db "$db_file"
    fi
    if [ -n "$media_file" ]; then
      [ -f "$media_file" ] || err "Arquivo mídia não encontrado: $media_file"
      verify_media "$media_file"
    fi
    if [ -z "$db_file" ] && [ -z "$media_file" ]; then
      err "Informe --from TS ou --db FILE ou --media FILE"
    fi
    ;;

  *)
    err "Comando inválido: $cmd"
    ;;
esac

