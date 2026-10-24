from io import StringIO

from django.core.management import call_command
from django.urls import reverse
from rest_framework.test import APITestCase

from .models import Area, Category, Product, Slot, Vendor


class SeedAndCatalogApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo", stdout=StringIO())

    def test_seed_demo_is_safe_to_run_twice(self):
        call_command("seed_demo", stdout=StringIO())
        self.assertEqual(Area.objects.count(), 2)
        self.assertEqual(Category.objects.count(), 7)
        self.assertEqual(Slot.objects.count(), 5)
        self.assertEqual(Vendor.objects.count(), 3)
        self.assertEqual(Product.objects.count(), 16)

    def test_area_names(self):
        # Spelling (incl. ড + nukta) matches docs/reference/staging-ui/index.html.
        self.assertEqual(
            list(Area.objects.values_list("name_bn", flat=True)),
            ["বসুন্ধরা আ/এ", "জলসিঁড়ি আবাসন"],
        )

    def test_product_filters(self):
        url = reverse("product-list")
        self.assertEqual(len(self.client.get(url).data), 16)

        fish = Category.objects.get(name_bn="মাছ")
        names = {p["name_bn"] for p in self.client.get(url, {"category": fish.id}).data}
        self.assertEqual(names, {"টাটকা রুই মাছ", "ইলিশ মাছ", "গলদা চিংড়ি"})

        by_vendor = self.client.get(url, {"q": "Pure Dairy"}).data
        self.assertTrue(by_vendor and all(p["vendor_name"] == "Pure Dairy (Sample)" for p in by_vendor))
        by_category = self.client.get(url, {"q": "মাছ"}).data
        self.assertEqual(len(by_category), 3)

        area = Area.objects.first()
        self.assertEqual(len(self.client.get(url, {"area": area.id}).data), 16)
        self.assertEqual(self.client.get(url, {"area": "x"}).status_code, 400)
