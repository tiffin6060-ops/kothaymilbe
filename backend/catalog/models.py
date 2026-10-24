from datetime import datetime, timedelta
from decimal import Decimal

from django.db import models
from django.utils import timezone

MONEY = {"max_digits": 12, "decimal_places": 2}


class Area(models.Model):
    name_bn = models.CharField("নাম (বাংলা)", max_length=100)
    name_en = models.CharField("নাম (ইংরেজি)", max_length=100, unique=True)
    is_active = models.BooleanField("সক্রিয়", default=True)

    class Meta:
        verbose_name = "এলাকা"
        verbose_name_plural = "এলাকাসমূহ"
        ordering = ["id"]

    def __str__(self):
        return self.name_bn


class Category(models.Model):
    name_bn = models.CharField("নাম", max_length=100, unique=True)
    emoji = models.CharField("ইমোজি", max_length=16, blank=True)
    sort_order = models.PositiveIntegerField("ক্রম", default=0)

    class Meta:
        verbose_name = "ক্যাটাগরি"
        verbose_name_plural = "ক্যাটাগরিসমূহ"
        ordering = ["sort_order", "id"]

    def __str__(self):
        return self.name_bn


class Slot(models.Model):
    label_bn = models.CharField("লেবেল", max_length=100)
    start_time = models.TimeField("শুরু")
    end_time = models.TimeField("শেষ")
    cutoff_minutes = models.PositiveIntegerField(
        "কাট-অফ (মিনিট)", default=60, help_text="আজকের জন্য স্লট শেষ হওয়ার এত মিনিট আগে অর্ডার বন্ধ হয়।"
    )

    class Meta:
        verbose_name = "ডেলিভারি স্লট"
        verbose_name_plural = "ডেলিভারি স্লটসমূহ"
        ordering = ["start_time", "id"]
        constraints = [
            models.UniqueConstraint(fields=["start_time", "end_time"], name="unique_slot_times"),
        ]

    def __str__(self):
        return self.label_bn

    def closes_at(self, delivery_date):
        """Aware datetime (Asia/Dhaka) after which this slot cannot be booked for delivery_date."""
        end = timezone.make_aware(datetime.combine(delivery_date, self.end_time))
        return end - timedelta(minutes=self.cutoff_minutes)

    def is_open(self, delivery_date, now):
        return now < self.closes_at(delivery_date)


class Vendor(models.Model):
    code = models.SlugField("কোড", max_length=50, unique=True)
    business_name = models.CharField("ব্যবসার নাম", max_length=150)
    about_bn = models.TextField("পরিচিতি", blank=True)
    is_own_farm = models.BooleanField("নিজস্ব খামার", default=False)
    is_active = models.BooleanField("সক্রিয়", default=True)
    delivery_fee = models.DecimalField("ডেলিভারি চার্জ", **MONEY)
    free_delivery_above = models.DecimalField(
        "ফ্রি ডেলিভারি (এর সমান বা বেশি হলে)", **MONEY
    )
    min_order = models.DecimalField("ন্যূনতম অর্ডার", **MONEY)
    areas = models.ManyToManyField(Area, verbose_name="এলাকা", related_name="vendors", blank=True)
    slots = models.ManyToManyField(Slot, verbose_name="ডেলিভারি স্লট", related_name="vendors", blank=True)

    class Meta:
        verbose_name = "বিক্রেতা"
        verbose_name_plural = "বিক্রেতাগণ"
        ordering = ["id"]

    def __str__(self):
        return self.business_name

    def delivery_fee_for(self, subtotal):
        return Decimal("0.00") if subtotal >= self.free_delivery_above else self.delivery_fee


class Product(models.Model):
    class UnitKind(models.TextChoices):
        KG = "kg", "কেজি (০.৫ ধাপে)"
        PIECE = "piece", "পিস"
        OTHER = "other", "অন্যান্য"

    vendor = models.ForeignKey(Vendor, verbose_name="বিক্রেতা", on_delete=models.PROTECT, related_name="products")
    category = models.ForeignKey(
        Category, verbose_name="ক্যাটাগরি", on_delete=models.PROTECT, related_name="products"
    )
    name_bn = models.CharField("নাম", max_length=150)
    unit_label_bn = models.CharField("একক", max_length=50, help_text="যেমন: প্রতি কেজি, ৬ পিস")
    unit_kind = models.CharField("এককের ধরন", max_length=10, choices=UnitKind.choices, default=UnitKind.PIECE)
    price = models.DecimalField("দাম", **MONEY)
    previous_price = models.DecimalField("আগের দাম", null=True, blank=True, **MONEY)
    in_stock = models.BooleanField("স্টকে আছে", default=True)
    badge_bn = models.CharField("ব্যাজ", max_length=50, blank=True)
    emoji = models.CharField("ইমোজি", max_length=16, blank=True)
    bg_color = models.CharField("ব্যাকগ্রাউন্ড রং", max_length=7, default="#e2f2e7")
    sort_order = models.PositiveIntegerField("ক্রম", default=0)
    is_active = models.BooleanField("সক্রিয়", default=True)

    class Meta:
        verbose_name = "পণ্য"
        verbose_name_plural = "পণ্যসমূহ"
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(fields=["vendor", "name_bn"], name="unique_product_name_per_vendor"),
        ]

    def __str__(self):
        return f"{self.name_bn} ({self.vendor})"
