#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  ██████╗  █████╗ ██╗   ██╗███████╗███╗   ██╗
#  ██╔══██╗██╔══██╗██║   ██║██╔════╝████╗  ██║
#  ██████╔╝███████║██║   ██║█████╗  ██╔██╗ ██║
#  ██╔══██╗██╔══██║╚██╗ ██╔╝██╔══╝  ██║╚██╗██║
#  ██║  ██║██║  ██║ ╚████╔╝ ███████╗██║ ╚████║
#  ╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚═╝  ╚═══╝
#
#  S E T U P   —   P R I M E I R O   D E P L O Y
# ─────────────────────────────────────────────────────────────────────────────
#
#  Uso:  chmod +x setup.sh && ./setup.sh
#
#  O que este script faz (em ordem):
#    1. Verifica pré-requisitos (docker, openssl, python3)
#    2. Pergunta domínio, credenciais do admin e portas
#    3. Gera todos os segredos automaticamente
#    4. Gera as chaves JWT RSA 2048-bit
#    5. Gera as chaves VAPID para Web Push (opcional)
#    6. Escreve Backend/.env.prod e frontend/.env.prod completos
#    7. Mostra o resumo do Cloudflare Tunnel a configurar
#    8. Oferece executar ./deploy.sh imediatamente
#
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── ANSI ──────────────────────────────────────────────────────────────────────
G='\033[0;32m'
BG='\033[1;32m'
DG='\033[2;32m'
Y='\033[1;33m'
R='\033[0;31m'
C='\033[0;36m'
W='\033[1;37m'
D='\033[2m'
RS='\033[0m'
CL='\033[2K\r'

# ── Cleanup trap ──────────────────────────────────────────────────────────────
_cleanup() {
  [ -n "${_spin_pid:-}" ] && { kill "$_spin_pid" 2>/dev/null || true; wait "$_spin_pid" 2>/dev/null || true; }
  printf '\033[?25h'
  printf "${RS}"
}
trap '_cleanup' EXIT INT TERM

# ── Funções utilitárias ───────────────────────────────────────────────────────
_spin_pid=""

start_spin() {
  local msg="$1"
  local frames=('⣾' '⣽' '⣻' '⢿' '⡿' '⣟' '⣯' '⣷')
  ( i=0
    while true; do
      printf "${CL}${BG}  ${frames[$((i % 8))]}${G}  %s${RS}" "$msg"
      sleep 0.1; i=$((i + 1))
    done
  ) &
  _spin_pid=$!
}

stop_spin() {
  local status="${1:-ok}"
  [ -n "$_spin_pid" ] && { kill "$_spin_pid" 2>/dev/null || true; wait "$_spin_pid" 2>/dev/null || true; _spin_pid=""; }
  [ "$status" = "ok" ] && printf "${CL}${BG}  ✓${RS}\n" || printf "${CL}${R}  ✗${RS}\n"
}

divider() { printf "${DG}  %s${RS}\n" "$(printf '─%.0s' {1..68})"; }

section() {
  echo
  divider
  printf "${BG}  ◈ ${W}%s${RS}\n" "$1"
  divider
}

ok()      { printf "${BG}  ✓ ${G}%s${RS}\n" "$1"; }
warn()    { printf "${Y}  ⚠ %s${RS}\n" "$1"; }
info()    { printf "${C}  → %s${RS}\n" "$1"; }
err_msg() { printf "${R}  ✗ %s${RS}\n" "$1"; }

fatal() {
  stop_spin "fail" 2>/dev/null || true
  echo
  printf "${R}  ╔══════════════════════════════════════╗${RS}\n"
  printf "${R}  ║  ERRO: %-31s║${RS}\n" "$1"
  printf "${R}  ╚══════════════════════════════════════╝${RS}\n"
  echo; exit 1
}

# Prompt com valor padrão colorido
prompt() {
  local label="$1" default="$2" varname="$3"
  if [ -n "$default" ]; then
    printf "${G}  ▸ %s ${DG}[%s]${G}: ${RS}" "$label" "$default"
  else
    printf "${G}  ▸ %s: ${RS}" "$label"
  fi
  read -r input
  if [ -z "$input" ] && [ -n "$default" ]; then
    eval "$varname='$default'"
  else
    eval "$varname='$input'"
  fi
}

