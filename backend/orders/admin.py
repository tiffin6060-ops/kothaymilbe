from django.contrib import admin, messages

from .models import Order, VendorOrder, VendorOrderItem

MONEY_FIELDS = ["subtotal", "delivery_fee", "total"]
ITEM_FIELDS = ["product", "name_snapshot", "unit_snapshot", "unit_price", "qty", "line_total"]


class VendorOrderInline(admin.TabularInline):
    model = VendorOrder
    fields = ["vendor", "slot", "status", *MONEY_FIELDS, "cancel_reason"]
    readonly_fields = ["vendor", *MONEY_FIELDS]
    extra = 0
    can_delete = False
    show_change_link = True

    def has_add_permission(self, request, obj=None):
        return False


class VendorOrderItemInline(admin.TabularInline):
    model = VendorOrderItem
    fields = ITEM_FIELDS
    readonly_fields = ITEM_FIELDS
    extra = 0
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ["number", "customer_name", "phone", "area", "delivery_date", "grand_total", "created_at"]
    list_filter = ["area", "delivery_date"]
    search_fields = ["number", "phone", "customer_name"]
    readonly_fields = ["number", "idempotency_key", "grand_total", "created_at"]
    date_hierarchy = "delivery_date"
    inlines = [VendorOrderInline]
    list_select_related = ["area"]


def _status_action(new_status, label):
    @admin.action(description=f"নির্বাচিত অর্ডারের অবস্থা: {label}")
    def action(modeladmin, request, queryset):
        updated = queryset.update(status=new_status)
        modeladmin.message_user(request, f"{updated}টি অর্ডারের অবস্থা “{label}” করা হয়েছে।", messages.SUCCESS)

    action.__name__ = f"mark_{new_status}"
    return action


@admin.register(VendorOrder)
class VendorOrderAdmin(admin.ModelAdmin):
    list_display = ["order", "vendor", "customer_phone", "area", "delivery_date", "slot", "status", "total"]
    list_filter = ["status", "vendor", "order__area", "order__delivery_date"]
    search_fields = ["order__number", "order__phone"]
    readonly_fields = ["order", "vendor", *MONEY_FIELDS]
    fields = ["order", "vendor", "slot", "status", *MONEY_FIELDS, "cancel_reason"]
    inlines = [VendorOrderItemInline]
    list_select_related = ["order", "order__area", "vendor", "slot"]
    actions = [_status_action(value, label) for value, label in VendorOrder.Status.choices]

    @admin.display(description="মোবাইল", ordering="order__phone")
    def customer_phone(self, obj):
        return obj.order.phone

    @admin.display(description="এলাকা", ordering="order__area")
    def area(self, obj):
        return obj.order.area

    @admin.display(description="ডেলিভারির তারিখ", ordering="order__delivery_date")
    def delivery_date(self, obj):
        return obj.order.delivery_date

    def has_add_permission(self, request):
        return False


@admin.register(VendorOrderItem)
class VendorOrderItemAdmin(admin.ModelAdmin):
    list_display = ["vendor_order", "name_snapshot", "unit_snapshot", "unit_price", "qty", "line_total"]
    search_fields = ["vendor_order__order__number", "name_snapshot"]
    readonly_fields = ["vendor_order", *ITEM_FIELDS]
    list_select_related = ["vendor_order__order", "vendor_order__vendor"]

    def has_add_permission(self, request):
        return False
