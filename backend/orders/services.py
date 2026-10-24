"""Order placement. The browser sends only ids and quantities; everything else is recalculated here."""

import secrets
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.db import IntegrityError, transaction
from rest_framework.exceptions import ValidationError

from catalog import timeutils
from catalog.models import Area, Product, Slot, Vendor

from .models import Order, VendorOrder, VendorOrderItem

CENT = Decimal("0.01")


def money(value):
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def fmt(value):
    """Taka amount for messages: 300.00 -> 300, 12.50 -> 12.50."""
    return f"{value:.0f}" if value == value.to_integral_value() else f"{value:.2f}"


def order_queryset():
    return Order.objects.select_related("area").prefetch_related(
        "vendor_orders__vendor", "vendor_orders__slot", "vendor_orders__items"
    )


def find_by_idempotency_key(key):
    return order_queryset().filter(idempotency_key=key).first()


def qty_step_error(product, qty):
    if product.unit_kind == Product.UnitKind.KG:
        if (qty * 2) % 1 != 0:
            return f"{product.name_bn}: পরিমাণ ০.৫ কেজির ধাপে দিন (যেমন ০.৫, ১, ১.৫)।"
    elif qty % 1 != 0:
        return f"{product.name_bn}: পরিমাণ পূর্ণ সংখ্যায় দিন।"
    return None


def generate_number(today):
    prefix = f"KM-{today:%y%m%d}-"
    for _ in range(50):
        number = f"{prefix}{secrets.randbelow(10000):04d}"
        if not Order.objects.filter(number=number).exists():
            return number
    raise RuntimeError("Could not find a free order number for today")


def place_order(data, idempotency_key):
    """Validate and create an order. Returns (order, created).

    A concurrent request with the same Idempotency-Key loses on the unique constraint
    and gets the already-created order back instead of a duplicate.
    """
    for _attempt in range(3):
        try:
            with transaction.atomic():
                return _create_order(data, idempotency_key), True
        except IntegrityError:
            existing = find_by_idempotency_key(idempotency_key)
            if existing:
                return existing, False
            # Otherwise an order-number collision with a parallel request: try again.
    raise RuntimeError("Could not create order after retries")


def _create_order(data, idempotency_key):
    now = timeutils.local_now()
    today = now.date()
    errors = []

    area = Area.objects.filter(pk=data["area"], is_active=True).first()
    if area is None:
        raise ValidationError(["এই এলাকায় এখন ডেলিভারি দেওয়া হচ্ছে না।"])

    delivery_date = data["delivery_date"]
    date_ok = delivery_date in (today, today + timedelta(days=1))
    if not date_ok:
        errors.append("ডেলিভারির তারিখ আজ অথবা আগামীকাল হতে হবে।")

    groups = data["vendors"]
    vendor_ids = [g["vendor"] for g in groups]
    if len(set(vendor_ids)) != len(vendor_ids):
        raise ValidationError(["একই বিক্রেতা একাধিকবার দেওয়া যাবে না; তার সব পণ্য এক তালিকায় দিন।"])

    vendors = Vendor.objects.filter(pk__in=vendor_ids, is_active=True).prefetch_related("areas", "slots").in_bulk()
    product_ids = [item["product"] for g in groups for item in g["items"]]
    products = Product.objects.filter(pk__in=product_ids).in_bulk()
    slots = Slot.objects.filter(pk__in=[g["slot"] for g in groups]).in_bulk()

    planned = []  # (vendor, slot, subtotal, fee, [(product, qty, line_total)])
    for group in groups:
        vendor = vendors.get(group["vendor"])
        if vendor is None:
            errors.append(f"বিক্রেতা (id {group['vendor']}) পাওয়া যায়নি বা এখন অর্ডার নিচ্ছে না।")
            continue
        if area not in vendor.areas.all():
            errors.append(f"{vendor.business_name} {area.name_bn} এলাকায় ডেলিভারি দেয় না।")

        slot = slots.get(group["slot"])
        if slot is None or slot not in vendor.slots.all():
            errors.append(f"{vendor.business_name}: এই ডেলিভারি সময়টি পাওয়া যায়নি।")
        elif date_ok and not slot.is_open(delivery_date, now):
            errors.append(
                f"{vendor.business_name}: আজকের \"{slot.label_bn}\" সময়টি বন্ধ হয়ে গেছে। অন্য সময় বা আগামীকাল বেছে নিন।"
            )

        lines = []
        seen = set()
        for item in group["items"]:
            product = products.get(item["product"])
            if product is None or not product.is_active or product.vendor_id != vendor.id:
                errors.append(f"{vendor.business_name}: পণ্য (id {item['product']}) পাওয়া যায়নি।")
                continue
            if product.id in seen:
                errors.append(f"{product.name_bn} একাধিকবার দেওয়া হয়েছে; পরিমাণ একসাথে দিন।")
                continue
            seen.add(product.id)
            if not product.in_stock:
                errors.append(f"{product.name_bn} এখন স্টকে নেই।")
                continue
            qty = item["qty"]
            step_error = qty_step_error(product, qty)
            if step_error:
                errors.append(step_error)
                continue
            lines.append((product, qty, money(product.price * qty)))

        subtotal = money(sum((line[2] for line in lines), Decimal("0")))
        if lines and subtotal < vendor.min_order:
            errors.append(
                f"{vendor.business_name}: ন্যূনতম অর্ডার ৳{fmt(vendor.min_order)}, "
                f"আপনার অর্ডার ৳{fmt(subtotal)}। আরও ৳{fmt(vendor.min_order - subtotal)}-এর পণ্য যোগ করুন।"
            )
        planned.append((vendor, slot, subtotal, vendor.delivery_fee_for(subtotal), lines))

    if errors:
        raise ValidationError(errors)

    grand_total = money(sum((subtotal + fee for _, _, subtotal, fee, _ in planned), Decimal("0")))
    order = Order.objects.create(
        number=generate_number(today),
        customer_name=data["customer_name"].strip(),
        phone=data["phone"],
        area=area,
        address_text=data["address_text"].strip(),
        note=data.get("note", "").strip(),
        delivery_date=delivery_date,
        idempotency_key=idempotency_key,
        grand_total=grand_total,
    )
    for vendor, slot, subtotal, fee, lines in planned:
        vendor_order = VendorOrder.objects.create(
            order=order, vendor=vendor, slot=slot, subtotal=subtotal, delivery_fee=fee, total=money(subtotal + fee)
        )
        VendorOrderItem.objects.bulk_create(
            VendorOrderItem(
                vendor_order=vendor_order,
                product=product,
                name_snapshot=product.name_bn,
                unit_snapshot=product.unit_label_bn,
                unit_price=product.price,
                qty=qty,
                line_total=line_total,
            )
            for product, qty, line_total in lines
        )
    return order
