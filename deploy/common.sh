# Shared settings and helpers for server-setup.sh and deploy.sh (sourced, not run directly).
# shellcheck shell=bash
# These variables are used by the scripts that source this file.
# shellcheck disable=SC2034

APP_USER=kothaymilbe
APP_HOME=/home/kothaymilbe
APP_DIR=$APP_HOME/kothaymilbe
BACKEND_DIR=$APP_DIR/backend
FRONTEND_DIR=$APP_DIR/frontend
DEPLOY_DIR=$APP_DIR/deploy
API_UNIT=kothaymilbe-api
PM2_UNIT=pm2-kothaymilbe
PM2_APP=kothaymilbe-web
PM2_VERSION=7.1.1
CADDYFILE=/etc/caddy/Caddyfile
API_URL=http://127.0.0.1:8020
WEB_URL=http://127.0.0.1:3020
ROOT_PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

if [[ -t 1 ]]; then BOLD=$'\033[1m' GREEN=$'\033[32m' RED=$'\033[31m' RESET=$'\033[0m'; else BOLD='' GREEN='' RED='' RESET=''; fi

step() { printf '\n%s==> %s%s\n' "$BOLD$GREEN" "$*" "$RESET"; }
info() { printf '    %s\n' "$*"; }
fail() {
  printf '\n%sERROR: %s%s\n' "$BOLD$RED" "$*" "$RESET" >&2
  exit 1
}

require_root() {
  [[ $EUID -eq 0 ]] || fail "Run this script as root: sudo bash $0"
}

# Run the bash script given on stdin as the kothaymilbe user (its own HOME and its own pm2).
run_as_app() {
  (cd / && sudo -u "$APP_USER" -H -- env \
    APP_DIR="$APP_DIR" PM2_HOME="$APP_HOME/.pm2" PM2_VERSION="$PM2_VERSION" \
    bash -euo pipefail -s)
}

# Same, with Node 24 from the kothaymilbe user's nvm on PATH.
# nvm.sh is not written for `set -eu`, so those are relaxed while it loads.
# Single quotes on purpose: $HOME etc. expand in the kothaymilbe user's shell.
# shellcheck disable=SC2016
NVM_PRELUDE='export NVM_DIR="$HOME/.nvm"
set +eu
. "$NVM_DIR/nvm.sh" --no-use
nvm use --silent 24 >/dev/null
nvm_status=$?
set -eu
[ "$nvm_status" -eq 0 ] || { echo "nvm could not select Node 24" >&2; exit 1; }'

run_as_app_node() {
  { printf '%s\n' "$NVM_PRELUDE"; cat; } | run_as_app
}

wait_for_url() {
  local url=$1 tries=${2:-30}
  for ((i = 1; i <= tries; i++)); do
    if curl -fsS -o /dev/null --max-time 5 "$url"; then
      return 0
    fi
    sleep 2
  done
  return 1
}

# Linux user that owns the process listening on a TCP port (empty if the port is free).
port_owner() {
  local pid
  pid=$(ss -ltnpH "sport = :$1" 2>/dev/null | grep -o 'pid=[0-9]*' | head -n1 | cut -d= -f2 || true)
  if [[ -n $pid ]]; then ps -o user= -p "$pid" | tr -d ' '; fi
}

require_port_free_or_ours() {
  local owner
  owner=$(port_owner "$1")
  [[ -z $owner || $owner == "$APP_USER" ]] || fail "Port $1 is already used by user '$owner' (another app). Stop and pick a free port in CLAUDE.md first."
}

# root's own pm2 binary (system Node). Empty if root has none on its PATH.
root_pm2() { PATH=$ROOT_PATH command -v pm2 || true; }

root_pm2_daemon_running() { pgrep -u root -f 'PM2 v.*God Daemon' >/dev/null 2>&1; }

# "name status" for each of root's pm2 apps. Read-only; never starts a daemon.
root_pm2_snapshot() {
  local pm2bin
  pm2bin=$(root_pm2)
  if [[ -z $pm2bin ]] || ! root_pm2_daemon_running; then
    echo "(root pm2 not running)"
    return 0
  fi
  HOME=/root PATH=$ROOT_PATH "$pm2bin" jlist 2>/dev/null |
    python3 -c 'import json, sys
for app in json.load(sys.stdin):
    print(app["name"], app["pm2_env"]["status"])' || echo "(could not read root pm2 list)"
}

print_root_pm2_list() {
  local pm2bin
  pm2bin=$(root_pm2)
  if [[ -n $pm2bin ]] && root_pm2_daemon_running; then
    HOME=/root PATH=$ROOT_PATH "$pm2bin" list
  else
    info "(root has no running pm2 daemon on its PATH; nothing to show)"
  fi
}

# Order rate-limit cache: folder owned by kothaymilbe, absolute CACHE_DIR in backend/.env.
ensure_cache_dir() {
  install -d -o "$APP_USER" -g "$APP_USER" -m 700 "$BACKEND_DIR/.cache"
  chown -R "$APP_USER:$APP_USER" "$BACKEND_DIR/.cache"
  run_as_app <<'EOF'
cd "$APP_DIR/backend"
want="CACHE_DIR=$APP_DIR/backend/.cache"
if grep -q '^CACHE_DIR=' .env; then
  grep -qx "$want" .env || sed -i "s|^CACHE_DIR=.*|$want|" .env
else
  printf '\n%s\n' "$want" >> .env
fi
EOF
  info "cache folder: $BACKEND_DIR/.cache (owner $(stat -c %U "$BACKEND_DIR/.cache"))"
}

# Place a test order through the storefront, then delete it again.
smoke_test_order() {
  if [[ ${SKIP_TEST_ORDER:-0} == 1 ]]; then
    info "SKIP_TEST_ORDER=1: test order skipped"
    return 0
  fi
  local out number status=0
  out=$(run_as_app <<'EOF'
cd "$APP_DIR"
backend/.venv/bin/python deploy/smoke_order.py
EOF
  ) || status=$?
  number=$(printf '%s\n' "$out" | tail -n1)
  if [[ $number =~ ^KM-[0-9]{6}-[0-9]{4}$ ]]; then
    # Remove it again (also when reading it back failed) so it never shows up in Django Admin.
    run_as_app <<EOF
cd "\$APP_DIR/backend"
.venv/bin/python manage.py shell -v 0 -c "from orders.models import Order; n = Order.objects.filter(number='$number', phone='01700000000').delete()[0]; print('    test order $number removed again (%d rows)' % n)"
EOF
  fi
  [[ $status -eq 0 && $number =~ ^KM- ]] || fail "The test order through $WEB_URL/api/orders failed (see the message above)."
  find "$BACKEND_DIR/.cache" -type f -name '*.djcache' | grep -q . ||
    fail "The order went through but nothing was written to $BACKEND_DIR/.cache (rate-limit cache)."
  info "rate-limit cache is being written in $BACKEND_DIR/.cache"
}
