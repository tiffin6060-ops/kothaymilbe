import re
from decimal import Decimal

from rest_framework import serializers

from .models import Order, VendorOrder, VendorOrderItem

PHONE_RE = re.compile(r"^01[3-9]\d{8}$")


def bn_messages(label):
    """Bengali error messages for one input field, naming the field so the message stands alone."""
    return {
        "required": f"{label} দিতে হবে।",
        "null": f"{label} দিতে হবে।",
        "blank": f"{label} খালি রাখা যাবে না।",
        "invalid": f"{label} সঠিক নয়।",
        "max_length": f"{label} খুব বড়।",
        "min_value": f"{label} খুব ছোট।",
        "max_value": f"{label} খুব বড়।",
        "max_digits": f"{label} খুব বড়।",
        "max_whole_digits": f"{label} খুব বড়।",
        "max_decimal_places": f"{label}: দশমিকের পর সর্বোচ্চ ২ ঘর দেওয়া যাবে।",
        "max_string_length": f"{label} খুব বড়।",
        "date": f"{label}: শুধু তারিখ দিন (YYYY-MM-DD)।",
        "not_a_list": f"{label} একটি তালিকা হতে হবে।",
        "empty": f"{label} খালি রাখা যাবে না।",
    }


class BnSerializer(serializers.Serializer):
    default_error_messages = {"invalid": "তথ্যগুলো সঠিক কাঠামোয় পাঠান।"}


class OrderItemInput(BnSerializer):
    product = serializers.IntegerField(min_value=1, error_messages=bn_messages("পণ্য"))
    qty = serializers.DecimalField(
        max_digits=8, decimal_places=2, min_value=Decimal("0.01"), error_messages=bn_messages("পরিমাণ")
    )


class VendorGroupInput(BnSerializer):
    vendor = serializers.IntegerField(min_value=1, error_messages=bn_messages("বিক্রেতা"))
    slot = serializers.IntegerField(min_value=1, error_messages=bn_messages("ডেলিভারি স্লট"))
    items = OrderItemInput(many=True, allow_empty=False, error_messages=bn_messages("পণ্যের তালিকা"))


class OrderInput(BnSerializer):
    """Only identifiers and quantities are accepted. Prices, fees and totals always come from the database."""

    customer_name = serializers.CharField(max_length=100, error_messages=bn_messages("নাম"))
    phone = serializers.CharField(max_length=20, error_messages=bn_messages("মোবাইল নম্বর"))
    area = serializers.IntegerField(min_value=1, error_messages=bn_messages("এলাকা"))
    address_text = serializers.CharField(max_length=500, error_messages=bn_messages("ঠিকানা"))
    note = serializers.CharField(
        max_length=500, required=False, allow_blank=True, default="", error_messages=bn_messages("নোট")
    )
    delivery_date = serializers.DateField(error_messages=bn_messages("ডেলিভারির তারিখ"))
    vendors = VendorGroupInput(many=True, allow_empty=False, error_messages=bn_messages("অর্ডারের তালিকা"))

    def validate_phone(self, value):
        phone = value.replace(" ", "").replace("-", "")
        if not PHONE_RE.match(phone):
            raise serializers.ValidationError("সঠিক মোবাইল নম্বর দিন (১১ সংখ্যা, যেমন 01712345678)।")
        return phone


class VendorOrderItemOutput(serializers.ModelSerializer):
    class Meta:
        model = VendorOrderItem
        fields = ["product_id", "name_snapshot", "unit_snapshot", "unit_price", "qty", "line_total"]


class VendorOrderOutput(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source="vendor.business_name")
    slot_label_bn = serializers.CharField(source="slot.label_bn")
    status_bn = serializers.CharField(source="get_status_display")
    items = VendorOrderItemOutput(many=True)

    class Meta:
        model = VendorOrder
        fields = [
            "vendor_id",
            "vendor_name",
            "slot_id",
            "slot_label_bn",
            "status",
            "status_bn",
            "subtotal",
            "delivery_fee",
            "total",
            "cancel_reason",
            "items",
        ]


class OrderOutput(serializers.ModelSerializer):
    area_name_bn = serializers.CharField(source="area.name_bn")
    payment_method = serializers.SerializerMethodField()
    vendor_orders = VendorOrderOutput(many=True)

    class Meta:
        model = Order
        fields = [
            "number",
            "customer_name",
            "phone",
            "area_id",
            "area_name_bn",
            "address_text",
            "note",
            "delivery_date",
            "payment_method",
            "grand_total",
            "created_at",
            "vendor_orders",
        ]

    def get_payment_method(self, order):
        return "cash_on_delivery"
