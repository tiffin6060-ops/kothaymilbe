# Kothay Milbe — customer storefront (Next.js)

Next.js 16 (Pages Router), TypeScript, Tailwind CSS 4, Node 24. Fonts: Hind Siliguri + DM Sans
(next/font/google). This is the customer storefront only; admin work happens in Django Admin.

## How it talks to Django

The browser never calls Django. Server-side code reads Django at `API_INTERNAL_URL`
(default `http://127.0.0.1:8020`, see `.env.example`):

| Browser | Next.js server | Django |
|---|---|---|
| `/`, `/checkout` | `getServerSideProps` | `GET /api/v1/areas/ categories/ vendors/ products/ slots/` |
| `POST /api/orders` | `src/pages/api/orders/index.ts` | `POST /api/v1/orders/` + `Idempotency-Key` + `X-Client-IP` |
| `GET /api/orders/<number>` (header `X-Customer-Phone`) | `src/pages/api/orders/[number].ts` | `GET /api/v1/orders/<number>/?phone=` |

`X-Client-IP` is the first entry of `X-Forwarded-For` (set by Caddy), so Django can rate-limit
orders per customer (10 attempts/hour). Django trusts that header only from 127.0.0.1.

Prices in the browser are a preview only (integer paisa maths); Django recalculates everything.

## Run on your Windows PC

Start Django first (see `backend/README.md`) on 127.0.0.1:8020, then from the `frontend` folder:

```powershell
npm ci
npm run dev        # http://127.0.0.1:3020 (hot reload)
```

Production-style:

```powershell
npm run build
npm start          # next start -H 127.0.0.1 -p 3020
```

Other checks: `npm run typecheck`.

## Pages

- `/` — products for the selected area (`?area=<id>`, also remembered in localStorage), category
  chips, search, price sort, cart drawer grouped by vendor (cart kept in localStorage).
- `/checkout` — customer details, today/tomorrow, one slot per vendor (slots closed for today are
  disabled, computed in Asia/Dhaka from the server clock). One Idempotency-Key per checkout
  (sessionStorage), replaced after a successful order. Django's Bengali errors are shown as-is.
- `/order/<number>` — confirmation, fetched with the phone saved in sessionStorage at checkout; if it
  is missing (new tab), the page asks for the phone number.
