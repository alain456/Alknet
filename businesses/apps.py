from django.apps import AppConfig


class BusinessesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'businesses'

    def ready(self):
        from . import signals  # noqa: F401
        from .stock_alerts import connect_stock_alert_signals
        connect_stock_alert_signals()
