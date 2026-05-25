#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  ██████╗  █████╗ ██╗   ██╗███████╗███╗   ██╗
#  ██╔══██╗██╔══██╗██║   ██║██╔════╝████╗  ██║
#  ██████╔╝███████║██║   ██║█████╗  ██╔██╗ ██║
#  ██╔══██╗██╔══██║╚██╗ ██╔╝██╔══╝  ██║╚██╗██║
#  ██║  ██║██║  ██║ ╚████╔╝ ███████╗██║ ╚████║
#  ╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚═╝  ╚═══╝
#
#  P R O J E T O   R A V E N  —  D E P L O Y   S Y S T E M
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── ANSI ──────────────────────────────────────────────────────────────────────
G='\033[0;32m'    # green
BG='\033[1;32m'   # bright green
DG='\033[2;32m'   # dim green
Y='\033[1;33m'    # yellow (warnings)
R='\033[0;31m'    # red (errors)
C='\033[0;36m'    # cyan (accents)
W='\033[1;37m'    # white (highlights)
D='\033[2m'       # dim
RS='\033[0m'      # reset
CL='\033[2K\r'    # clear line + carriage return

# Matrix "glitch" chars for decorative use
GLITCH='░▒▓█▀▄▌▐■□▪▫◆◇●○◉'

# ── Cleanup trap ──────────────────────────────────────────────────────────────
_cleanup() {
  [ -n "${_spin_pid:-}" ] && { kill "$_spin_pid" 2>/dev/null || true; wait "$_spin_pid" 2>/dev/null || true; }
  printf '\033[?25h'  # restaura cursor
  printf "${RS}"      # reseta cores
}
trap '_cleanup' EXIT INT TERM

# ── Funções utilitárias ───────────────────────────────────────────────────────

# Spinner animado no estilo matrix
_spin_pid=""
start_spin() {
  local msg="$1"
  local frames=('⣾' '⣽' '⣻' '⢿' '⡿' '⣟' '⣯' '⣷')
  (
    i=0
    while true; do
      printf "${CL}${BG}  ${frames[$((i % 8))]}${G}  %s${RS}" "$msg"
      sleep 0.1
      i=$((i + 1))
    done
  ) &
  _spin_pid=$!
}

stop_spin() {
  local status="${1:-ok}"  # ok | fail
  if [ -n "$_spin_pid" ]; then
    kill "$_spin_pid" 2>/dev/null || true
    wait "$_spin_pid" 2>/dev/null || true
    _spin_pid=""
  fi
  if [ "$status" = "ok" ]; then
    printf "${CL}${BG}  ✓${RS}\n"
  else
    printf "${CL}${R}  ✗${RS}\n"
  fi
}

# Efeito typewriter
type_text() {
  local text="$1"
  local delay="${2:-0.03}"
  local color="${3:-$G}"
  printf "${color}"
  while IFS= read -r -n1 char; do
    printf "%s" "$char"
    sleep "$delay"
  done <<< "$text"
  printf "${RS}\n"
}

# Linha divisória
divider() {
  printf "${DG}  %s${RS}\n" "$(printf '─%.0s' {1..68})"
}

# Cabeçalho de seção
section() {
  echo
  divider
  printf "${BG}  ◈ ${W}%s${RS}\n" "$1"
  divider
}

# Status OK
ok() { printf "${BG}  ✓ ${G}%s${RS}\n" "$1"; }

# Status WARN
warn() { printf "${Y}  ⚠ %s${RS}\n" "$1"; }

# Status ERR (não aborta)
err_msg() { printf "${R}  ✗ %s${RS}\n" "$1"; }

# Abortagem fatal
fatal() {
  stop_spin "fail" 2>/dev/null || true
  echo
  printf "${R}  ╔══════════════════════════════════════╗${RS}\n"
  printf "${R}  ║  SYSTEM FAILURE: %-20s║${RS}\n" "$1"
  printf "${R}  ╚══════════════════════════════════════╝${RS}\n"
  echo
  exit 1
}