# Prompt para senha (sem echo)
prompt_password() {
  local label="$1" varname="$2"
  printf "${G}  ▸ %s: ${RS}" "$label"
  read -rs input; echo
  eval "$varname='$input'"
}

validate_username() {
  local u="$1"
  [ "${#u}" -ge 3 ] || return 1
  [ "${#u}" -le 30 ] || return 1
  [[ "$u" =~ ^[a-zA-Z0-9_-]+$ ]] || return 1
  return 0
}

validate_password() {
  local p="$1"
  [ "${#p}" -ge 12 ] || return 1
  [[ "$p" =~ [A-Z] ]] || return 1
  [[ "$p" =~ [a-z] ]] || return 1
  [[ "$p" =~ [0-9] ]] || return 1
  [[ "$p" =~ [\!\@\#\$\%\^\&\*\(\)\-\_\=\+\[\]\{\}\;\:\'\"\,\.\<\>\/\?\\\|\`\~] ]] || return 1
  local lower
  lower="$(printf '%s' "$p" | tr '[:upper:]' '[:lower:]')"
  case "$lower" in
    password|12345678|qwerty|abc123|password123|admin123|letmein|welcome|monkey|dragon|senha@123|pass@word1) return 1 ;;
  esac
  return 0
}

# Geração de string aleatória
gen_secret()  { python3 -c "import secrets; print(secrets.token_urlsafe($1))" 2>/dev/null; }
gen_hex()     { openssl rand -hex "$1" 2>/dev/null; }
gen_fernet()  { python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" 2>/dev/null; }

# ── Banner ────────────────────────────────────────────────────────────────────
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
  printf "${G}  %s${RS}\n" "P R O J E T O   R A V E N   —   S E T U P   I N I C I A L"
  printf "${DG}  %s${RS}\n" "$(date '+%Y-%m-%d %H:%M:%S %Z')  |  $(hostname)"
  divider
  echo
  printf "${D}  Este script configura o ambiente de produção do zero.${RS}\n"
  printf "${D}  Execute-o uma única vez após clonar o repositório.${RS}\n"
  echo
}

# ─────────────────────────────────────────────────────────────────────────────
show_banner

# ── 1. PRÉ-REQUISITOS ─────────────────────────────────────────────────────────
section "1 · PRÉ-REQUISITOS"
echo

[ ! -f "docker-compose.prod.yml" ] && fatal "Execute a partir da raiz do projeto"
ok "Diretório do projeto confirmado"

command -v docker &>/dev/null       || fatal "Docker não encontrado"
docker info &>/dev/null 2>&1        || fatal "Docker daemon não está rodando"
ok "Docker: $(docker --version | cut -d' ' -f3 | tr -d ',')"

docker compose version &>/dev/null 2>&1 || fatal "docker compose plugin (v2) não encontrado"
ok "docker compose: $(docker compose version --short 2>/dev/null || echo 'v2')"

command -v openssl &>/dev/null || fatal "openssl não encontrado — instale com: apt install openssl"
ok "openssl disponível"

command -v python3 &>/dev/null || fatal "python3 não encontrado — instale com: apt install python3"
ok "python3: $(python3 --version 2>&1 | cut -d' ' -f2)"

# Verificar cryptography (necessário para TOTP_ENCRYPTION_KEY e VAPID opcional)
HAVE_CRYPTOGRAPHY=false
if python3 -c "from cryptography.fernet import Fernet" 2>/dev/null; then
  HAVE_CRYPTOGRAPHY=true
  ok "python3 cryptography disponível"
else
  warn "python3-cryptography não instalado — TOTP_ENCRYPTION_KEY será derivado do secret_key"
fi

# Verificar npx (opcional, para VAPID fallback)
HAVE_NPX=false
command -v npx &>/dev/null && HAVE_NPX=true

# ── 2. VERIFICAR ARQUIVOS EXISTENTES ──────────────────────────────────────────
section "2 · VERIFICAR CONFIGURAÇÃO EXISTENTE"
echo

BACKEND_ENV="Backend/.env.prod"
FRONTEND_ENV="frontend/.env.prod"
OVERWRITE=true

if [ -f "$BACKEND_ENV" ] || [ -f "$FRONTEND_ENV" ]; then
  warn "Arquivos .env.prod já existem:"
  [ -f "$BACKEND_ENV" ] && printf "${Y}    %s${RS}\n" "$BACKEND_ENV"
  [ -f "$FRONTEND_ENV" ] && printf "${Y}    %s${RS}\n" "$FRONTEND_ENV"
  echo
  printf "${W}  Sobrescrever e gerar nova configuração? [s/N] ${RS}"
  read -r ow_answer
  case "$ow_answer" in
    [sS]|[sS][iI][mM]) OVERWRITE=true ;;
    *)
      warn "Setup cancelado. Para re-executar, remova os arquivos .env.prod."
      echo; exit 0 ;;
  esac
