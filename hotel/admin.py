from django.contrib import admin
from . import models

admin.site.register(models.HotelProfile)
admin.site.register(models.RoomType)
admin.site.register(models.Room)
admin.site.register(models.Reservation)
admin.site.register(models.Stay)
admin.site.register(models.HotelInvoice)