# ── Intro matrix rain (2 s) ───────────────────────────────────────────────────
matrix_intro() {
  local CHARS='01アイウエオカキクケコサシスセソタチツテトナニヌネノ'
  local cols
  cols=$(tput cols 2>/dev/null || echo 80)
  local lines=12
  printf '\033[?25l'  # hide cursor
  for _ in $(seq 1 $lines); do
    local line=""
    for _ in $(seq 1 $((cols / 2))); do
      local idx=$(( RANDOM % ${#CHARS} ))
      local ch="${CHARS:$idx:1}"
      # alternate bright / dim green
      if (( RANDOM % 3 == 0 )); then
        line+="${BG}${ch}${RS}"
      else
        line+="${DG}${ch}${RS}"
      fi
    done
    printf "%s\n" "$line"
    sleep 0.04
  done
  sleep 0.3
  printf '\033[?25h'  # show cursor
}

# ── Banner principal ──────────────────────────────────────────────────────────
show_banner() {
  clear
  printf "${BG}"
  cat << 'EOF'

  ██████╗  █████╗ ██╗   ██╗███████╗███╗   ██╗
  ██╔══██╗██╔══██╗██║   ██║██╔════╝████╗  ██║
  ██████╔╝███████║██║   ██║█████╗  ██╔██╗ ██║
  ██╔══██╗██╔══██║╚██╗ ██╔╝██╔══╝  ██║╚██╗██║
  ██║  ██║██║  ██║ ╚████╔╝ ███████╗██║ ╚████║
  ╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚═╝  ╚═══╝

EOF
  printf "${RS}"
  printf "${G}  %s${RS}\n" "P R O J E T O   R A V E N   —   D E P L O Y   S Y S T E M"
  printf "${DG}  %s${RS}\n" "$(date '+%Y-%m-%d %H:%M:%S %Z')  |  $(hostname)"
  divider
  echo
}

# ─────────────────────────────────────────────────────────────────────────────
#  INÍCIO
# ─────────────────────────────────────────────────────────────────────────────

matrix_intro
show_banner

type_text "  > Iniciando sequência de deploy..." 0.025 "$G"
sleep 0.4

# ─────────────────────────────────────────────────────────────────────────────
#  SEÇÃO 1 — PRÉ-REQUISITOS
# ─────────────────────────────────────────────────────────────────────────────
section "PRÉ-REQUISITOS"
echo

# Verificar que estamos na raiz do projeto
if [ ! -f "docker-compose.prod.yml" ]; then
  fatal "Execute a partir da raiz do projeto"
fi
ok "Diretório do projeto confirmado"

# Docker
if ! command -v docker &>/dev/null; then
  fatal "Docker não encontrado. Instale em https://docs.docker.com/get-docker/"
fi
ok "Docker encontrado: $(docker --version | cut -d' ' -f3 | tr -d ',')"

# Docker daemon
if ! docker info &>/dev/null 2>&1; then
  fatal "Docker daemon não está rodando"
fi
ok "Docker daemon ativo"

# docker compose (plugin v2)
if ! docker compose version &>/dev/null 2>&1; then
  fatal "docker compose (plugin v2) não encontrado"
fi
ok "docker compose: $(docker compose version --short 2>/dev/null || echo 'v2')"

# openssl
if ! command -v openssl &>/dev/null; then
  fatal "openssl não encontrado. Instale com: apt install openssl"
fi
ok "openssl disponível"

# ─────────────────────────────────────────────────────────────────────────────
#  SEÇÃO 2 — ARQUIVOS DE CONFIGURAÇÃO
# ─────────────────────────────────────────────────────────────────────────────
section "CONFIGURAÇÃO"
echo

BACKEND_ENV="Backend/.env.prod"
FRONTEND_ENV="frontend/.env.prod"
ENV_OK=true

if [ ! -f "$BACKEND_ENV" ]; then
  err_msg "$BACKEND_ENV não encontrado"
  printf "${Y}    → Crie com: cp Backend/.env.prod.example %s${RS}\n" "$BACKEND_ENV"
  ENV_OK=false
else
  ok "$BACKEND_ENV presente"
  # Checar se ainda tem valores CHANGE_ME
  if grep -q "CHANGE_ME" "$BACKEND_ENV" 2>/dev/null; then
    warn "Existem variáveis CHANGE_ME não preenchidas em $BACKEND_ENV"
    ENV_OK=false
  fi
fi

if [ ! -f "$FRONTEND_ENV" ]; then
  err_msg "$FRONTEND_ENV não encontrado"
  printf "${Y}    → Crie com: cp frontend/.env.prod.example %s${RS}\n" "$FRONTEND_ENV"
  ENV_OK=false
else
  ok "$FRONTEND_ENV presente"
  if grep -q "CHANGE_ME" "$FRONTEND_ENV" 2>/dev/null; then
    warn "Existem variáveis CHANGE_ME não preenchidas em $FRONTEND_ENV"
    ENV_OK=false
  fi
fi

if [ "$ENV_OK" = false ]; then
  echo
  fatal "Corrija os arquivos .env antes de continuar"
fi

# ─────────────────────────────────────────────────────────────────────────────
#  SEÇÃO 3 — CHAVES JWT RSA
# ─────────────────────────────────────────────────────────────────────────────
section "CHAVES JWT RSA"
echo

KEYS_DIR="Backend/keys"
PRIV_KEY="$KEYS_DIR/private.pem"
PUB_KEY="$KEYS_DIR/public.pem"

if [ -f "$PRIV_KEY" ] && [ -f "$PUB_KEY" ]; then
  ok "Chaves RSA presentes ($KEYS_DIR/)"
else
  warn "Chaves RSA não encontradas — gerando agora..."
  mkdir -p "$KEYS_DIR"
  start_spin "Gerando chave privada RSA 2048-bit..."
  openssl genrsa -out "$PRIV_KEY" 2048 2>/dev/null
  stop_spin "ok"

  start_spin "Extraindo chave pública..."
  openssl rsa -in "$PRIV_KEY" -pubout -out "$PUB_KEY" 2>/dev/null
  stop_spin "ok"

  chmod 600 "$PRIV_KEY"
  ok "Chaves geradas em $KEYS_DIR/"
  printf "${DG}    private.pem: %s bytes${RS}\n" "$(wc -c < "$PRIV_KEY" | tr -d ' ')"
  printf "${DG}    public.pem:  %s bytes${RS}\n" "$(wc -c < "$PUB_KEY" | tr -d ' ')"
fi

# ─────────────────────────────────────────────────────────────────────────────
#  SEÇÃO 4 — BUILD & DEPLOY
# ─────────────────────────────────────────────────────────────────────────────
section "BUILD & DEPLOY"
echo

# Carregar variáveis do backend .env.prod para expand no compose
set -a
# shellcheck disable=SC1090
source "$BACKEND_ENV"
# shellcheck disable=SC1090
source "$FRONTEND_ENV"
set +a

# Confirmação antes de continuar
printf "${Y}  ⚠  Pronto para fazer o deploy em PRODUÇÃO.${RS}\n"
printf "${W}     Este comando irá reconstruir e reiniciar todos os containers.${RS}\n"
echo
printf "${G}  Continuar? [s/N] ${RS}"
read -r CONFIRM
case "$CONFIRM" in
  [sS]|[sS][iI][mM]) ;;
  *) printf "${Y}  Deploy cancelado.${RS}\n"; exit 0 ;;
esac

echo

# Pull de imagens base antes do build
start_spin "Atualizando imagens base (postgres, redis)..."
docker compose -f docker-compose.prod.yml pull postgres redis --quiet 2>/dev/null || true
stop_spin "ok"

# Build das imagens (backend + frontend)
echo
printf "${G}  ◈ Construindo imagens Docker...${RS}\n"
divider
docker compose -f docker-compose.prod.yml build --progress=plain 2>&1 | \
  while IFS= read -r line; do
    if printf '%s' "$line" | grep -qiE 'error:|failed|fatal|exception'; then
      printf "${R}    %s${RS}\n" "$line"
    else
      printf "${DG}    %s${RS}\n" "$line"
    fi
  done
divider

# Subir serviços
echo
start_spin "Iniciando containers..."
docker compose -f docker-compose.prod.yml up -d
stop_spin "ok"

# ─────────────────────────────────────────────────────────────────────────────
#  SEÇÃO 5 — HEALTH CHECK
# ─────────────────────────────────────────────────────────────────────────────
section "HEALTH CHECK"
echo

# Detectar porta django
DJANGO_PORT="${DJANGO_PORT:-8100}"
FRONTEND_PORT="${FRONTEND_PORT:-3100}"

wait_healthy() {
  local name="$1"
  local max_wait=90
  local elapsed=0
  local frames=('◐' '◓' '◑' '◒')
  local i=0 cid health_state container_state

  while [ $elapsed -lt $max_wait ]; do
    cid=$(docker compose -f docker-compose.prod.yml ps -q "$name" 2>/dev/null | head -1)

    if [ -n "$cid" ]; then
      # Uma só chamada ao inspect — lê health e status de uma vez
      read -r health_state container_state < <(
        docker inspect --format='{{.State.Health.Status}} {{.State.Status}}' "$cid" 2>/dev/null \
          || echo "none unknown"
      )

      case "$container_state" in
        exited|dead)
          printf "${CL}${R}  ✗ %s encerrou com erro — veja: docker logs %s${RS}\n" "$name" "$name"
          return 0 ;;
      esac

      case "$health_state" in
        healthy)
          printf "${CL}${BG}  ✓ ${G}%s online${RS}\n" "$name"
          return 0 ;;
        none|"")
          if [ "$container_state" = "running" ]; then
            printf "${CL}${BG}  ✓ ${G}%s running (sem healthcheck)${RS}\n" "$name"
            return 0
          fi ;;
      esac
    fi

    printf "${CL}${BG}  ${frames[$((i % 4))]} ${G}Aguardando %s... (%ds)${RS}" "$name" "$elapsed"
    sleep 2
    elapsed=$((elapsed + 2))
    i=$((i + 1))
  done

  # Timeout: avisa mas não aborta — o HTTP health check abaixo confirma
  printf "${CL}${Y}  ⚠ %s não ficou healthy em %ds (pode ainda estar subindo)${RS}\n" "$name" "$max_wait"
}

