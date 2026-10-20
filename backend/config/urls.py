from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", include("core.health_urls")),
    path("api/v1/", include("core.urls")),
]