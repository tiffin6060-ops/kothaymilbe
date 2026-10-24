from django.db import models

from catalog.models import MONEY, Area, Product, Slot, Vendor


class Order(models.Model):
    number = models.CharField("অর্ডার নম্বর", max_length=20, unique=True, help_text="KM-YYMMDD-XXXX")
    customer_name = models.CharField("গ্রাহকের নাম", max_length=100)
    phone = models.CharField("মোবাইল", max_length=11, db_index=True)
    area = models.ForeignKey(Area, verbose_name="এলাকা", on_delete=models.PROTECT, related_name="orders")
    address_text = models.TextField("ঠিকানা")
    note = models.TextField("নোট", blank=True)
    delivery_date = models.DateField("ডেলিভারির তারিখ")
    idempotency_key = models.CharField("Idempotency-Key", max_length=100, unique=True)
    grand_total = models.DecimalField("সর্বমোট", **MONEY)
    created_at = models.DateTimeField("তৈরির সময়", auto_now_add=True)

    class Meta:
        verbose_name = "অর্ডার"
        verbose_name_plural = "অর্ডারসমূহ"
        ordering = ["-created_at"]

    def __str__(self):
        return self.number


class VendorOrder(models.Model):
    class Status(models.TextChoices):
        NEW = "new", "নতুন"
        CONFIRMED = "confirmed", "কনফার্ম"
        OUT_FOR_DELIVERY = "out_for_delivery", "ডেলিভারির পথে"
        DELIVERED = "delivered", "ডেলিভারি সম্পন্ন"
        CANCELLED = "cancelled", "বাতিল"

    order = models.ForeignKey(Order, verbose_name="অর্ডার", on_delete=models.CASCADE, related_name="vendor_orders")
    vendor = models.ForeignKey(Vendor, verbose_name="বিক্রেতা", on_delete=models.PROTECT, related_name="vendor_orders")
    slot = models.ForeignKey(Slot, verbose_name="ডেলিভারি স্লট", on_delete=models.PROTECT, related_name="vendor_orders")
    status = models.CharField("অবস্থা", max_length=20, choices=Status.choices, default=Status.NEW, db_index=True)
    subtotal = models.DecimalField("সাবটোটাল", **MONEY)
    delivery_fee = models.DecimalField("ডেলিভারি চার্জ", **MONEY)
    total = models.DecimalField("মোট", **MONEY)
    cancel_reason = models.TextField("বাতিলের কারণ", blank=True)

    class Meta:
        verbose_name = "বিক্রেতার অর্ডার"
        verbose_name_plural = "বিক্রেতার অর্ডারসমূহ"
        ordering = ["-order__created_at", "id"]
        constraints = [
            models.UniqueConstraint(fields=["order", "vendor"], name="unique_vendor_per_order"),
        ]

    def __str__(self):
        return f"{self.order.number} — {self.vendor}"


class VendorOrderItem(models.Model):
    vendor_order = models.ForeignKey(
        VendorOrder, verbose_name="বিক্রেতার অর্ডার", on_delete=models.CASCADE, related_name="items"
    )
    product = models.ForeignKey(
        Product, verbose_name="পণ্য", null=True, blank=True, on_delete=models.SET_NULL, related_name="order_items"
    )
    name_snapshot = models.CharField("পণ্যের নাম (অর্ডারের সময়)", max_length=150)
    unit_snapshot = models.CharField("একক (অর্ডারের সময়)", max_length=50)
    unit_price = models.DecimalField("একক দাম", **MONEY)
    qty = models.DecimalField("পরিমাণ", max_digits=8, decimal_places=2)
    line_total = models.DecimalField("লাইন মোট", **MONEY)

    class Meta:
        verbose_name = "অর্ডারের পণ্য"
        verbose_name_plural = "অর্ডারের পণ্যসমূহ"
        ordering = ["id"]

    def __str__(self):
        return f"{self.name_snapshot} × {self.qty}"
