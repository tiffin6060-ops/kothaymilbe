# Kothay Milbe — backend (Django + DRF)

Django 5.2 LTS, Django REST Framework, Python 3.12. Apps: `catalog` (areas, categories,
slots, vendors, products) and `orders` (checkout, vendor orders, items).

## Run on your Windows PC (SQLite)

Run these in PowerShell from the `backend` folder:

```powershell
py -3.12 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt

Copy-Item .env.example .env
# Edit .env: set DEBUG=True, DB_ENGINE=sqlite,
#   ALLOWED_HOSTS=127.0.0.1,localhost
#   CSRF_TRUSTED_ORIGINS=http://127.0.0.1:8020,http://localhost:8020
# and a SECRET_KEY from:
.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(50))"

.venv\Scripts\python.exe manage.py migrate
.venv\Scripts\python.exe manage.py seed_demo          # safe to run again
.venv\Scripts\python.exe manage.py createsuperuser    # for /admin/
.venv\Scripts\python.exe manage.py test
.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8020
```

Then open http://127.0.0.1:8020/api/v1/products/ and http://127.0.0.1:8020/admin/.

Use `py -3.12` or `.venv\Scripts\python.exe`. A bare `python` on this PC is not 3.12.

## Settings (`backend/.env`, never committed)

Every variable is listed in `.env.example`. `DB_ENGINE=sqlite` uses `backend/db.sqlite3`;
`DB_ENGINE=postgres` connects to database `kothaymilbe` as role `kothaymilbe` with an empty
host and password (peer auth over the Unix socket). With `DEBUG=False`, cookies are secure,
`X-Forwarded-Proto` from Caddy is trusted, and the API only returns JSON.

## API (`/api/v1/`, no login)

| Method | Path | Notes |
|---|---|---|
| GET | `areas/` | Active areas |
| GET | `categories/` | |
| GET | `slots/` | Includes `open_today` and `closes_at_today` (Asia/Dhaka) |
| GET | `vendors/?area=<id>` | Active vendors, with fees, minimum, area and slot ids |
| GET | `products/?area=<id>&category=<id>&q=<text>` | `q` searches product, category and vendor names |
| POST | `orders/` | Needs an `Idempotency-Key` header (any unique string, max 100 chars) |
| GET | `orders/<number>/?phone=01XXXXXXXXX` | 404 unless the phone matches |

`POST orders/` body. Only ids and quantities are accepted; prices, fees and totals are always
recalculated on the server:

```json
{
  "customer_name": "রহিম",
  "phone": "01712345678",
  "area": 1,
  "address_text": "রোড ৫, ব্লক সি, বাড়ি ১২",
  "note": "",
  "delivery_date": "2026-10-23",
  "vendors": [
    {"vendor": 1, "slot": 4, "items": [{"product": 1, "qty": "1.5"}, {"product": 4, "qty": "1"}]}
  ]
}
```

Responses: `201` new order, `200` same `Idempotency-Key` again (the existing order is returned),
`409` key reused with a different phone, `400` validation error, `429` too many attempts.

Rate limit: 10 `POST orders/` attempts per hour per customer IP (`orders/throttles.py`). Requests
from 127.0.0.1 (the Next.js server) are counted by their `X-Client-IP` header; from anywhere else
`X-Client-IP` is ignored and `REMOTE_ADDR` is used. Counters live in a file cache in
`backend/.cache/` (git-ignored) so all Gunicorn workers share them. Every error has the shape
`{"detail": "<first message>", "errors": ["<all messages>"]}` with Bengali messages.

Rules checked in one transaction: area active; vendor active and serves the area; product
active, in stock and belongs to that vendor; quantity in 0.5 steps for kg, whole numbers
otherwise; slot belongs to the vendor and, for today, closes `cutoff_minutes` before it ends;
date is today or tomorrow; vendor minimum order; phone `^01[3-9]\d{8}$`. Delivery is free when
the vendor subtotal is **equal to or above** `free_delivery_above`.

## Demo data

`manage.py seed_demo` creates 2 areas, 7 categories, 5 slots, 3 vendors and 16 products.
It only creates missing rows and never overwrites values you changed in Django Admin.