wait_healthy "postgres"
wait_healthy "redis"
wait_healthy "django"
wait_healthy "frontend"

echo
# HTTP health checks — /ready/ verifica DB + Redis além de liveness
start_spin "Testando endpoint /api/health/ready/..."
sleep 2
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "http://127.0.0.1:${DJANGO_PORT}/api/health/ready/" \
  --max-time 10 2>/dev/null || echo "000")
stop_spin "ok"

if [ "$HTTP_STATUS" = "200" ]; then
  ok "Django /api/health/ready/ → HTTP $HTTP_STATUS (DB + Redis OK)"
elif [ "$HTTP_STATUS" = "503" ]; then
  warn "Django /api/health/ready/ → HTTP $HTTP_STATUS (serviço degradado — verifique logs)"
else
  warn "Django /api/health/ready/ → HTTP $HTTP_STATUS (pode estar iniciando)"
fi

start_spin "Testando frontend..."
sleep 1
FRONT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "http://127.0.0.1:${FRONTEND_PORT}/" \
  --max-time 15 2>/dev/null || echo "000")
stop_spin "ok"

if [ "$FRONT_STATUS" = "200" ] || [ "$FRONT_STATUS" = "308" ] || [ "$FRONT_STATUS" = "301" ]; then
  ok "Frontend → HTTP $FRONT_STATUS"
