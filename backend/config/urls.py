from django.contrib import admin
from django.urls import include, path

admin.site.site_header = "কোথায় মিলবে — অ্যাডমিন (ডেমো)"
admin.site.site_title = "কোথায় মিলবে অ্যাডমিন"
admin.site.index_title = "ড্যাশবোর্ড"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("catalog.urls")),
    path("api/v1/", include("orders.urls")),
]
