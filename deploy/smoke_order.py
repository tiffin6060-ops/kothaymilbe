"""Place one test order through the storefront (Next.js /api/orders, like a browser) and read it back.

Used by server-setup.sh and deploy.sh, which delete the order again afterwards. Only the standard
library is used. Prints progress to stderr and the order number as the last line of stdout.

    backend/.venv/bin/python deploy/smoke_order.py [--web http://127.0.0.1:3020] [--api http://127.0.0.1:8020]
"""

import argparse
import json
import sys
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

DHAKA = timezone(timedelta(hours=6))
TEST_PHONE = "01700000000"
TEST_CLIENT_IP = "192.0.2.10"  # documentation range: never a real customer, so no one's rate limit is used up


def log(msg):
    print(msg, file=sys.stderr, flush=True)


def request(url, data=None, headers=None):
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, headers={"Accept": "application/json", **(headers or {})})
    if body is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            return res.status, json.load(res)
    except urllib.error.HTTPError as err:
        try:
            return err.code, json.load(err)
        except ValueError:
            return err.code, {"detail": err.reason}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--web", default="http://127.0.0.1:3020")
    parser.add_argument("--api", default="http://127.0.0.1:8020")
    args = parser.parse_args()

    _, areas = request(f"{args.api}/api/v1/areas/")
    area = areas[0]
    _, vendors = request(f"{args.api}/api/v1/vendors/?area={area['id']}")
    _, products = request(f"{args.api}/api/v1/products/?area={area['id']}")
    _, slots = request(f"{args.api}/api/v1/slots/")
    slot_order = [s["id"] for s in slots]

    for vendor in vendors:
        own = [p for p in products if p["vendor_id"] == vendor["id"] and p["in_stock"]]
        usable_slots = [s for s in slot_order if s in vendor["slot_ids"]]
        if own and usable_slots:
            break
    else:
        log("No vendor with in-stock products and delivery slots in the first area.")
        return 1

    product = min(own, key=lambda p: Decimal(p["price"]))
    step = Decimal("0.5") if product["unit_kind"] == "kg" else Decimal("1")
    qty = step
    while Decimal(product["price"]) * qty < Decimal(vendor["min_order"]):
        qty += step
    tomorrow = (datetime.now(DHAKA) + timedelta(days=1)).date().isoformat()  # tomorrow's slots are always open

    payload = {
        "customer_name": "ডিপ্লয় টেস্ট (স্বয়ংক্রিয়)",
        "phone": TEST_PHONE,
        "area": area["id"],
        "address_text": "সার্ভার যাচাই — এই অর্ডারটি সাথে সাথে মুছে ফেলা হয়",
        "note": "deploy smoke test",
        "delivery_date": tomorrow,
        "vendors": [{"vendor": vendor["id"], "slot": usable_slots[0], "items": [{"product": product["id"], "qty": str(qty)}]}],
    }
    log(f"Ordering {qty} x {product['name_bn']} from {vendor['business_name']} for {tomorrow} via {args.web}/api/orders")
    status, order = request(
        f"{args.web}/api/orders",
        payload,
        {"Idempotency-Key": f"smoke-{uuid.uuid4()}", "X-Forwarded-For": TEST_CLIENT_IP},
    )
    if status != 201 or "number" not in order:
        log(f"Order was not created: HTTP {status} {json.dumps(order, ensure_ascii=False)}")
        return 1

    number = order["number"]
    status, again = request(f"{args.web}/api/orders/{number}", headers={"X-Customer-Phone": TEST_PHONE})
    if status != 200 or again.get("grand_total") != order["grand_total"]:
        log(f"Order {number} was created but could not be read back: HTTP {status}")
        print(number)
        return 1

    log(f"OK: order {number}, total {order['grand_total']}, read back through the storefront")
    print(number)
    return 0


if __name__ == "__main__":
    sys.exit(main())
