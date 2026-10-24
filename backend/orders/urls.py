from django.urls import path

from . import views

urlpatterns = [
    path("orders/", views.OrderCreate.as_view(), name="order-create"),
    path("orders/<str:number>/", views.OrderDetail.as_view(), name="order-detail"),
]
