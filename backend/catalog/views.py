from django.db.models import Q
from rest_framework import generics
from rest_framework.exceptions import ValidationError

from .models import Area, Category, Product, Slot, Vendor
from .serializers import AreaSerializer, CategorySerializer, ProductSerializer, SlotSerializer, VendorSerializer


def int_param(request, name):
    value = request.query_params.get(name, "").strip()
    if not value:
        return None
    try:
        return int(value)
    except ValueError:
        raise ValidationError({name: [f"'{name}' অবশ্যই একটি সংখ্যা (id) হতে হবে।"]})


class AreaList(generics.ListAPIView):
    serializer_class = AreaSerializer
    queryset = Area.objects.filter(is_active=True)


class CategoryList(generics.ListAPIView):
    serializer_class = CategorySerializer
    queryset = Category.objects.all()


class SlotList(generics.ListAPIView):
    serializer_class = SlotSerializer
    queryset = Slot.objects.all()


class VendorList(generics.ListAPIView):
    serializer_class = VendorSerializer

    def get_queryset(self):
        qs = Vendor.objects.filter(is_active=True).prefetch_related("areas", "slots")
        area = int_param(self.request, "area")
        if area is not None:
            qs = qs.filter(areas__id=area, areas__is_active=True)
        return qs.distinct()


class ProductList(generics.ListAPIView):
    serializer_class = ProductSerializer

    def get_queryset(self):
        qs = Product.objects.filter(is_active=True, vendor__is_active=True).select_related("vendor", "category")
        area = int_param(self.request, "area")
        if area is not None:
            qs = qs.filter(vendor__areas__id=area, vendor__areas__is_active=True)
        category = int_param(self.request, "category")
        if category is not None:
            qs = qs.filter(category_id=category)
        q = self.request.query_params.get("q", "").strip()
        if q:
            qs = qs.filter(
                Q(name_bn__icontains=q) | Q(category__name_bn__icontains=q) | Q(vendor__business_name__icontains=q)
            )
        return qs.distinct()