fi

# ── 3. CONFIGURAÇÃO INTERATIVA ────────────────────────────────────────────────
section "3 · CONFIGURAÇÃO"
echo
printf "${D}  Responda às perguntas abaixo. Pressione ENTER para aceitar o valor padrão.${RS}\n"
echo

# Domínio
prompt "Domínio (sem https://)" "seudominio.com" DOMAIN
SITE_URL="https://${DOMAIN}"

# Portas
echo
prompt "Porta do frontend no host (Cloudflare → Next.js)" "3100" FRONTEND_PORT
prompt "Porta do Django no host   (Cloudflare → API/WS)" "8100" DJANGO_PORT

# Admin
echo
printf "${W}  Credenciais do administrador${RS}\n"
prompt          "E-mail do admin"   "admin@${DOMAIN}" ADMIN_EMAIL
prompt          "Username do admin" "admin"            ADMIN_USERNAME
prompt_password "Senha do admin (mínimo 12 chars)"    ADMIN_PASSWORD

while ! validate_username "$ADMIN_USERNAME"; do
  warn "Username inválido. Use 3–30 caracteres e apenas letras, números, _ ou -."
  prompt "Username do admin" "admin" ADMIN_USERNAME
done

while [ ${#ADMIN_PASSWORD} -lt 12 ]; do
  warn "Senha muito curta. Digite pelo menos 12 caracteres."
  prompt_password "Senha do admin" ADMIN_PASSWORD
done

while ! validate_password "$ADMIN_PASSWORD"; do
  warn "Senha inválida. Use 12+ chars com maiúscula, minúscula, número e caractere especial."
  prompt_password "Senha do admin" ADMIN_PASSWORD
done

echo
printf "${W}  Usuário de suporte (opcional)${RS}\n"
printf "${D}  Recomendado manter desativado em produção. Se ativar, configure senha forte.${RS}\n"
printf "${G}  Criar usuário suporte agora? [s/N] ${RS}"
read -r support_answer
CREATE_SUPPORT_USER=false
SUPPORT_USER_USERNAME=""
SUPPORT_USER_EMAIL=""
SUPPORT_USER_PASSWORD=""
case "$support_answer" in
  [sS]|[sS][iI][mM])
    CREATE_SUPPORT_USER=true
    prompt "E-mail do suporte" "suporte@${DOMAIN}" SUPPORT_USER_EMAIL
    prompt "Username do suporte" "suporte" SUPPORT_USER_USERNAME
    prompt_password "Senha do suporte (mínimo 12 chars)" SUPPORT_USER_PASSWORD

    while ! validate_username "$SUPPORT_USER_USERNAME"; do
      warn "Username inválido. Use 3–30 caracteres e apenas letras, números, _ ou -."
      prompt "Username do suporte" "suporte" SUPPORT_USER_USERNAME
    done

    while ! validate_password "$SUPPORT_USER_PASSWORD"; do
      warn "Senha inválida. Use 12+ chars com maiúscula, minúscula, número e caractere especial."
      prompt_password "Senha do suporte" SUPPORT_USER_PASSWORD
    done
    ;;
esac

# VAPID
echo
printf "${W}  Web Push — Notificações Push para browser (opcional)${RS}\n"
printf "${G}  Gerar chaves VAPID agora? [S/n] ${RS}"
read -r vapid_answer
GEN_VAPID=true
case "$vapid_answer" in
  [nN]*) GEN_VAPID=false; warn "VAPID pulado — você pode gerar depois e adicionar ao Backend/.env.prod" ;;
