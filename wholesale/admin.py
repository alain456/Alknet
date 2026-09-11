from django.contrib import admin
from .models import (
    WholesalePharmacyProfile, WholesaleProduct, StockMovement,
    WholesaleOrder, WholesaleOrderItem, WholesaleCart, NotificationLog,
)

admin.site.register(WholesalePharmacyProfile)
admin.site.register(WholesaleProduct)
admin.site.register(StockMovement)
admin.site.register(WholesaleOrder)
admin.site.register(WholesaleOrderItem)
admin.site.register(WholesaleCart)
admin.site.register(NotificationLog)
