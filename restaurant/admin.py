from django.contrib import admin

from . import models

admin.site.register(models.RestaurantProfile)
admin.site.register(models.MenuItem)
admin.site.register(models.TableBooking)
