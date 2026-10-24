from rest_framework import serializers

from . import timeutils
from .models import Area, Category, Product, Slot, Vendor


class AreaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Area
        fields = ["id", "name_bn", "name_en"]


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name_bn", "emoji", "sort_order"]


class SlotSerializer(serializers.ModelSerializer):
    open_today = serializers.SerializerMethodField()
    closes_at_today = serializers.SerializerMethodField()

    class Meta:
        model = Slot
        fields = ["id", "label_bn", "start_time", "end_time", "cutoff_minutes", "open_today", "closes_at_today"]

    def _now(self):
        if "now" not in self.context:
            self.context["now"] = timeutils.local_now()
        return self.context["now"]

    def get_open_today(self, slot):
        now = self._now()
        return slot.is_open(now.date(), now)

    def get_closes_at_today(self, slot):
        return slot.closes_at(self._now().date()).isoformat()


class VendorSerializer(serializers.ModelSerializer):
    area_ids = serializers.PrimaryKeyRelatedField(source="areas", many=True, read_only=True)
    slot_ids = serializers.PrimaryKeyRelatedField(source="slots", many=True, read_only=True)

    class Meta:
        model = Vendor
        fields = [
            "id",
            "code",
            "business_name",
            "about_bn",
            "is_own_farm",
            "delivery_fee",
            "free_delivery_above",
            "min_order",
            "area_ids",
            "slot_ids",
        ]


class ProductSerializer(serializers.ModelSerializer):
    vendor_id = serializers.IntegerField(read_only=True)
    vendor_name = serializers.CharField(source="vendor.business_name", read_only=True)
    category_id = serializers.IntegerField(read_only=True)
    category_name_bn = serializers.CharField(source="category.name_bn", read_only=True)
    qty_step = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "name_bn",
            "vendor_id",
            "vendor_name",
            "category_id",
            "category_name_bn",
            "unit_label_bn",
            "unit_kind",
            "qty_step",
            "price",
            "previous_price",
            "in_stock",
            "badge_bn",
            "emoji",
            "bg_color",
        ]

    def get_qty_step(self, product):
        return "0.5" if product.unit_kind == Product.UnitKind.KG else "1"
