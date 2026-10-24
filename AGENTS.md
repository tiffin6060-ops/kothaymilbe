# Kothay Milbe (কোথায় মিলবে) — project rules for Codex

## What this is
A curated fresh-food marketplace for Bashundhara R/A and Jalshiri Abashon, Dhaka.
Approved vendors list products, customers order online, each vendor delivers its own
orders, payment is cash on delivery. Bengali-first interface.

Right now we are building a **live DEMO** with demo products. It must look and work like
the real shop, but it is clearly labelled as a demo on every page.

## Repository layout (monorepo, public GitHub repo tiffin6060-ops/kothaymilbe)
- backend/    Django 5 + Django REST Framework (Python 3.12)
- frontend/   Next.js, Pages Router, TypeScript, Tailwind (Node 24)
- deploy/     server scripts, systemd unit, pm2 config, Caddy snippet
- docs/reference/staging-ui/   approved visual reference (index.html, desktop.png, mobile.png)

## Local machine (Windows)
- Python 3.12 via `py -3.12`; always create the backend venv with `py -3.12 -m venv .venv`.
  A bare `python` is NOT 3.12 on this PC.
- Node v24, npm, git available. Terminal is PowerShell.

## Visual reference
Match the look of docs/reference/staging-ui/index.html and its screenshots:
- Fonts: Hind Siliguri (Bengali), DM Sans (Latin/numbers)
- Colors: green #0c503c, green2 #176e52, leaf #e2f2e7, cream #faf9f3, ink #1c302c,
  muted #708078, line #e6e9df, gold #f2ae44, danger #b83f31
- Rounded cards, soft shadows, emoji product illustrations on tinted backgrounds
- Do NOT copy the role switcher (customer / vendor / admin tabs); this demo is the
  customer storefront only. Admin work happens in Django Admin.

## Production server (do not change these choices)
- Ubuntu 24.04 VPS 36.255.71.254, shared with OTHER LIVE SITES (tiffinbd.com,
  trishalgreenvalley.com, n8n, Docker apps). Breaking them is the worst possible outcome.
- Everything for Kothay Milbe runs as Linux user `kothaymilbe`, code in
  /home/kothaymilbe/kothaymilbe
- PostgreSQL 16 installed; database `kothaymilbe`, role `kothaymilbe`, peer authentication
  over the Unix socket (no password, HOST empty).
- Django: Gunicorn as systemd service `kothaymilbe-api`, bound to 127.0.0.1:8020 only,
  MemoryMax cap, Restart=always.
- Next.js: `next start` (NOT static export) under the kothaymilbe user's own pm2, bound to
  127.0.0.1:3020 only, max_memory_restart set. Node 24 comes from nvm in
  /home/kothaymilbe/.nvm (the server's system Node is 20 and belongs to other apps).
- Caddy (shared, /etc/caddy/Caddyfile) proxies:
  kothaymilbe.com -> 127.0.0.1:3020, www.kothaymilbe.com -> redirect to kothaymilbe.com,
  api.kothaymilbe.com -> 127.0.0.1:8020
- Ports already used by other apps: 3000, 3001, 3002, 3010, 4000, 5678, 6080, 8080, 2019.

## Hard rules for any server script
1. Never run apt upgrade, never install or remove system packages, never touch Docker.
2. Never stop, restart or edit root's pm2 apps (nextjs-app, tgv). Only use pm2 as the
   kothaymilbe user.
3. Caddy: back up the Caddyfile first, only APPEND the Kothay Milbe block if missing, run
   caddy validate, restore the backup and stop if validation fails, then systemctl reload
   caddy (never restart, never stop).
4. Scripts must be idempotent (safe to run twice) and use set -euo pipefail.
5. Never commit secrets. The repo is PUBLIC: .env files, keys and passwords stay out of git.
   Generate the Django SECRET_KEY on the server.

## Business rules for the demo
- One checkout can contain products from several vendors; the cart groups items by vendor.
- Each vendor group shows its own subtotal, delivery fee (free above the vendor's threshold)
  and minimum-order warning.
- Customer picks today or tomorrow, then one delivery slot per vendor. A slot closes
  1 hour before it ends (today only).
- Quantity step: 0.5 for kg items, 1 for everything else.
- Phone must be Bangladeshi format 01XXXXXXXXX (regex ^01[3-9]\d{8}$).
- The server recalculates every price, fee, minimum and slot; the browser is never trusted.
- One checkout = one Order with one VendorOrder per vendor. Items copy name, unit and price
  at order time. Money is Decimal(12,2), never float.
- Payment: cash on delivery only.
- All times Asia/Dhaka.

## Demo labelling (required)
- A banner on every page: "ডেমো সাইট — এটি এখনো আসল দোকান নয়। আসল ব্যক্তিগত তথ্য দেবেন না।"
- Sample vendors carry "(Sample)" in their name. Greenvalley Farm is the real first vendor
  but its demo prices are not real prices.

## Working style
- Keep scope to what the current prompt asks. Ask before adding big dependencies.
- Pin dependency versions. Write a short README section for anything a human must run.
- After changes, run the tests / build and report what passed and what did not.