else
  warn "Frontend → HTTP $FRONT_STATUS (pode estar compilando)"
fi

# ─────────────────────────────────────────────────────────────────────────────
#  SEÇÃO 6 — CONTAINERS ATIVOS
# ─────────────────────────────────────────────────────────────────────────────
section "CONTAINERS ATIVOS"
echo

docker compose -f docker-compose.prod.yml ps \
  --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" \
  2>/dev/null | while IFS= read -r line; do
    if echo "$line" | grep -q "NAME"; then
      printf "${DG}    %s${RS}\n" "$line"
    elif echo "$line" | grep -qi "running\|healthy"; then
      printf "${G}    %s${RS}\n" "$line"
    elif echo "$line" | grep -qi "exit\|error"; then
      printf "${R}    %s${RS}\n" "$line"
    else
      printf "${Y}    %s${RS}\n" "$line"
    fi
  done

# ─────────────────────────────────────────────────────────────────────────────
#  SEÇÃO 7 — PÓS-DEPLOY (PRIMEIRO DEPLOY)
# ─────────────────────────────────────────────────────────────────────────────
section "PÓS-DEPLOY"
echo

if [ -n "${DJANGO_ADMIN_EMAIL:-}" ]; then
  ok "Admin configurado via DJANGO_ADMIN_* — criado/atualizado pelo seed_prod"
  printf "${DG}    Acesse em: ${SITE_URL:-https://yourdomain.com}/login${RS}\n"
  printf "${DG}    Django Admin: http://127.0.0.1:%s/admin/${RS}\n" "$DJANGO_PORT"
