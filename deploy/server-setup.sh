#!/usr/bin/env bash
# Kothay Milbe — first-time server setup. Run ONCE as root, after cloning the repo as the
# kothaymilbe user to /home/kothaymilbe/kothaymilbe:
#
#   sudo bash /home/kothaymilbe/kothaymilbe/deploy/server-setup.sh
#
# Safe to run again (every step checks first). It only touches Kothay Milbe's own files, its
# systemd units (kothaymilbe-api, pm2-kothaymilbe), the kothaymilbe user's pm2, and appends one
# block to /etc/caddy/Caddyfile. It never installs system packages, never touches Docker and never
# stops, restarts or edits root's pm2 apps (see CLAUDE.md "Hard rules for any server script").
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

main() {
  # ---------------------------------------------------------------------------------------------
  step "a. Checks"
  require_root
  id -u "$APP_USER" >/dev/null 2>&1 ||
    fail "Linux user '$APP_USER' does not exist. Create it first (see deploy/README.md)."
  [[ $SCRIPT_DIR == "$DEPLOY_DIR" ]] ||
    fail "Run the copy inside $APP_DIR (this one is in $SCRIPT_DIR)."
  [[ -f $BACKEND_DIR/manage.py && -f $FRONTEND_DIR/package-lock.json ]] ||
    fail "The repository is not complete at $APP_DIR."
  [[ $(stat -c %U "$APP_DIR") == "$APP_USER" ]] ||
    fail "$APP_DIR must be owned by $APP_USER (clone it as that user, see deploy/README.md)."
  systemctl is-active --quiet postgresql ||
    fail "PostgreSQL is not running (check: systemctl status postgresql)."
  run_as_app <<<'psql -d kothaymilbe -tAc "select 1"' >/dev/null 2>&1 ||
    fail "Cannot open database 'kothaymilbe' as role 'kothaymilbe' over the Unix socket (peer auth). Create the role and database first (see deploy/README.md)."
  command -v python3.12 >/dev/null || fail "python3.12 not found."
  python3.12 -c 'import venv, ensurepip' 2>/dev/null ||
    fail "python3.12 cannot create virtualenvs (package python3.12-venv is missing). Ask the server admin to install it; this script never installs system packages."
  [[ -s $APP_HOME/.nvm/nvm.sh ]] || fail "nvm not found in $APP_HOME/.nvm (see deploy/README.md)."
  local node_version
  node_version=$(run_as_app_node <<<'node -v' 2>/dev/null) || node_version=""
  [[ $node_version == v24.* ]] ||
    fail "Node 24 is not installed in $APP_USER's nvm (found: '${node_version:-none}'). As $APP_USER: nvm install 24"
  if ! command -v caddy >/dev/null || [[ ! -f $CADDYFILE ]]; then fail "Caddy or $CADDYFILE not found."; fi
  systemctl is-active --quiet caddy || fail "Caddy is not running; not touching it."
  command -v curl >/dev/null || fail "curl not found."
  require_port_free_or_ours 8020
  require_port_free_or_ours 3020
  info "user $APP_USER, PostgreSQL, python3.12, Node $node_version, Caddy: OK; ports 8020/3020 free or ours"

  local root_pm2_before
  root_pm2_before=$(root_pm2_snapshot)

  # ---------------------------------------------------------------------------------------------
  step "b. Backend (Django) as $APP_USER"
  run_as_app <<'EOF'
cd "$APP_DIR/backend"
[ -x .venv/bin/python ] || python3.12 -m venv .venv
.venv/bin/pip install --disable-pip-version-check -q -r requirements.txt
if [ ! -f .env ]; then
  umask 077
  cp .env.example .env.new
  set_kv() {
    if grep -q "^$1=" .env.new; then sed -i "s|^$1=.*|$1=$2|" .env.new; else printf '%s=%s\n' "$1" "$2" >> .env.new; fi
  }
  set_kv SECRET_KEY "$(.venv/bin/python -c 'import secrets; print(secrets.token_urlsafe(50))')"
  set_kv DEBUG False
  set_kv DB_ENGINE postgres
  set_kv ALLOWED_HOSTS api.kothaymilbe.com,127.0.0.1,localhost
  set_kv CSRF_TRUSTED_ORIGINS https://api.kothaymilbe.com
  set_kv CACHE_DIR "$APP_DIR/backend/.cache"
  chmod 600 .env.new
  mv .env.new .env
  echo "    created backend/.env with a new SECRET_KEY (mode 600)"
else
  echo "    backend/.env already exists; keeping it"
fi
EOF
  ensure_cache_dir
  run_as_app <<'EOF'
cd "$APP_DIR/backend"
.venv/bin/python manage.py migrate --noinput
.venv/bin/python manage.py seed_demo
.venv/bin/python manage.py collectstatic --noinput -v 0
EOF

  # ---------------------------------------------------------------------------------------------
  step "c. API service ($API_UNIT)"
  install -m 644 -o root -g root "$DEPLOY_DIR/$API_UNIT.service" "/etc/systemd/system/$API_UNIT.service"
  systemctl daemon-reload
  if systemctl is-active --quiet "$API_UNIT"; then
    systemctl restart "$API_UNIT"
  else
    systemctl enable --now "$API_UNIT"
  fi
  systemctl enable --quiet "$API_UNIT"
  if ! wait_for_url "$API_URL/api/v1/categories/"; then
    journalctl -u "$API_UNIT" -n 40 --no-pager || true
    fail "The API did not answer on $API_URL."
  fi
  info "$(curl -fsS "$API_URL/api/v1/categories/" | head -c 120)…"

  # ---------------------------------------------------------------------------------------------
  step "d. Storefront (Next.js) as $APP_USER"
  run_as_app_node <<'EOF'
cd "$APP_DIR/frontend"
printf 'API_INTERNAL_URL=http://127.0.0.1:8020\n' > .env.production.local
npm ci --no-audit --no-fund
npm run build
command -v pm2 >/dev/null || npm install -g --no-audit --no-fund "pm2@$PM2_VERSION"
pm2 startOrReload "$APP_DIR/deploy/ecosystem.config.js" --update-env
pm2 save
EOF
  wait_for_url "$WEB_URL/" || fail "The storefront did not answer on $WEB_URL (as $APP_USER: pm2 logs $PM2_APP)."
  info "storefront answers on $WEB_URL"

  # ---------------------------------------------------------------------------------------------
  step "e. Start pm2 at boot for $APP_USER only ($PM2_UNIT)"
  local node_bin_dir
  # shellcheck disable=SC2016  # expands in the kothaymilbe user's shell, with nvm loaded
  node_bin_dir=$(run_as_app_node <<<'dirname "$(command -v node)"')
  [[ -x $node_bin_dir/pm2 ]] || fail "pm2 not found in $node_bin_dir."
  if [[ -f /etc/systemd/system/$PM2_UNIT.service ]]; then
    info "$PM2_UNIT.service already exists"
  else
    # Writes and enables pm2-kothaymilbe.service (User=kothaymilbe, PM2_HOME=/home/kothaymilbe/.pm2).
    # root's pm2 and its service (pm2-root) are separate and are not touched.
    env PATH="$node_bin_dir:$ROOT_PATH" "$node_bin_dir/pm2" startup systemd \
      -u "$APP_USER" --hp "$APP_HOME" --service-name "$PM2_UNIT"
  fi
  if ! systemctl is-active --quiet "$PM2_UNIT"; then
    # Hand the kothaymilbe pm2 daemon over to systemd: stop the one started in step d (only the
    # kothaymilbe user's daemon), then let the unit bring it back from the list saved by `pm2 save`.
    run_as_app_node <<<'pm2 kill'
    systemctl start "$PM2_UNIT"
    wait_for_url "$WEB_URL/" || fail "The storefront did not come back under $PM2_UNIT (journalctl -u $PM2_UNIT)."
  fi
  info "$PM2_UNIT: $(systemctl is-enabled "$PM2_UNIT"), $(systemctl is-active "$PM2_UNIT")"

  # ---------------------------------------------------------------------------------------------
  step "f. Caddy"
  local backup
  backup="$CADDYFILE.bak-kothaymilbe-$(date +%Y%m%d-%H%M%S)"
  cp -a "$CADDYFILE" "$backup"
  info "backup: $backup"
  local appended=0
  if grep -qE '^[[:space:]]*(https?://)?kothaymilbe\.com([[:space:],{:]|$)' "$CADDYFILE"; then
    info "a kothaymilbe.com block already exists; not appending"
  else
    cat "$DEPLOY_DIR/Caddyfile.kothaymilbe" >>"$CADDYFILE"
    appended=1
    info "appended deploy/Caddyfile.kothaymilbe"
  fi
  if ! caddy validate --config "$CADDYFILE" --adapter caddyfile; then
    cp -a "$backup" "$CADDYFILE"
    fail "caddy validate failed; restored $CADDYFILE from the backup. Caddy was not reloaded."
  fi
  if [[ $appended == 1 ]]; then
    if ! systemctl reload caddy; then
      cp -a "$backup" "$CADDYFILE"
      fail "systemctl reload caddy failed; restored $CADDYFILE (Caddy keeps running its previous config)."
    fi
    info "caddy reloaded"
  fi

  # ---------------------------------------------------------------------------------------------
  step "g. Final checks"
  wait_for_url "$API_URL/api/v1/categories/" 5 || fail "API is not answering."
  wait_for_url "$WEB_URL/" 5 || fail "Storefront is not answering."
  smoke_test_order

  echo
  info "root's pm2 apps (other sites):"
  print_root_pm2_list
  local root_pm2_after
  root_pm2_after=$(root_pm2_snapshot)
  if [[ $root_pm2_before == "$root_pm2_after" ]]; then
    info "root's pm2 apps are unchanged since the start of this script."
  else
    printf '    WARNING: root pm2 list changed during the run.\n    before:\n%s\n    after:\n%s\n' "$root_pm2_before" "$root_pm2_after"
  fi

  step "Done"
  cat <<EOF
    Shop:   https://kothaymilbe.com      (www.kothaymilbe.com redirects there)
    API:    https://api.kothaymilbe.com/api/v1/products/
    Admin:  https://api.kothaymilbe.com/admin/
    (HTTPS works once the DNS A records for all three names point to this server.)

    Create the Django admin user:
      sudo -u $APP_USER -H bash -c 'cd $BACKEND_DIR && .venv/bin/python manage.py createsuperuser'
EOF
}

main "$@"; exit $?
