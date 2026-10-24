from datetime import date, datetime, time
from decimal import Decimal
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APIRequestFactory, APITestCase

from catalog.models import Area, Category, Product, Slot, Vendor

from .models import Order, VendorOrder
from .throttles import OrderRateThrottle

DHAKA = ZoneInfo("Asia/Dhaka")
NOW = datetime(2026, 10, 23, 9, 30, tzinfo=DHAKA)  # morning slot (8–10, cutoff 60) closed at 09:00
TODAY = date(2026, 10, 23)
TOMORROW = date(2026, 10, 24)

# Throttle counters live in the cache; give every test a fresh in-memory one.
LOCMEM = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}


@override_settings(CACHES=LOCMEM)
class OrderApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.area = Area.objects.create(name_bn="বসুন্ধরা আ/এ", name_en="Bashundhara R/A")
        cls.morning = Slot.objects.create(label_bn="সকাল ৮টা – ১০টা", start_time=time(8), end_time=time(10))
        cls.evening = Slot.objects.create(label_bn="বিকেল ৪টা – ৬টা", start_time=time(16), end_time=time(18))
        veg = Category.objects.create(name_bn="সবজি")
        fish = Category.objects.create(name_bn="মাছ")

        cls.gv = Vendor.objects.create(
            code="greenvalley", business_name="Greenvalley Farm", is_own_farm=True,
            delivery_fee=Decimal("50"), free_delivery_above=Decimal("1500"), min_order=Decimal("300"),
        )
        cls.fc = Vendor.objects.create(
            code="fresh-catch", business_name="Fresh Catch (Sample)",
            delivery_fee=Decimal("60"), free_delivery_above=Decimal("2000"), min_order=Decimal("500"),
        )
        for vendor in (cls.gv, cls.fc):
            vendor.areas.add(cls.area)
            vendor.slots.add(cls.morning, cls.evening)

        def product(vendor, name, kind, price, **extra):
            return Product.objects.create(
                vendor=vendor, category=extra.pop("category", veg), name_bn=name, unit_label_bn="প্রতি কেজি",
                unit_kind=kind, price=Decimal(price), **extra,
            )

        cls.tomato = product(cls.gv, "ফ্রেশ লাল টমেটো", "kg", "85")
        cls.chicken = product(cls.gv, "দেশি মুরগি", "kg", "390")
        cls.eggs = product(cls.gv, "দেশি মুরগির ডিম", "piece", "72")
        cls.rui = product(cls.fc, "টাটকা রুই মাছ", "kg", "340", category=fish)

    def setUp(self):
        cache.clear()
        patcher = patch("catalog.timeutils.local_now", return_value=NOW)
        patcher.start()
        self.addCleanup(patcher.stop)

    def payload(self, groups, phone="01712345678", delivery_date=TODAY):
        return {
            "customer_name": "রহিম",
            "phone": phone,
            "area": self.area.id,
            "address_text": "রোড ৫, ব্লক সি, বাড়ি ১২",
            "delivery_date": delivery_date.isoformat(),
            "vendors": [
                {"vendor": v.id, "slot": s.id, "items": [{"product": p.id, "qty": q} for p, q in items]}
                for v, s, items in groups
            ],
        }

    def post(self, data, key="key-1"):
        return self.client.post(reverse("order-create"), data, format="json", HTTP_IDEMPOTENCY_KEY=key)

    def test_two_vendor_cart_totals(self):
        data = self.payload([
            (self.gv, self.evening, [(self.tomato, "2"), (self.chicken, "1.5")]),
            (self.fc, self.evening, [(self.rui, "2")]),
        ])
        # Prices sent by the browser must be ignored.
        data["grand_total"] = "1"
        data["vendors"][0]["items"][0]["price"] = "1"

        res = self.post(data)

        self.assertEqual(res.status_code, 201, res.data)
        self.assertRegex(res.data["number"], r"^KM-261023-\d{4}$")
        gv, fc = res.data["vendor_orders"]
        self.assertEqual((gv["subtotal"], gv["delivery_fee"], gv["total"]), ("755.00", "50.00", "805.00"))
        self.assertEqual((fc["subtotal"], fc["delivery_fee"], fc["total"]), ("680.00", "60.00", "740.00"))
        self.assertEqual(res.data["grand_total"], "1545.00")
        self.assertEqual(gv["items"][0]["unit_price"], "85.00")
        self.assertEqual(gv["items"][0]["line_total"], "170.00")
        self.assertEqual(gv["items"][1]["line_total"], "585.00")
        order = Order.objects.get()
        self.assertEqual(order.vendor_orders.count(), 2)
        self.assertEqual(order.grand_total, Decimal("1545.00"))

    def test_item_snapshot_survives_price_change(self):
        res = self.post(self.payload([(self.gv, self.evening, [(self.chicken, "1")])]))
        self.assertEqual(res.status_code, 201, res.data)
        Product.objects.filter(pk=self.chicken.pk).update(price=Decimal("999"), name_bn="নতুন নাম")
        item = VendorOrder.objects.get().items.get()
        self.assertEqual((item.name_snapshot, item.unit_price), ("দেশি মুরগি", Decimal("390.00")))

    def test_free_delivery_at_or_above_threshold(self):
        res = self.post(self.payload([(self.gv, self.evening, [(self.chicken, "4")])]))  # 1560 >= 1500
        self.assertEqual(res.status_code, 201, res.data)
        vo = res.data["vendor_orders"][0]
        self.assertEqual((vo["subtotal"], vo["delivery_fee"], vo["total"]), ("1560.00", "0.00", "1560.00"))

        Vendor.objects.filter(pk=self.gv.pk).update(free_delivery_above=Decimal("1560"))  # exactly equal
        res = self.post(self.payload([(self.gv, self.evening, [(self.chicken, "4")])]), key="key-2")
        self.assertEqual(res.data["vendor_orders"][0]["delivery_fee"], "0.00")

    def test_below_minimum_rejected(self):
        res = self.post(self.payload([(self.gv, self.evening, [(self.tomato, "1")])]))  # 85 < 300
        self.assertEqual(res.status_code, 400)
        self.assertIn("ন্যূনতম অর্ডার ৳300", res.data["detail"])
        self.assertEqual(Order.objects.count(), 0)

    def test_closed_slot_rejected_today_but_open_tomorrow(self):
        res = self.post(self.payload([(self.gv, self.morning, [(self.chicken, "1")])]))
        self.assertEqual(res.status_code, 400)
        self.assertIn("বন্ধ হয়ে গেছে", res.data["detail"])
        self.assertEqual(Order.objects.count(), 0)

        res = self.post(self.payload([(self.gv, self.morning, [(self.chicken, "1")])], delivery_date=TOMORROW), key="k2")
        self.assertEqual(res.status_code, 201, res.data)

    def test_delivery_date_must_be_today_or_tomorrow(self):
        res = self.post(self.payload([(self.gv, self.evening, [(self.chicken, "1")])], delivery_date=date(2026, 10, 25)))
        self.assertEqual(res.status_code, 400)
        self.assertIn("আজ অথবা আগামীকাল", res.data["detail"])

    def test_bad_phone_rejected(self):
        for phone in ["01212345678", "0171234567", "017123456789", "+8801712345678", "abcdefghijk", ""]:
            with self.subTest(phone=phone):
                res = self.post(self.payload([(self.gv, self.evening, [(self.chicken, "1")])], phone=phone))
                self.assertEqual(res.status_code, 400)
                self.assertIn("মোবাইল নম্বর", res.data["detail"])
        self.assertEqual(Order.objects.count(), 0)

    def test_qty_steps(self):
        res = self.post(self.payload([(self.gv, self.evening, [(self.chicken, "1.25")])]))
        self.assertEqual(res.status_code, 400)
        self.assertIn("০.৫ কেজির ধাপে", res.data["detail"])

        res = self.post(self.payload([(self.gv, self.evening, [(self.chicken, "1"), (self.eggs, "1.5")])]))
        self.assertEqual(res.status_code, 400)
        self.assertIn("পূর্ণ সংখ্যায়", res.data["detail"])

    def test_product_from_other_vendor_rejected(self):
        res = self.post(self.payload([(self.gv, self.evening, [(self.rui, "2")])]))
        self.assertEqual(res.status_code, 400)
        self.assertEqual(Order.objects.count(), 0)

    def test_same_idempotency_key_creates_only_one_order(self):
        data = self.payload([(self.gv, self.evening, [(self.chicken, "1")])])
        first = self.post(data, key="same-key")
        second = self.post(data, key="same-key")

        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(second.status_code, 200, second.data)
        self.assertEqual(first.data["number"], second.data["number"])
        self.assertEqual(Order.objects.count(), 1)
        self.assertEqual(VendorOrder.objects.count(), 1)

        other_phone = self.post(self.payload([(self.gv, self.evening, [(self.chicken, "1")])], phone="01812345678"), key="same-key")
        self.assertEqual(other_phone.status_code, 409)
        self.assertEqual(Order.objects.count(), 1)

    def test_missing_idempotency_key_rejected(self):
        res = self.client.post(reverse("order-create"), self.payload([(self.gv, self.evening, [(self.chicken, "1")])]), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Idempotency-Key", res.data["detail"])

    def test_order_lookup_requires_matching_phone(self):
        number = self.post(self.payload([(self.gv, self.evening, [(self.chicken, "1")])])).data["number"]
        url = reverse("order-detail", args=[number])

        self.assertEqual(self.client.get(url, {"phone": "01712345678"}).status_code, 200)
        self.assertEqual(self.client.get(url, {"phone": "01812345678"}).status_code, 404)
        self.assertEqual(self.client.get(url).status_code, 404)


@override_settings(CACHES=LOCMEM)
class OrderThrottleTests(APITestCase):
    """10 order attempts per hour per customer IP. Only Next.js on 127.0.0.1 may say who the customer is."""

    def setUp(self):
        cache.clear()

    def attempt(self, remote_addr, client_ip=None):
        extra = {"REMOTE_ADDR": remote_addr}
        if client_ip:
            extra["HTTP_X_CLIENT_IP"] = client_ip
        # An empty body is rejected with 400, but every attempt still counts towards the limit.
        return self.client.post(reverse("order-create"), {}, format="json", **extra)

    def test_limit_is_per_customer_ip_sent_by_nextjs(self):
        for _ in range(10):
            self.assertEqual(self.attempt("127.0.0.1", "203.0.113.5").status_code, 400)

        blocked = self.attempt("127.0.0.1", "203.0.113.5")
        self.assertEqual(blocked.status_code, 429)
        self.assertIn("অনেকবার চেষ্টা করা হয়েছে", blocked.data["detail"])
        self.assertNotIn("Expected", blocked.data["detail"])
        self.assertIn("Retry-After", blocked.headers)

        # Another customer behind the same Next.js server is not affected.
        self.assertEqual(self.attempt("127.0.0.1", "203.0.113.6").status_code, 400)

    def test_x_client_ip_is_ignored_from_untrusted_addresses(self):
        for i in range(10):
            self.assertEqual(self.attempt("198.51.100.7", f"10.0.0.{i}").status_code, 400)
        self.assertEqual(self.attempt("198.51.100.7", "10.0.0.99").status_code, 429)

    def test_get_ident(self):
        factory = APIRequestFactory()
        throttle = OrderRateThrottle()
        cases = [
            ({"REMOTE_ADDR": "127.0.0.1", "HTTP_X_CLIENT_IP": "203.0.113.5"}, "203.0.113.5"),
            ({"REMOTE_ADDR": "::1", "HTTP_X_CLIENT_IP": "2001:db8::1"}, "2001:db8::1"),
            ({"REMOTE_ADDR": "127.0.0.1", "HTTP_X_CLIENT_IP": "not-an-ip"}, "127.0.0.1"),
            ({"REMOTE_ADDR": "127.0.0.1"}, "127.0.0.1"),
            ({"REMOTE_ADDR": "198.51.100.7", "HTTP_X_CLIENT_IP": "203.0.113.5"}, "198.51.100.7"),
        ]
        for meta, expected in cases:
            with self.subTest(meta=meta):
                self.assertEqual(throttle.get_ident(factory.post("/", **meta)), expected)
