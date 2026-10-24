"""Load DEMO areas, categories, slots, vendors and products.

Safe to run repeatedly: rows are matched on a natural key and only created when missing,
so values edited later in Django Admin are never overwritten.
"""

from datetime import time
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from catalog.models import Area, Category, Product, Slot, Vendor

AREAS = [
    ("বসুন্ধরা আ/এ", "Bashundhara R/A"),
    ("জলসিঁড়ি আবাসন", "Jalshiri Abashon"),
]

# From docs/reference/staging-ui/index.html ("সব" is the all-products filter, not a category).
CATEGORIES = [
    ("সবজি", "🥬"),
    ("ফল", "🍋"),
    ("মাছ", "🐟"),
    ("মাংস", "🍗"),
    ("দুধ-ডিম", "🥚"),
    ("মধু", "🍯"),
    ("মসলা", "🌶️"),
]

SLOTS = [
    ("সকাল ৮টা – ১০টা", time(8), time(10)),
    ("সকাল ১০টা – দুপুর ১২টা", time(10), time(12)),
    ("দুপুর ১২টা – ২টা", time(12), time(14)),
    ("বিকেল ৪টা – ৬টা", time(16), time(18)),
    ("সন্ধ্যা ৬টা – রাত ৮টা", time(18), time(20)),
]

# code, name, about, own farm, fee, free above, minimum (DEMO values)
VENDORS = [
    ("greenvalley", "Greenvalley Farm", "আমাদের নিজস্ব খামারের টাটকা সবজি, ডিম ও মুরগি। (ডেমো দাম, আসল দাম নয়)", True, "50", "1500", "300"),
    ("fresh-catch", "Fresh Catch (Sample)", "নমুনা বিক্রেতা — তাজা নদীর মাছ।", False, "60", "2000", "500"),
    ("pure-dairy", "Pure Dairy (Sample)", "নমুনা বিক্রেতা — দুধ, দই, ঘি ও মধু।", False, "40", "1000", "200"),
]

# vendor code, category, name, unit label, unit kind, price, previous price, emoji, bg, badge
PRODUCTS = [
    # The 8 products from the reference index.html
    ("greenvalley", "সবজি", "ফ্রেশ লাল টমেটো", "প্রতি কেজি", "kg", "85", None, "🍅", "#fbe7dc", "ফার্ম ফ্রেশ"),
    ("greenvalley", "দুধ-ডিম", "দেশি মুরগির ডিম", "৬ পিস", "piece", "72", None, "🥚", "#f5f0dc", "নিজস্ব খামার"),
    ("fresh-catch", "মাছ", "টাটকা রুই মাছ", "প্রতি কেজি", "kg", "340", None, "🐟", "#ddeef2", "তাজা মাছ"),
    ("greenvalley", "মাংস", "দেশি মুরগি", "প্রতি কেজি", "kg", "390", None, "🍗", "#fae9d9", "ফার্ম ফ্রেশ"),
    ("pure-dairy", "মধু", "প্রাকৃতিক মধু", "৫০০ গ্রাম", "other", "450", None, "🍯", "#fdf0d2", "প্রাকৃতিক"),
    ("pure-dairy", "দুধ-ডিম", "তাজা গরুর দুধ", "প্রতি লিটার", "other", "100", None, "🥛", "#dfeef4", "তাজা"),
    ("greenvalley", "মসলা", "কাঁচা মরিচ", "প্রতি ৫০০ গ্রাম", "other", "95", None, "🌶️", "#e5f4dc", "ফার্ম ফ্রেশ"),
    ("greenvalley", "ফল", "হলুদ লেবু", "৪ পিস", "piece", "60", None, "🍋", "#f5f2d5", "তাজা"),
    # 8 more demo items
    ("greenvalley", "সবজি", "দেশি আলু", "প্রতি কেজি", "kg", "55", None, "🥔", "#f3ead8", "ফার্ম ফ্রেশ"),
    ("greenvalley", "সবজি", "কচি লাউ", "প্রতি পিস", "piece", "70", None, "🥒", "#e5f4dc", "নিজস্ব খামার"),
    ("greenvalley", "ফল", "সাগর কলা", "১ ডজন", "piece", "120", None, "🍌", "#fbf3d1", "তাজা"),
    ("greenvalley", "মাংস", "গরুর মাংস", "প্রতি কেজি", "kg", "780", None, "🥩", "#f8e1dc", "ফার্ম ফ্রেশ"),
    ("fresh-catch", "মাছ", "ইলিশ মাছ", "প্রতি কেজি", "kg", "1450", "1600", "🐟", "#dde8f4", "অফার"),
    ("fresh-catch", "মাছ", "গলদা চিংড়ি", "প্রতি কেজি", "kg", "950", None, "🦐", "#fbe3dc", "তাজা মাছ"),
    ("pure-dairy", "দুধ-ডিম", "টক দই", "৫০০ গ্রাম", "other", "180", None, "🥣", "#eef0f6", "ঘরে পাতা"),
    ("pure-dairy", "মসলা", "হলুদ গুঁড়া", "২০০ গ্রাম", "other", "160", None, "🧂", "#fbf0cf", "খাঁটি"),
]


class Command(BaseCommand):
    help = "Load DEMO data (safe to run more than once; never overwrites admin edits)."

    @transaction.atomic
    def handle(self, *args, **options):
        created = {"areas": 0, "categories": 0, "slots": 0, "vendors": 0, "products": 0}

        areas = []
        for name_bn, name_en in AREAS:
            area, new = Area.objects.get_or_create(name_en=name_en, defaults={"name_bn": name_bn})
            areas.append(area)
            created["areas"] += new

        categories = {}
        for order, (name_bn, emoji) in enumerate(CATEGORIES, start=1):
            cat, new = Category.objects.get_or_create(name_bn=name_bn, defaults={"emoji": emoji, "sort_order": order})
            categories[name_bn] = cat
            created["categories"] += new

        slots = []
        for label, start, end in SLOTS:
            slot, new = Slot.objects.get_or_create(start_time=start, end_time=end, defaults={"label_bn": label})
            slots.append(slot)
            created["slots"] += new

        vendors = {}
        for code, name, about, own_farm, fee, free_above, minimum in VENDORS:
            vendor, new = Vendor.objects.get_or_create(
                code=code,
                defaults={
                    "business_name": name,
                    "about_bn": about,
                    "is_own_farm": own_farm,
                    "delivery_fee": Decimal(fee),
                    "free_delivery_above": Decimal(free_above),
                    "min_order": Decimal(minimum),
                },
            )
            if new:
                vendor.areas.set(areas)
                vendor.slots.set(slots)
            vendors[code] = vendor
            created["vendors"] += new

        for order, (code, cat, name, unit, kind, price, prev, emoji, bg, badge) in enumerate(PRODUCTS, start=1):
            _, new = Product.objects.get_or_create(
                vendor=vendors[code],
                name_bn=name,
                defaults={
                    "category": categories[cat],
                    "unit_label_bn": unit,
                    "unit_kind": kind,
                    "price": Decimal(price),
                    "previous_price": Decimal(prev) if prev else None,
                    "emoji": emoji,
                    "bg_color": bg,
                    "badge_bn": badge,
                    "sort_order": order,
                },
            )
            created["products"] += new

        summary = ", ".join(f"{key}: {count}" for key, count in created.items())
        self.stdout.write(self.style.SUCCESS(f"seed_demo done. Newly created -> {summary}"))
