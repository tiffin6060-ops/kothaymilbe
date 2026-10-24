from django.urls import path

from . import views

urlpatterns = [
    path("areas/", views.AreaList.as_view(), name="area-list"),
    path("categories/", views.CategoryList.as_view(), name="category-list"),
    path("slots/", views.SlotList.as_view(), name="slot-list"),
    path("vendors/", views.VendorList.as_view(), name="vendor-list"),
    path("products/", views.ProductList.as_view(), name="product-list"),
]