else
  warn "DJANGO_ADMIN_* não configurado — siga os passos para criar o admin manualmente:"
  echo
  printf "${W}  1. Registre uma conta normalmente no site${RS}\n"
  printf "${W}     ${DG}%s${RS}\n" "${SITE_URL:-https://yourdomain.com}/register"
  echo
  printf "${W}  2. Promova a conta a superadmin:${RS}\n"
  printf "${BG}     docker compose -f docker-compose.prod.yml exec django \\ ${RS}\n"
  printf "${BG}       python manage.py promote_superadmin seu@email.com${RS}\n"
fi
echo
printf "${DG}  Backup do banco: ./backup.sh${RS}\n"
printf "${DG}  Logs:            docker compose -f docker-compose.prod.yml logs -f${RS}\n"

# ─────────────────────────────────────────────────────────────────────────────
#  FIM
# ─────────────────────────────────────────────────────────────────────────────
echo
divider
printf "${BG}"
cat << 'EOF'

  ███████╗██╗   ██╗███████╗████████╗███████╗███╗   ███╗ █████╗
  ██╔════╝╚██╗ ██╔╝██╔════╝╚══██╔══╝██╔════╝████╗ ████║██╔══██╗
  ███████╗ ╚████╔╝ ███████╗   ██║   █████╗  ██╔████╔██║███████║
  ╚════██║  ╚██╔╝  ╚════██║   ██║   ██╔══╝  ██║╚██╔╝██║██╔══██║
  ███████║   ██║   ███████║   ██║   ███████╗██║ ╚═╝ ██║██║  ██║
  ╚══════╝   ╚═╝   ╚══════╝   ╚═╝   ╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝

  ██████╗ ███╗   ██╗██╗     ██╗███╗   ██╗███████╗
  ██╔═══██╗████╗  ██║██║     ██║████╗  ██║██╔════╝
  ██║   ██║██╔██╗ ██║██║     ██║██╔██╗ ██║█████╗
  ██║   ██║██║╚██╗██║██║     ██║██║╚██╗██║██╔══╝
  ╚██████╔╝██║ ╚████║███████╗██║██║ ╚████║███████╗
   ╚═════╝ ╚═╝  ╚═══╝╚══════╝╚═╝╚═╝  ╚═══╝╚══════╝

EOF
printf "${RS}"

SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://yourdomain.com}"
printf "${G}  ◈ Sistema disponível em: ${BG}%s${RS}\n" "$SITE_URL"
printf "${DG}  ◈ Health:      http://127.0.0.1:%s/api/health/ready/${RS}\n" "$DJANGO_PORT"
printf "${DG}  ◈ Logs:        docker compose -f docker-compose.prod.yml logs -f${RS}\n"
echo
divider
printf "${DG}  Projeto Raven  |  %s${RS}\n" "$(date '+%Y-%m-%d %H:%M:%S')"
divider
echo
