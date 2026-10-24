# Kothay Milbe — visual staging demonstration

This is a **deployable, self-contained, static HTML/CSS/JavaScript website preview** for internal design reviews.

## Deploy in 5 minutes

1. Upload `index.html` to your **staging** web root (`/var/www/kothay-milbe-preview/` or equivalent).
2. Configure your web server / hosting to serve `index.html` over HTTPS.
3. Enable password protection or VPN if the staging site is not intended for public access.
4. Test it from a mobile phone and desktop computer.
5. Share the staging URL with the team for feedback.

Example nginx config (adjust server name and paths):

```nginx
server {
    listen 80;
    server_name preview.example.com;
    root /var/www/kothay-milbe-preview;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
}
```

Use HTTPS via your existing TLS/reverse proxy, and restrict access before sharing.

## What works today

- Bengali-first responsive homepage for desktop and mobile
- Category browsing, keyword search, price sorting
- Sample product cards with vendor names and display prices
- Multi-vendor cart, sample delivery fees and checkout **simulation**
- Role switcher: customer storefront, vendor preview, admin preview
- Sample order status confirmation click (in browser only)

## NOT IMPLEMENTED (do not present as live)

- Database or Django / DRF API integration
- Real products, pricing, inventory, vendors or delivery promises
- Logins, OTP, 2FA, payments or order processing
- SMS, WhatsApp or customer-data persistence
- Fraud prevention, accessibility acceptance testing, production security

**Security note:** checkout values exist only in browser memory; never enter real customer data during testing. Demo dashboards contain fictional numbers. `Greenvalley Farm` is the intended first vendor; other vendor names are explicitly samples. The frontend imports a font from Google Fonts but falls back to system fonts if unavailable.

## Acceptance criteria for this week's server push

- [ ] Homepage loads over HTTPS from a staging URL
- [ ] Desktop and mobile layout reviewed by product/design team
- [ ] Categories, search, cart and demo checkout interact correctly
- [ ] Vendor and admin UI previews can be navigated
- [ ] All screens display an obvious STAGING / SAMPLE banner
- [ ] UI approvals / change requests captured in one issue list

Start integrating real Django API only after the UI / data contracts are agreed.