esac

# Restrição de IP para /admin/
echo
printf "${W}  Restrição de IP para /admin/ e /api/schema/ (opcional)${RS}\n"
printf "${D}  Deixe vazio para sem restrição, ou informe IPs separados por vírgula.${RS}\n"
prompt "IPs autorizados (ex: 1.2.3.4,5.6.7.8)" "" ADMIN_ALLOWED_IPS

# Sentry
echo
printf "${W}  Sentry DSN para monitoramento de erros (opcional)${RS}\n"
prompt "Sentry DSN" "" SENTRY_DSN

# ── 4. GERAR SEGREDOS ─────────────────────────────────────────────────────────
section "4 · GERANDO SEGREDOS"
echo

start_spin "Gerando DJANGO_SECRET_KEY..."
DJANGO_SECRET_KEY=$(gen_secret 64)
[ -z "$DJANGO_SECRET_KEY" ] && DJANGO_SECRET_KEY=$(gen_hex 48)
stop_spin "ok"
ok "DJANGO_SECRET_KEY gerado (${#DJANGO_SECRET_KEY} chars)"

start_spin "Gerando senhas do banco de dados..."
POSTGRES_PASSWORD=$(gen_hex 24)
stop_spin "ok"
ok "POSTGRES_PASSWORD gerado"

start_spin "Gerando senha do Redis..."
REDIS_PASSWORD=$(gen_hex 20)
stop_spin "ok"
ok "REDIS_PASSWORD gerado"

start_spin "Gerando EMAIL_SETTINGS_ENCRYPTION_SALT..."
EMAIL_SALT=$(gen_hex 20)
stop_spin "ok"
ok "EMAIL_SETTINGS_ENCRYPTION_SALT gerado"

start_spin "Gerando TOTP_ENCRYPTION_KEY..."
if [ "$HAVE_CRYPTOGRAPHY" = "true" ]; then
  TOTP_KEY=$(gen_fernet)
  stop_spin "ok"
  ok "TOTP_ENCRYPTION_KEY gerado (Fernet)"
else
  TOTP_KEY=""
  stop_spin "ok"
  warn "TOTP_ENCRYPTION_KEY não gerado — será derivado do DJANGO_SECRET_KEY"
fi

# Montar as URLs do Redis com a senha
REDIS_URL="redis://:${REDIS_PASSWORD}@redis:6379/1"
CELERY_BROKER_URL="redis://:${REDIS_PASSWORD}@redis:6379/2"
CHANNEL_LAYER_URL="redis://:${REDIS_PASSWORD}@redis:6379/3"

# ── 5. CHAVES JWT RSA ─────────────────────────────────────────────────────────
section "5 · CHAVES JWT RSA"
echo

KEYS_DIR="Backend/keys"
PRIV_KEY="$KEYS_DIR/private.pem"
PUB_KEY="$KEYS_DIR/public.pem"

if [ -f "$PRIV_KEY" ] && [ -f "$PUB_KEY" ]; then
  ok "Chaves RSA já existem em $KEYS_DIR/ — mantendo as existentes"
  info "As chaves RSA persistem entre deploys. Não as regenere sem necessidade."
else
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

# ── 6. CHAVES VAPID ───────────────────────────────────────────────────────────
VAPID_PUBLIC_KEY=""
VAPID_PRIVATE_KEY=""

