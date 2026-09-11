from django.contrib import admin

from .models import (
    NotificationLog,
    Prescription,
    ProformaInvoice,
    RetailCart,
    RetailCartItem,
    RetailOrder,
    RetailOrderEvent,
    RetailOrderItem,
    RetailPharmacyProfile,
    RetailProduct,
    StockMovement,
)


admin.site.register([
    RetailPharmacyProfile,
    RetailProduct,
    StockMovement,
    RetailOrder,
    RetailOrderItem,
    RetailOrderEvent,
    RetailCart,
    RetailCartItem,
    ProformaInvoice,
    Prescription,
    NotificationLog,
])
