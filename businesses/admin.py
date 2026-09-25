from django.contrib import admin
from .models import SubscriptionPlan, BusinessSubscription, SubscriptionPayment, PlatformNotification, PlatformSubscriptionSettings


@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'price_bif', 'duration_days', 'is_trial', 'is_active')
    list_filter = ('is_active', 'is_trial')
    search_fields = ('code', 'name')


@admin.register(BusinessSubscription)
class BusinessSubscriptionAdmin(admin.ModelAdmin):
    list_display = ('business', 'plan', 'status', 'starts_at', 'ends_at', 'payment_reference')
    list_filter = ('status', 'plan')
    search_fields = ('business__name', 'payment_reference')
    raw_id_fields = ('business', 'plan')


@admin.register(PlatformSubscriptionSettings)
class PlatformSubscriptionSettingsAdmin(admin.ModelAdmin):
    list_display = ('grace_period_days', 'updated_at')


@admin.register(SubscriptionPayment)
class SubscriptionPaymentAdmin(admin.ModelAdmin):
    list_display = (
        'business', 'plan', 'amount_bif', 'payer_phone', 'status',
        'provider_reference', 'merchant_account', 'paid_at', 'created_at',
    )
    list_filter = ('status', 'provider')
    search_fields = ('business__name', 'payer_phone', 'provider_reference')
    raw_id_fields = ('business', 'plan', 'subscription', 'initiated_by')
    readonly_fields = ('raw_request', 'raw_response', 'created_at', 'updated_at')


@admin.register(PlatformNotification)
class PlatformNotificationAdmin(admin.ModelAdmin):
    list_display = ('title', 'notification_type', 'business', 'is_read', 'created_at')
    list_filter = ('notification_type', 'is_read')
    search_fields = ('title', 'message', 'business__name')
    raw_id_fields = ('business', 'payment')