if [ "$GEN_VAPID" = "true" ]; then
  section "6 · CHAVES VAPID (WEB PUSH)"
  echo

  # Tenta python3 + cryptography primeiro (sem depender do Node no servidor)
  if [ "$HAVE_CRYPTOGRAPHY" = "true" ]; then
    start_spin "Gerando chaves VAPID via python3-cryptography..."
    vapid_out=$(python3 - << 'PYEOF' 2>/dev/null
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.backends import default_backend
import base64, sys

try:
    pk = ec.generate_private_key(ec.SECP256R1(), default_backend())
    priv_int = pk.private_numbers().private_value
    priv_bytes = priv_int.to_bytes(32, 'big')

    pub = pk.public_key().public_numbers()
    pub_bytes = b'\x04' + pub.x.to_bytes(32, 'big') + pub.y.to_bytes(32, 'big')

    priv_b64 = base64.urlsafe_b64encode(priv_bytes).rstrip(b'=').decode()
    pub_b64  = base64.urlsafe_b64encode(pub_bytes).rstrip(b'=').decode()
    print(priv_b64)
    print(pub_b64)
except Exception as e:
    sys.exit(1)
PYEOF
    ) || vapid_out=""

    if [ -n "$vapid_out" ]; then
      VAPID_PRIVATE_KEY=$(echo "$vapid_out" | sed -n '1p')
      VAPID_PUBLIC_KEY=$(echo "$vapid_out" | sed -n '2p')
      stop_spin "ok"
      ok "Chaves VAPID geradas via python3"
    else
      stop_spin "fail"
      HAVE_CRYPTOGRAPHY=false  # forçar fallback
    fi
  fi

  # Fallback: npx web-push (requer Node.js no servidor)
  if [ "$HAVE_CRYPTOGRAPHY" = "false" ] && [ "$HAVE_NPX" = "true" ]; then
    start_spin "Gerando chaves VAPID via npx web-push..."
    vapid_out=$(npx --yes web-push generate-vapid-keys --non-interactive 2>/dev/null) || vapid_out=""
    if [ -n "$vapid_out" ]; then
      VAPID_PUBLIC_KEY=$(echo "$vapid_out"  | grep 'Public'  | awk '{print $NF}')
      VAPID_PRIVATE_KEY=$(echo "$vapid_out" | grep 'Private' | awk '{print $NF}')
      stop_spin "ok"
      ok "Chaves VAPID geradas via npx"
    else
      stop_spin "fail"
      warn "npx web-push falhou — VAPID ficará em branco no .env.prod"
    fi
  elif [ -z "$VAPID_PUBLIC_KEY" ] && [ "$HAVE_NPX" = "false" ]; then
    warn "python3-cryptography e npx não disponíveis — VAPID ficará em branco"
    info "Para gerar depois: npx web-push generate-vapid-keys"
  fi
fi

# ── 7. ESCREVER Backend/.env.prod ─────────────────────────────────────────────
section "7 · ESCREVENDO ARQUIVOS DE CONFIGURAÇÃO"
echo

start_spin "Escrevendo $BACKEND_ENV..."

cat > "$BACKEND_ENV" << EOF
# ── Gerado automaticamente por setup.sh em $(date '+%Y-%m-%d %H:%M:%S') ──────

# ── Core ──────────────────────────────────────────────────────────────────────
DJANGO_SECRET_KEY=${DJANGO_SECRET_KEY}
DEBUG=False
ALLOWED_HOSTS=${DOMAIN},www.${DOMAIN}
SITE_URL=${SITE_URL}

# ── Database ───────────────────────────────────────────────────────────────────
USE_SQLITE=False
POSTGRES_DB=projeto_raven
POSTGRES_USER=raven
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# ── Redis ─────────────────────────────────────────────────────────────────────
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_URL=${REDIS_URL}
CELERY_BROKER_URL=${CELERY_BROKER_URL}
CHANNEL_LAYER_URL=${CHANNEL_LAYER_URL}

# ── Portas expostas no host ────────────────────────────────────────────────────
FRONTEND_PORT=${FRONTEND_PORT}
DJANGO_PORT=${DJANGO_PORT}

# ── CORS / CSRF ────────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS=${SITE_URL},https://www.${DOMAIN}
CSRF_TRUSTED_ORIGINS=${SITE_URL},https://www.${DOMAIN}

# ── Email ──────────────────────────────────────────────────────────────────────
# Configure o provedor SMTP pelo painel admin após o primeiro login.
EMAIL_SETTINGS_ENCRYPTION_SALT=${EMAIL_SALT}

