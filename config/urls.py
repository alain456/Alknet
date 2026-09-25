"""
URL configuration for config project.
"""
from django.contrib import admin
from django.conf import settings
from django.urls import path, include, re_path
from django.views.static import serve

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/accounts/', include('accounts.urls')),
    path('api/v1/roles/', include('roles.urls')),
    path('api/v1/business-categories/', include('business_categories.urls')),
    path('api/v1/businesses/', include('businesses.urls')),
    path('api/v1/profiles/', include('profiles.urls')),
    path('api/v1/service-categories/', include('service_categories.urls')),
    path('api/v1/services/', include('services.urls')),
    path('api/v1/product-categories/', include('product_categories.urls')),
    path('api/v1/products/', include('products.urls')),
    path('api/v1/offers/', include('offers.urls')),
    path('api/v1/analytics/', include('analytics.urls')),
    path('api/v1/locations/', include('locations.urls')),
    path('api/v1/hospital/', include('hospital.urls')),
    path('api/v1/hotel/', include('hotel.urls')),
    path('api/v1/bookings/', include('bookings.urls')),
    path('api/v1/orders/', include('orders.urls')),
    path('api/v1/cms/', include('site_content.urls')),
    path('api/v1/wholesale/', include('wholesale.urls')),
    path('api/v1/retail/', include('retail.urls')),
    # Uploads ordonnances (MVP ; préférer nginx/S3 en prod)
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]
