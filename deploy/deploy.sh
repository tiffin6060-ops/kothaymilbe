#!/usr/bin/env bash
# Kothay Milbe — deploy the latest code from GitHub. Run as root after server-setup.sh has run once:
#
#   sudo bash /home/kothaymilbe/kothaymilbe/deploy/deploy.sh
#
# Touches only Kothay Milbe (its code, kothaymilbe-api, the kothaymilbe user's pm2 app).
# Set SKIP_TEST_ORDER=1 to skip the test order at the end.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

# Everything runs inside main(), called on the last line: bash has then read the whole file, so
# `git pull` replacing this script mid-run cannot change what is executed.
main() {
  step "Checks"
  require_root
  [[ -f /etc/systemd/system/$API_UNIT.service && -f $BACKEND_DIR/.env ]] ||
    fail "Run deploy/server-setup.sh once first."
  local root_pm2_before
  root_pm2_before=$(root_pm2_snapshot)
  info "ok"

  step "1. git pull (as $APP_USER)"
  run_as_app <<'EOF'
cd "$APP_DIR"
git pull --ff-only
git log -1 --format='    now at %h %s (%cr)'
EOF

  step "2. Backend: install, migrate, collectstatic"
  run_as_app <<'EOF'
cd "$APP_DIR/backend"
.venv/bin/pip install --disable-pip-version-check -q -r requirements.txt
EOF
  ensure_cache_dir
  run_as_app <<'EOF'
cd "$APP_DIR/backend"
.venv/bin/python manage.py migrate --noinput
.venv/bin/python manage.py collectstatic --noinput -v 0
EOF

  step "3. Restart $API_UNIT"
  if ! cmp -s "$DEPLOY_DIR/$API_UNIT.service" "/etc/systemd/system/$API_UNIT.service"; then
    install -m 644 -o root -g root "$DEPLOY_DIR/$API_UNIT.service" "/etc/systemd/system/$API_UNIT.service"
    systemctl daemon-reload
    info "updated the systemd unit from deploy/$API_UNIT.service"
  fi
  systemctl restart "$API_UNIT"
  if ! wait_for_url "$API_URL/api/v1/categories/"; then
    journalctl -u "$API_UNIT" -n 40 --no-pager || true
    fail "The API did not come back on $API_URL."
  fi
  info "API answers on $API_URL"

  step "4. Storefront: npm ci, build, pm2 reload (as $APP_USER)"
  run_as_app_node <<'EOF'
cd "$APP_DIR/frontend"
printf 'API_INTERNAL_URL=http://127.0.0.1:8020\n' > .env.production.local
npm ci --no-audit --no-fund
npm run build
pm2 startOrReload "$APP_DIR/deploy/ecosystem.config.js" --only kothaymilbe-web --update-env
pm2 save
EOF

  step "5. Checks"
  wait_for_url "$API_URL/api/v1/categories/" 5 || fail "API ($API_URL) is not answering."
  info "API        $API_URL: OK"
  wait_for_url "$WEB_URL/" 15 || fail "Storefront ($WEB_URL) is not answering (as $APP_USER: pm2 logs $PM2_APP)."
  info "Storefront $WEB_URL: OK"
  smoke_test_order
  local root_pm2_after
  root_pm2_after=$(root_pm2_snapshot)
  if [[ $root_pm2_before == "$root_pm2_after" ]]; then
    info "root's pm2 apps unchanged"
  else
    printf '    WARNING: root pm2 list changed during the run:\n%s\n' "$root_pm2_after"
  fi

  step "Deployed"
}

main "$@"; exit $?