# ── JWT RSA Keys ──────────────────────────────────────────────────────────────
JWT_PRIVATE_KEY_PATH=/app/keys/private.pem
JWT_PUBLIC_KEY_PATH=/app/keys/public.pem

# ── Admin padrão ──────────────────────────────────────────────────────────────
DJANGO_ADMIN_EMAIL=${ADMIN_EMAIL}
DJANGO_ADMIN_USERNAME=${ADMIN_USERNAME}
DJANGO_ADMIN_PASSWORD=${ADMIN_PASSWORD}

# ── Acesso restrito por IP ────────────────────────────────────────────────────
ADMIN_ALLOWED_IPS=${ADMIN_ALLOWED_IPS}

# ── API Schema / Swagger ──────────────────────────────────────────────────────
SCHEMA_ENABLED=False

# ── OAuth Google ──────────────────────────────────────────────────────────────
# Configure pelo painel admin após o deploy, ou preencha aqui:
OAUTH_GOOGLE_CLIENT_ID=
OAUTH_GOOGLE_CLIENT_SECRET=

# ── Monitoring ────────────────────────────────────────────────────────────────
SENTRY_DSN=${SENTRY_DSN}
SENTRY_TRACES_SAMPLE_RATE=0.05
METRICS_ENABLED=False

# ── Rate limiting ─────────────────────────────────────────────────────────────
REST_THROTTLING_ENABLED=True
REST_THROTTLE_ANON=100/min
REST_THROTTLE_USER=300/min
REST_THROTTLE_LOGIN=10/min
REST_THROTTLE_REGISTER=3/hour
REST_THROTTLE_PASSWORD_RESET=3/hour
REST_THROTTLE_OTP=5/minute
REST_THROTTLE_FORUM_POST=20/minute
REST_THROTTLE_BLOG_POST=10/minute
REST_THROTTLE_COMMENT=10/minute

# ── App versioning ────────────────────────────────────────────────────────────
APP_VERSION=
APP_BUILD_SHA=
APP_BUILD_TIME=

# ── Web Push (VAPID) ──────────────────────────────────────────────────────────
VAPID_PUBLIC_KEY=${VAPID_PUBLIC_KEY}
VAPID_PRIVATE_KEY=${VAPID_PRIVATE_KEY}
VAPID_ADMIN_EMAIL=${ADMIN_EMAIL}

# ── TOTP Encryption Key ───────────────────────────────────────────────────────
TOTP_ENCRYPTION_KEY=${TOTP_KEY}

# ── SSL / Proxy ───────────────────────────────────────────────────────────────
# False: Cloudflare Tunnel termina TLS. Django recebe HTTP puro do localhost.
SECURE_SSL_REDIRECT=False

# ── Misc ──────────────────────────────────────────────────────────────────────
DJANGO_LOG_LEVEL=WARNING
LOG_FORMAT=json
RUN_SEED_PROD=true
RUN_MIGRATE=true
RUN_COLLECTSTATIC=true
BOOTSTRAP_USE_DB_LOCK=true
BOOTSTRAP_LOCK_ID=9034212341234
CREATE_SUPPORT_USER=${CREATE_SUPPORT_USER}
SUPPORT_USER_USERNAME=${SUPPORT_USER_USERNAME}
SUPPORT_USER_EMAIL=${SUPPORT_USER_EMAIL}
SUPPORT_USER_PASSWORD=${SUPPORT_USER_PASSWORD}
EOF

stop_spin "ok"
ok "$BACKEND_ENV escrito"

# ── 8. ESCREVER frontend/.env.prod ────────────────────────────────────────────
start_spin "Escrevendo $FRONTEND_ENV..."

cat > "$FRONTEND_ENV" << EOF
# ── Gerado automaticamente por setup.sh em $(date '+%Y-%m-%d %H:%M:%S') ──────

# ── Public (embutido no build — rebuild necessário após alterar) ──────────────
NEXT_PUBLIC_API_BASE_URL=${SITE_URL}
NEXT_PUBLIC_SITE_URL=${SITE_URL}
NEXT_PUBLIC_WS_BASE_URL=wss://${DOMAIN}

