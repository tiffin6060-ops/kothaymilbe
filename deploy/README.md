# Deploying Kothay Milbe to the server

Server: Ubuntu 24.04, `36.255.71.254`, shared with other live sites. Everything for Kothay Milbe
runs as the Linux user `kothaymilbe` from `/home/kothaymilbe/kothaymilbe`.

| Part | How it runs | Address |
|---|---|---|
| Django API | systemd `kothaymilbe-api` (Gunicorn, 3 workers, MemoryMax 700M) | 127.0.0.1:8020 |
| Next.js storefront | kothaymilbe's own pm2, app `kothaymilbe-web` (max 600M), started at boot by `pm2-kothaymilbe` | 127.0.0.1:3020 |
| Caddy (shared) | appended block from `Caddyfile.kothaymilbe` | kothaymilbe.com, www → redirect, api.kothaymilbe.com |

The scripts never install system packages, never touch Docker, never stop/restart/edit root's pm2
apps and only append to the Caddyfile (backup → append if missing → `caddy validate` → restore on
failure → `systemctl reload caddy`). Both scripts are safe to run twice.

## 0. Before the first setup (once, as root)

DNS: point the A records of `kothaymilbe.com`, `www.kothaymilbe.com` and `api.kothaymilbe.com`
to `36.255.71.254`. Caddy gets the HTTPS certificates by itself once DNS is correct.

Skip any line that is already done:

```bash
# Linux user
sudo adduser --disabled-password --gecos "" kothaymilbe

# PostgreSQL role + database (peer auth over the Unix socket, no password)
sudo -u postgres createuser kothaymilbe
sudo -u postgres createdb -O kothaymilbe kothaymilbe

# nvm + Node 24 for the kothaymilbe user only (the system Node 20 belongs to other apps)
sudo -iu kothaymilbe bash -c 'curl -fsSo- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash'
sudo -iu kothaymilbe bash -c 'source ~/.nvm/nvm.sh && nvm install 24'

# The code, cloned as kothaymilbe
sudo -iu kothaymilbe git clone https://github.com/tiffin6060-ops/kothaymilbe.git /home/kothaymilbe/kothaymilbe
```

`server-setup.sh` checks all of this (plus `python3.12` with venv support, Caddy running and ports
8020/3020 free) and stops with a clear message if something is missing.

## 1. First setup (once)

```bash
sudo bash /home/kothaymilbe/kothaymilbe/deploy/server-setup.sh
```

It creates `backend/.venv`, `backend/.env` (new SECRET_KEY, DEBUG=False, PostgreSQL, mode 600) and the
rate-limit cache folder `backend/.cache`; runs migrate, `seed_demo` and collectstatic; installs and
starts `kothaymilbe-api`; builds the storefront and starts it in kothaymilbe's pm2 (installing pm2
7.1.1 into kothaymilbe's nvm if needed); enables `pm2-kothaymilbe` for reboots; appends the Caddy
block; places one test order through the storefront and deletes it again; and finally prints root's
pm2 list so you can see the other sites are still online.

Then create the Django admin user:

```bash
sudo -u kothaymilbe -H bash -c 'cd /home/kothaymilbe/kothaymilbe/backend && .venv/bin/python manage.py createsuperuser'
```

Open https://kothaymilbe.com and https://api.kothaymilbe.com/admin/.

## 2. Updates (after pushing to GitHub)

```bash
sudo bash /home/kothaymilbe/kothaymilbe/deploy/deploy.sh
```

git pull → pip install → migrate → collectstatic → restart `kothaymilbe-api` → npm ci → build →
`pm2 reload` → checks both ports → test order (deleted again). Add `SKIP_TEST_ORDER=1` in front to
skip the test order. While `npm run build` runs (1–2 minutes) the storefront may briefly show errors.

Changes to `Caddyfile.kothaymilbe` are **not** applied by these scripts once the block exists; edit
`/etc/caddy/Caddyfile` by hand (back it up, `caddy validate`, `systemctl reload caddy`).

## Status and logs

```bash
systemctl status kothaymilbe-api
journalctl -u kothaymilbe-api -n 100 --no-pager
systemctl status pm2-kothaymilbe
sudo -iu kothaymilbe bash -c 'source ~/.nvm/nvm.sh && pm2 status && pm2 logs kothaymilbe-web --lines 50 --nostream'
curl -s http://127.0.0.1:8020/api/v1/categories/ | head -c 200; echo
curl -sI http://127.0.0.1:3020/ | head -n 1
```

Caddyfile backups: `/etc/caddy/Caddyfile.bak-kothaymilbe-<date>-<time>`.

## Notes

- Requests to `api.kothaymilbe.com` reach Django from 127.0.0.1, just like the storefront's own
  calls. The Caddy block therefore overwrites `X-Client-IP` with the visitor's real address, so the
  order rate limit (10 attempts per hour per IP) cannot be dodged by sending a fake header.
- `backend/.env` holds the SECRET_KEY: it stays on the server and is never committed.
- `next build` needs roughly 1 GB of free memory; check `free -h` if a build gets killed.
