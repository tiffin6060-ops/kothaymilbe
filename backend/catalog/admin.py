from django.contrib import admin

from .models import Area, Category, Product, Slot, Vendor


@admin.register(Area)
class AreaAdmin(admin.ModelAdmin):
    list_display = ["name_bn", "name_en", "is_active"]
    list_editable = ["is_active"]


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ["name_bn", "emoji", "sort_order"]
    list_editable = ["sort_order"]


@admin.register(Slot)
class SlotAdmin(admin.ModelAdmin):
    list_display = ["label_bn", "start_time", "end_time", "cutoff_minutes"]


@admin.register(Vendor)
class VendorAdmin(admin.ModelAdmin):
    list_display = ["business_name", "code", "is_own_farm", "is_active", "delivery_fee", "free_delivery_above", "min_order"]
    list_filter = ["is_active", "is_own_farm", "areas"]
    search_fields = ["business_name", "code"]
    filter_horizontal = ["areas", "slots"]


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ["name_bn", "vendor", "category", "unit_label_bn", "price", "in_stock", "is_active", "sort_order"]
    list_editable = ["price", "in_stock", "is_active", "sort_order"]
    list_filter = ["vendor", "category", "in_stock", "is_active", "unit_kind"]
    search_fields = ["name_bn", "vendor__business_name"]
    list_select_related = ["vendor", "category"]