# ── Server-side only ──────────────────────────────────────────────────────────
# URL interna usada pelo Next.js server → Django (dentro da rede Docker)
INTERNAL_API_BASE_URL=http://django:8000
EOF

stop_spin "ok"
ok "$FRONTEND_ENV escrito"

# Proteção dos arquivos (leitura apenas para o owner)
chmod 600 "$BACKEND_ENV" "$FRONTEND_ENV"
ok "Permissões dos arquivos de configuração definidas (600)"

# ── 9. RESUMO DA CONFIGURAÇÃO ─────────────────────────────────────────────────
section "8 · CLOUDFLARE TUNNEL"
echo
printf "${W}  Configure as rotas no painel: ${C}Zero Trust → Networks → Tunnels${RS}\n"
echo
printf "${BG}  %-40s  %s${RS}\n" "Hostname público" "Serviço interno"
divider
printf "${G}  %-40s  %s${RS}\n" "${DOMAIN}"        "http://localhost:${FRONTEND_PORT}"
printf "${G}  %-40s  %s${RS}\n" "${DOMAIN}/ws/*"   "http://localhost:${DJANGO_PORT}"
printf "${G}  %-40s  %s${RS}\n" "${DOMAIN}/api/*"  "http://localhost:${DJANGO_PORT}"
echo
printf "${Y}  ⚠ A rota /ws/* é obrigatória para o fórum em tempo real.${RS}\n"

# ── 10. RESUMO FINAL ──────────────────────────────────────────────────────────
section "9 · RESUMO"
echo
printf "${BG}  %-28s ${G}%s${RS}\n"  "Site:"             "$SITE_URL"
printf "${BG}  %-28s ${G}%s${RS}\n"  "Admin email:"      "$ADMIN_EMAIL"
printf "${BG}  %-28s ${G}%s${RS}\n"  "Admin username:"   "$ADMIN_USERNAME"
printf "${BG}  %-28s ${G}http://localhost:%s${RS}\n" "Porta frontend:" "$FRONTEND_PORT"
printf "${BG}  %-28s ${G}http://localhost:%s${RS}\n" "Porta Django:"   "$DJANGO_PORT"
printf "${BG}  %-28s ${G}%s${RS}\n"  "Chaves RSA JWT:"   "$KEYS_DIR/"
if [ -n "$VAPID_PUBLIC_KEY" ]; then
  printf "${BG}  %-28s ${G}geradas${RS}\n" "Chaves VAPID:"
else
  printf "${BG}  %-28s ${Y}não geradas — configure manualmente${RS}\n" "Chaves VAPID:"
fi
echo

# Avisos pós-setup
if [ -z "$TOTP_KEY" ]; then
  warn "TOTP_ENCRYPTION_KEY está vazio — instale python3-cryptography e re-execute"
  info "  apt install python3-cryptography  &&  ./setup.sh"
  echo
fi

# ── 11. DEPLOY AGORA? ─────────────────────────────────────────────────────────
echo
printf "${Y}  ════════════════════════════════════════════════════════════════${RS}\n"
printf "${W}  Configuração concluída. Deseja executar o deploy agora?${RS}\n"
printf "${Y}  ════════════════════════════════════════════════════════════════${RS}\n"
echo
printf "${G}  Iniciar deploy? [S/n] ${RS}"
read -r deploy_answer

case "$deploy_answer" in
  [nN]*)
    echo
    ok "Configuração salva. Para fazer o deploy quando quiser:"
    echo
    printf "${BG}    chmod +x deploy.sh && ./deploy.sh${RS}\n"
    echo
    ;;
  *)
    echo
    info "Iniciando deploy..."
    sleep 1
    chmod +x deploy.sh
    exec ./deploy.sh
    ;;
esac

# ── FIM ───────────────────────────────────────────────────────────────────────
divider
printf "${DG}  Projeto Raven  |  setup concluído em %s${RS}\n" "$(date '+%Y-%m-%d %H:%M:%S')"
divider
echo
