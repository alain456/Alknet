from django.contrib import admin
from .models import SiteSettings, FooterLink, Partner, ContentPage, ContactMessage


@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    list_display = ("brand_name", "updated_at")


@admin.register(FooterLink)
class FooterLinkAdmin(admin.ModelAdmin):
    list_display = ("label", "column", "url", "display_order", "is_active")
    list_filter = ("column", "is_active")


@admin.register(Partner)
class PartnerAdmin(admin.ModelAdmin):
    list_display = ("name", "website_url", "display_order", "is_active")
    list_filter = ("is_active",)


@admin.register(ContentPage)
class ContentPageAdmin(admin.ModelAdmin):
    list_display = ("title", "slug", "is_published", "updated_at")
    prepopulated_fields = {"slug": ("title",)}
    list_filter = ("is_published",)


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ("subject", "name", "email", "is_read", "created_at")
    list_filter = ("is_read", "created_at")
    search_fields = ("name", "email", "subject", "message")
    readonly_fields = ("name", "email", "phone", "subject", "message", "ip_address", "created_at")
