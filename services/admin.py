from django.contrib import admin

from .models import (
    ContactMessage,
    ContactRequest,
    ProviderDocument,
    Service,
    ServiceProviderProfile,
    ServiceReview,
    ServiceSubItem,
    TeamMember,
)


class ServiceSubItemInline(admin.TabularInline):
    model = ServiceSubItem
    extra = 0


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ('title', 'business', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('title',)
    inlines = [ServiceSubItemInline]


@admin.register(ServiceProviderProfile)
class ServiceProviderProfileAdmin(admin.ModelAdmin):
    list_display = ('commercial_name', 'business', 'is_published')


@admin.register(TeamMember)
class TeamMemberAdmin(admin.ModelAdmin):
    list_display = ('name', 'business', 'role_title', 'is_public')


@admin.register(ProviderDocument)
class ProviderDocumentAdmin(admin.ModelAdmin):
    list_display = ('title', 'business', 'kind', 'is_public')


class ContactMessageInline(admin.TabularInline):
    model = ContactMessage
    extra = 0
    readonly_fields = ('kind', 'body', 'created_at')


@admin.register(ContactRequest)
class ContactRequestAdmin(admin.ModelAdmin):
    list_display = ('reference', 'client_name', 'business', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('reference', 'client_name', 'client_email', 'client_address', 'message')
    inlines = [ContactMessageInline]


@admin.register(ServiceReview)
class ServiceReviewAdmin(admin.ModelAdmin):
    list_display = ('service', 'author', 'score')
